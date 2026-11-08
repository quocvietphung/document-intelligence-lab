"""Backend validation of model output. The model is never trusted to cite correctly.

Checks (all fail closed):
  * every claim cites at least one evidence ID that the backend actually supplied;
  * every number or date in a claim appears in the text of the evidence it cites;
  * contradictions and missing evidence force abstention and human review;
  * review flags from extraction (scans, rotated pages) cannot be cleared by the model.
What this does NOT verify: that a claim's wording is semantically entailed by its evidence.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from ..errors import AnswerRejected
from ..evidence import EvidenceItem, Selection
from ..models import MAX_CLAIMS, MAX_EVIDENCE_CHARS
from .base import ClaimOut, StructuredAnswer

_NUMBER_RE = re.compile(r"\d[\d.,]*\d|\d")


def abstention_text() -> str:
    return (
        "In den verfügbaren Dokumenten wurde dazu keine ausreichende Evidenz gefunden. "
        "Deshalb wird keine Antwort erzeugt."
    )


def numbers_in(text: str) -> set[str]:
    return {m.rstrip(".,") for m in _NUMBER_RE.findall(text)}


def validate_model_output(
    raw: Mapping[str, Any],
    selection: Selection,
    *,
    provider: str,
    model: str,
    usage: dict[str, int] | None,
) -> StructuredAnswer:
    evidence: dict[str, EvidenceItem] = {item.evidence_id: item for item in selection.evidence}
    if raw.get("abstain") is True:
        return StructuredAnswer(
            answer=abstention_text(),
            claims=(),
            uncertainty="Das Modell hat sich enthalten.",
            requires_review=True,
            abstained=True,
            provider=provider,
            model=model,
            reason="model_abstained",
            usage=usage,
        )

    raw_claims = raw.get("claims")
    if not isinstance(raw_claims, list) or not raw_claims or len(raw_claims) > MAX_CLAIMS:
        raise AnswerRejected("no_claims")

    claims: list[ClaimOut] = []
    cited: dict[str, EvidenceItem] = {}
    for entry in raw_claims:
        if not isinstance(entry, dict):
            raise AnswerRejected("malformed_claim")
        text = entry.get("text")
        ids = entry.get("evidence_ids")
        if not isinstance(text, str) or not text.strip() or len(text) > MAX_EVIDENCE_CHARS:
            raise AnswerRejected("malformed_claim")
        if not isinstance(ids, list) or not ids or not all(isinstance(i, str) for i in ids):
            raise AnswerRejected("claim_without_evidence")
        if any(i not in evidence for i in ids):
            raise AnswerRejected("unknown_evidence_id")
        source_numbers: set[str] = set()
        for i in ids:
            source_numbers |= numbers_in(evidence[i].text) | numbers_in(evidence[i].value)
            cited[i] = evidence[i]
        if not numbers_in(text) <= source_numbers:
            raise AnswerRejected("unsupported_number_in_claim")
        claims.append(ClaimOut(text=text.strip(), evidence_ids=tuple(ids)))

    reasons = list(selection.review_reasons)
    if any(r.missing for r in selection.fields):
        reasons.append("missing_field")
    if isinstance(raw.get("requires_review"), bool) and raw["requires_review"]:
        reasons.append("model_requested_review")
    uncertainty = raw.get("uncertainty")
    raw_answer = raw.get("answer")
    answer: str = (
        raw_answer.strip() if isinstance(raw_answer, str) and raw_answer.strip() else " ".join(c.text for c in claims)
    )
    uncertainty_text = uncertainty if isinstance(uncertainty, str) else ""
    return StructuredAnswer(
        answer=answer[:1000],
        claims=tuple(claims),
        uncertainty=(uncertainty_text or "Modellbegründung ohne zusätzliche Unsicherheit.")[:MAX_EVIDENCE_CHARS],
        requires_review=bool(reasons),
        abstained=False,
        provider=provider,
        model=model,
        usage=usage,
        cited=tuple(cited.values()),
    )
