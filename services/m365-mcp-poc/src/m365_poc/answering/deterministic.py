"""Transparent, non-LLM answer composition. Every sentence is built from one or more evidence items."""

from __future__ import annotations

from ..evidence import Selection
from .base import ClaimOut, StructuredAnswer
from .validator import abstention_text

DETERMINISTIC_NAME = "deterministic"
DETERMINISTIC_MODEL = "deterministic-non-llm"


class DeterministicAnswerProvider:
    name = DETERMINISTIC_NAME
    model = DETERMINISTIC_MODEL

    def compose(self, question: str, selection: Selection) -> StructuredAnswer:
        del question  # the rules are driven by the selection, not by free text
        if selection.abstain_reason:
            return _abstain(selection.abstain_reason, self.name, self.model)

        conflicts = [r for r in selection.fields if r.conflict]
        if conflicts:
            # Contradictory single values: abstain and hand the sources to a reviewer.
            statements = [
                f"{r.label}: Die Quellen nennen unterschiedliche Werte ({' bzw. '.join(r.values)})." for r in conflicts
            ]
            cited = tuple(item for r in conflicts for item in r.items)
            return StructuredAnswer(
                answer=" ".join(statements) + " Bitte prüfen.",
                claims=(),
                uncertainty="Widersprüchliche Quellen. Keine Antwort ohne manuelle Prüfung.",
                requires_review=True,
                abstained=True,
                provider=self.name,
                model=self.model,
                reason="conflicting_evidence",
                cited=cited,
            )

        claims: list[ClaimOut] = []
        texts: list[str] = []
        missing: list[str] = []
        cited_items = []
        for result in selection.fields:
            if result.missing:
                missing.append(result.spec.display)
                continue
            ids = tuple(item.evidence_id for item in result.items)
            cited_items.extend(result.items)
            if result.spec.multi:
                text = f"{result.label} laut Quellen: {'; '.join(result.values)}."
            else:
                text = f"{result.label} laut Quelle: {result.values[0]}."
            claims.append(ClaimOut(text=text, evidence_ids=ids))
            texts.append(text)
        if not claims:
            return _abstain("no_evidence", self.name, self.model)
        for name in missing:
            texts.append(f"Zu {name} wurde in den ausgewählten Dokumenten keine Angabe gefunden.")

        reasons = list(selection.review_reasons) + (["missing_field"] if missing else [])
        uncertainty = _uncertainty(reasons)
        return StructuredAnswer(
            answer=" ".join(texts),
            claims=tuple(claims),
            uncertainty=uncertainty,
            requires_review=bool(reasons),
            abstained=False,
            provider=self.name,
            model=self.model,
            cited=tuple(cited_items),
        )


def _uncertainty(reasons: list[str]) -> str:
    if not reasons:
        return "Keine besonderen Unsicherheiten erkannt. Quellen bitte trotzdem prüfen."
    labels = {
        "needs_ocr": "Mindestens eine Seite hat keine verlässliche Textschicht (Scan).",
        "rotated_page": "Mindestens eine Seite ist gedreht oder schräg; Werte bitte am Original prüfen.",
        "missing_field": "Mindestens eine angefragte Angabe fehlt in den ausgewählten Dokumenten.",
    }
    return " ".join(labels.get(r, r) for r in reasons)


def _abstain(reason: str, provider: str, model: str) -> StructuredAnswer:
    return StructuredAnswer(
        answer=abstention_text(),
        claims=(),
        uncertainty="Keine ausreichende Evidenz.",
        requires_review=True,
        abstained=True,
        provider=provider,
        model=model,
        reason=reason,
    )
