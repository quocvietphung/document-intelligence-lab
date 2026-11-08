"""Offline evaluation over the synthetic dataset. Reports metrics separately; never presented as production accuracy.

    python -m m365_poc.evaluation [--dataset eval/dataset.v2.json] [--out REPORT.json]

Claim verification is performed independently of the answer provider: every claim's numbers are checked
against the page text of the cited evidence, re-extracted by the evaluator.
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
from collections import defaultdict
from pathlib import Path
from time import perf_counter
from typing import Any

from .api import build_service
from .auth import AuthContext, local_dev_context
from .config import load_settings
from .evidence import query_terms
from .models import AskResponse
from .service import EvidenceService

RETRIEVAL_K = 5
_NUMBER_RE = re.compile(r"\d[\d.,]*\d|\d")
DEFAULT_DATASET = Path(__file__).resolve().parents[2] / "eval" / "dataset.v2.json"


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def _numbers(text: str) -> set[str]:
    return {m.rstrip(".,") for m in _NUMBER_RE.findall(text)}


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, round(pct / 100 * len(ordered) + 0.5) - 1))
    return ordered[index]


class _Verifier:
    """Independent re-extraction of cited pages, cached per document."""

    def __init__(self, service: EvidenceService, ctx: AuthContext) -> None:
        self._service = service
        self._ctx = ctx
        self._pages: dict[str, dict[int, str]] = {}

    def page_text(self, document_id: str, page: int) -> str:
        if document_id not in self._pages:
            detail = self._service.get_document(self._ctx, document_id)
            self._pages[document_id] = {p.page: p.text for p in detail.pages}
        return self._pages[document_id].get(page, "")


def _ids_by_name(service: EvidenceService, ctx: AuthContext) -> dict[str, str]:
    return {h.name: h.document_id for h in service.list_documents(ctx, 20)}


def _unsupported_claims(response: AskResponse, verifier: _Verifier) -> tuple[int, int]:
    total = len(response.claims)
    unsupported = 0
    by_id = {s.evidence_id: s for s in response.sources}
    for claim in response.claims:
        numbers = _numbers(claim.text)
        source_text = " ".join(
            _norm(verifier.page_text(by_id[i].document_id, by_id[i].page)) for i in claim.evidence_ids if i in by_id
        )
        cited_ok = all(i in by_id for i in claim.evidence_ids)
        if not cited_ok or not all(n.lower() in source_text or n in source_text for n in numbers):
            unsupported += 1
    return unsupported, total


def run_evaluation(service: EvidenceService, dataset: dict[str, Any], ctx: AuthContext | None = None) -> dict[str, Any]:
    default_ctx = ctx or local_dev_context(load_settings_for_ctx(service))
    ids = _ids_by_name(service, default_ctx)
    rows: list[dict[str, Any]] = []
    latencies: list[float] = []
    retrieval_hits = retrieval_items = 0
    retrieval_recall_sum = 0.0
    cite_ok = cite_items = 0
    answer_ok = answer_items = 0
    abstain_ok = abstain_items = 0
    claims_unsupported = claims_total = 0
    verifier = _Verifier(service, default_ctx)
    per_category: dict[str, list[bool]] = defaultdict(list)

    for item in dataset["items"]:
        item_ctx = default_ctx  # the dataset principal is the local demo identity
        started = perf_counter()
        response = service.ask(item_ctx, item["question"])
        latency_ms = (perf_counter() - started) * 1000
        latencies.append(latency_ms)

        cited_names = {(s.name, s.page) for s in response.sources}
        cited_docs = {s.name for s in response.sources}
        expected = {(e["name"], e["page"]) for e in item["expected_sources"]}
        expected_docs = {e["name"] for e in item["expected_sources"]}

        if expected_docs:
            retrieval_items += 1
            retrieved = {h.name for h in service.search(item_ctx, " ".join(query_terms(item["question"])), RETRIEVAL_K)}
            hit = bool(expected_docs & retrieved)
            retrieval_hits += int(hit)
            retrieval_recall_sum += len(expected_docs & retrieved) / len(expected_docs)
            cite_items += 1
            cite_ok += int(expected <= cited_names)

        facts = all(f.lower() in response.answer.lower() for f in item["must_contain"])
        forbidden = any(f.lower() in response.answer.lower() for f in item["must_not_contain"])
        forbidden_cited = bool(set(item["must_not_cite"]) & cited_docs)
        review_ok = item.get("expect_review") is None or response.requires_review == item["expect_review"]
        answer_items += 1
        answered_right = (
            facts
            and not forbidden
            and not forbidden_cited
            and review_ok
            and (response.abstained == item["expect_abstain"])
        )
        answer_ok += int(answered_right)
        per_category[item["category"]].append(answered_right)

        abstain_items += 1
        abstain_ok += int(response.abstained == item["expect_abstain"])

        unsupported, total = _unsupported_claims(response, verifier)
        claims_unsupported += unsupported
        claims_total += total

        rows.append(
            {
                "id": item["id"],
                "category": item["category"],
                "correct": answered_right,
                "abstained": response.abstained,
                "requires_review": response.requires_review,
                "sources": [f"{s.name} p.{s.page}" for s in response.sources],
                "latency_ms": round(latency_ms, 2),
            }
        )

    return {
        "dataset_version": dataset.get("dataset_version"),
        "scope": dataset.get("scope"),
        "provider": service.provider_name,
        "extractor": service.extractor_name,
        "answer_provider": service.answer_provider_name,
        "items": len(dataset["items"]),
        "documents_in_scope": len(ids),
        "metrics": {
            "retrieval_hit_at_5": _ratio(retrieval_hits, retrieval_items),
            "retrieval_recall_at_5": _ratio(retrieval_recall_sum, retrieval_items),
            "citation_correctness": _ratio(cite_ok, cite_items),
            "answer_correctness": _ratio(answer_ok, answer_items),
            "abstention_accuracy": _ratio(abstain_ok, abstain_items),
            "unsupported_claim_rate": _ratio(claims_unsupported, claims_total),
            "unsupported_claims": claims_unsupported,
            "claims_checked": claims_total,
            "latency_ms": {
                "p50": round(statistics.median(latencies), 2) if latencies else 0.0,
                "p95": round(_percentile(latencies, 95), 2),
                "max": round(max(latencies), 2) if latencies else 0.0,
            },
        },
        "by_category_answer_correctness": {k: _ratio(sum(v), len(v)) for k, v in sorted(per_category.items())},
        "results": rows,
    }


def load_settings_for_ctx(service: EvidenceService) -> Any:  # minimal settings for the local context
    from .config import Settings

    return Settings(local_tenant_id=load_settings().local_tenant_id)


def _ratio(numerator: float, denominator: float) -> float | None:
    return round(numerator / denominator, 4) if denominator else None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Offline evaluation of the synthetic PoC dataset.")
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--out", type=Path, default=None, help="Optional report path; refuses to overwrite.")
    args = parser.parse_args(argv)
    dataset = json.loads(args.dataset.read_text(encoding="utf-8"))
    service = build_service(load_settings())
    report = run_evaluation(service, dataset)
    text = json.dumps(report, ensure_ascii=False, indent=2)
    if args.out:
        if args.out.exists():
            print("refusing to overwrite an existing report", file=sys.stderr)
            return 2
        args.out.write_text(text + "\n", encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
