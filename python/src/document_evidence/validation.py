"""Deterministic checks, not a semantic fact checker or approval engine."""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from decimal import Decimal, InvalidOperation
from typing import Iterable

from .models import Document


@dataclass(frozen=True)
class Money:
    amount: Decimal | None
    currency: str | None
    status: str


def normalize_money(raw: str, context: str = "") -> Money:
    """Preserve the input; reject ambiguous separators and mixed/unknown currencies.

    Shared fixtures compare this strict contract with the Docker ETL worker.
    Java's permissive comparison key is checked only on the supported subset;
    it must not be treated as currency-aware financial validation.
    """
    aliases = {"€": "EUR", "₹": "INR", "£": "GBP"}
    combined = raw + " " + context
    currencies = set(re.findall(r"\b(?:EUR|INR|USD|GBP)\b", combined))
    currencies.update(code for symbol, code in aliases.items() if symbol in combined)
    if len(currencies) != 1:
        return Money(None, None, "CURRENCY_UNKNOWN_OR_AMBIGUOUS")
    currency = next(iter(currencies))
    value = re.sub(r"EUR|INR|USD|GBP|[€₹£\s]", "", raw).strip()
    if re.fullmatch(r"-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{2}", value):
        value = value.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"-?\d{1,3}(?:,\d{3})+\.\d{2}", value):
        value = value.replace(",", "")
    elif not re.fullmatch(r"-?\d+(?:\.\d{2})?", value):
        return Money(None, currency, "AMOUNT_FORMAT_AMBIGUOUS")
    try:
        amount = Decimal(value)
        if abs(amount) >= Decimal("1e15"):
            raise InvalidOperation()
        return Money(amount, currency, "VALID")
    except InvalidOperation:
        return Money(None, currency, "AMOUNT_OUT_OF_RANGE")


class CitationError(ValueError):
    def __init__(self) -> None:
        super().__init__("MODEL_CITATION_CONTRACT_FAILED")


def validate_citations(answer: str, allowed_ids: Iterable[str]) -> str:
    """Match the Java citation contract; existence is not semantic support."""
    if not answer or not answer.strip():
        raise CitationError()
    ids = set(allowed_ids)
    result = answer
    for source_id in sorted(ids):
        if not source_id or len(source_id) > 150 or any(c in source_id for c in "[]\r\n"):
            raise CitationError()
        result = re.sub(r"\[+\s*" + re.escape(source_id) + r"\s*\]+",
                        lambda _: "[" + source_id + "]", result)
    pattern = re.compile(r"\[([^\]\n]{1,150})\]")
    found = pattern.findall(result)
    if any(source_id not in ids for source_id in found):
        raise CitationError()
    remainder = pattern.sub("", result)
    if (ids and not found) or "[" in remainder or "]" in remainder:
        raise CitationError()
    return result


@dataclass(frozen=True)
class Finding:
    code: str
    severity: str
    source_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class ValidationReport:
    document_id: str
    findings: tuple[Finding, ...]
    rule_version: str = "document-evidence-rules-v1"
    human_review_required: bool = True

    def to_dict(self) -> dict:
        return asdict(self)


def validate_document(document: Document, *, required_labels: Iterable[str] = ()) -> ValidationReport:
    """Check source structure, empty pages, ambiguous dates and explicit text labels.

    Labels are literal text-presence checks, not trained field classification.
    Empty findings never grant human approval or certify PDF authenticity.
    """
    findings: list[Finding] = []
    seen: set[str] = set()
    page_numbers = {page.number for page in document.pages}
    if not document.pages:
        findings.append(Finding("NO_PAGES", "error"))
    if len(page_numbers) != len(document.pages):
        findings.append(Finding("DUPLICATE_PAGE", "error"))
    for page in document.pages:
        if page.number < 1:
            findings.append(Finding("INVALID_PAGE", "error"))
        if not page.text.strip():
            findings.append(Finding("EMPTY_PAGE", "warning"))
        for source in page.sources:
            if source.id in seen:
                findings.append(Finding("DUPLICATE_SOURCE", "error", (source.id,)))
            seen.add(source.id)
            if source.page != page.number:
                findings.append(Finding("SOURCE_PAGE_MISMATCH", "error", (source.id,)))
            if re.search(r"\b(?:0?[1-9]|1[0-2])/(?:0?[1-9]|1[0-2])/\d{4}\b", source.text):
                findings.append(Finding("AMBIGUOUS_DATE_PRESERVED", "warning", (source.id,)))
    all_text = "\n".join(page.text for page in document.pages).casefold()
    for label in required_labels:
        if not isinstance(label, str) or not label.strip():
            raise ValueError("Required labels must be non-empty text")
        if label.casefold() not in all_text:
            findings.append(Finding("REQUIRED_LABEL_MISSING", "warning"))
    for table in document.tables:
        if table.page not in page_numbers or table.source_id not in seen:
            findings.append(Finding("TABLE_SOURCE_MISSING", "error", (table.source_id,)))
        if table.rows < 1 or table.columns < 1 or any(
            cell.row < 0 or cell.column < 0 or cell.row_span < 1 or cell.column_span < 1
            or cell.row + cell.row_span > table.rows or cell.column + cell.column_span > table.columns
            for cell in table.cells
        ):
            findings.append(Finding("INVALID_TABLE", "error", (table.source_id,)))
        positions = [(cell.row, cell.column) for cell in table.cells]
        if len(set(positions)) != len(positions):
            findings.append(Finding("DUPLICATE_TABLE_CELL", "error", (table.source_id,)))
    return ValidationReport(document.id, tuple(findings))


def check_evidence(document: Document, source_id: str, quote: str, *, value: str | None = None) -> bool:
    """Exact excerpt/value containment only; deliberately no fuzzy or LLM repair."""
    matches = [source for source in document.sources if source.id == source_id]
    return (len(matches) == 1 and bool(quote.strip()) and quote in matches[0].text
            and (value is None or bool(value.strip()) and value in quote))
