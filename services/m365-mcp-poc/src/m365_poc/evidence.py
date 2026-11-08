"""Deterministic evidence selection. This is the backend's source of truth for what may be cited.

Only `Label: value` lines present in extracted text are used. A missing field is reported as missing,
a contradictory single-valued field is reported as a conflict, and an unsupported question is abstained.
Only evidence from documents the caller is authorised to read reaches this module (the service filters first).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .extraction import PageText

_TOKEN_RE = re.compile(r"[a-zäöüß0-9][a-zäöüß0-9\-]*", re.IGNORECASE)
_LINE_RE = re.compile(r"^\s*([^:]{2,60}?)\s*:\s*(.+?)\s*$")
_IDENTIFIER_RE = re.compile(r"\b[A-Z]{2}-\d{4}-\d{3}\b")
# The project name part is capitalised words only; the "Projekt" keyword may be lower-case.
_PROJECT_MENTION_RE = re.compile(r"\b[Pp]rojekt(?:s|es|e)?\s+((?:[A-ZÄÖÜ][\wäöüß\-]*)(?:\s+[A-ZÄÖÜ][\wäöüß\-]*)*)")
MAX_EVIDENCE_TEXT = 300

_STOPWORDS = frozenset(
    {
        "wie",
        "ist",
        "der",
        "die",
        "das",
        "und",
        "wann",
        "wer",
        "welche",
        "welcher",
        "welches",
        "des",
        "von",
        "im",
        "in",
        "zu",
        "fuer",
        "für",
        "gibt",
        "es",
        "bei",
        "sind",
        "den",
        "dem",
        "ein",
        "eine",
        "einer",
        "am",
        "auf",
        "mit",
        "aus",
        "gehört",
        "gehoert",
        "zur",
        "zum",
        "an",
        "wo",
    }
)


def query_terms(text: str) -> list[str]:
    """Lower-cased content terms of a question, stopwords removed, in first-seen order."""
    seen: list[str] = []
    for raw in _TOKEN_RE.findall(text.lower()):
        if len(raw) < 3 or raw in _STOPWORDS or raw in seen:
            continue
        seen.append(raw)
    return seen


@dataclass(frozen=True)
class FieldSpec:
    key: str
    labels: tuple[str, ...]  # normalised labels as written before the colon
    display: str  # used in "missing" statements
    triggers: tuple[str, ...] = ()  # question tokens that request this field
    multi: bool = False  # several values may legitimately exist (never a conflict)


FIELDS: tuple[FieldSpec, ...] = (
    FieldSpec("project_name", ("projektname",), "den Projektnamen"),
    FieldSpec("project_number", ("projektnummer",), "die Projektnummer", ("projektnummer",)),
    FieldSpec("phase", ("projektphase",), "die Projektphase", ("phase",)),
    FieldSpec(
        "approval_status",
        ("genehmigungsstatus", "status"),
        "den Genehmigungsstatus",
        ("status", "genehmigungsstatus", "genehmigung", "stand"),
    ),
    FieldSpec("next_date", ("nächster termin",), "den nächsten Termin", ("termin", "wann", "datum")),
    FieldSpec("next_milestone", ("nächster meilenstein",), "den nächsten Meilenstein", ("meilenstein",)),
    FieldSpec("budget", ("budget",), "das Budget", ("budget", "kosten", "euro")),
    FieldSpec("budget_variance", ("budgetabweichung",), "die Budgetabweichung", ("abweichung",)),
    FieldSpec("team", ("verantwortlich",), "das verantwortliche Team", ("verantwortlich", "zuständig", "team")),
    FieldSpec(
        "open_items", ("offene punkte",), "die offenen Punkte", ("offen", "offene", "offenen", "aufgaben"), multi=True
    ),
    FieldSpec("esg", ("esg-hinweis",), "den ESG-Hinweis", ("esg", "energie", "energieeffizienz", "nachhaltig")),
    FieldSpec("authority", ("zuständige behörde",), "die zuständige Behörde", ("behörde", "bauamt")),
)
_FIELD_BY_KEY = {f.key: f for f in FIELDS}


@dataclass(frozen=True)
class DocumentText:
    """An authorised document with its extracted pages (already filtered by the service)."""

    document_id: str
    name: str
    location: str
    pages: list[PageText]


@dataclass(frozen=True)
class EvidenceItem:
    evidence_id: str
    document_id: str
    name: str
    location: str
    page: int
    text: str
    field_key: str
    label: str
    value: str
    extractor: str
    rotation: int = 0
    polygon: tuple[float, ...] | None = None
    table_id: str | None = None
    row: int | None = None
    column: int | None = None


@dataclass
class FieldResult:
    spec: FieldSpec
    label: str = ""
    items: list[EvidenceItem] = field(default_factory=list)

    @property
    def values(self) -> list[str]:
        return list(dict.fromkeys(item.value for item in self.items))

    @property
    def missing(self) -> bool:
        return not self.items

    @property
    def conflict(self) -> bool:
        return (not self.spec.multi) and len(self.values) > 1


@dataclass
class Selection:
    fields: list[FieldResult] = field(default_factory=list)
    abstain_reason: str | None = None
    review_reasons: list[str] = field(default_factory=list)

    @property
    def evidence(self) -> list[EvidenceItem]:
        seen: dict[str, EvidenceItem] = {}
        for result in self.fields:
            for item in result.items:
                seen.setdefault(item.evidence_id, item)
        return list(seen.values())


def normalise_label(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def _rows(
    doc: DocumentText,
) -> list[tuple[PageText, str, str, str, tuple[float, ...] | None, str | None, int | None, int | None]]:
    rows = []
    for page in doc.pages:
        if page.blocks:
            source_lines = [(b.text, b.polygon, b.table_id, b.row, b.column) for b in page.blocks]
        else:
            source_lines = [(line, None, None, None, None) for line in page.text.splitlines()]
        for text, polygon, table_id, row, column in source_lines:
            match = _LINE_RE.match(text)
            if match:
                rows.append(
                    (
                        page,
                        normalise_label(match.group(1)),
                        match.group(2).strip(),
                        text.strip(),
                        polygon,
                        table_id,
                        row,
                        column,
                    )
                )
    return rows


def detect_fields(question: str) -> list[FieldSpec]:
    tokens = {t.lower() for t in _TOKEN_RE.findall(question)}
    return [f for f in FIELDS if f.triggers and any(t in tokens for t in f.triggers)]


def identifiers_in(question: str) -> list[str]:
    return _IDENTIFIER_RE.findall(question)


def project_mention(question: str) -> str | None:
    match = _PROJECT_MENTION_RE.search(question)
    return match.group(1).strip() if match else None


def _single_value(doc: DocumentText, label: str) -> str | None:
    for _page, lab, value, _text, _poly, _table, _row, _col in _rows(doc):
        if lab == label:
            return value
    return None


def select_evidence(question: str, docs: list[DocumentText]) -> Selection:
    """Choose evidence for the question's fields across the authorised candidate documents."""
    selection = Selection()
    fields = detect_fields(question)
    ids = identifiers_in(question)
    mention = project_mention(question)

    if ids:
        # An identifier names exactly one project number: narrow to it before any project-name logic.
        scope = [d for d in docs if (_single_value(d, "projektnummer") or "") in ids]
        if not scope:
            selection.abstain_reason = "identifier_not_found"
            return selection
        if "project_name" not in {f.key for f in fields}:
            fields = [_FIELD_BY_KEY["project_name"], *fields]
        docs = scope
    known_projects = sorted({normalise_label(v) for d in docs if (v := _single_value(d, "projektname"))})
    question_norm = normalise_label(question)
    named = [
        name for name in known_projects if re.search(rf"(?<![\wäöüß]){re.escape(name)}(?![\wäöüß])", question_norm)
    ]
    scope = docs
    if mention is not None and not named:
        # A project-like phrase that matches no known project: refuse rather than guess.
        selection.abstain_reason = "unknown_project"
        return selection
    if named:
        scope = [d for d in docs if normalise_label(_single_value(d, "projektname") or "") in named]
    elif len({normalise_label(_single_value(d, "projektname") or "") for d in docs}) > 1:
        # Several projects among the candidates and none named in the question: never mix them.
        selection.abstain_reason = "ambiguous_project"
        return selection
    if not fields:
        selection.abstain_reason = "no_field_intent"
        return selection
    if not scope:
        selection.abstain_reason = "no_matching_document"
        return selection

    counter = 0
    for spec in FIELDS:
        if spec not in fields:
            continue
        result = FieldResult(spec=spec)
        for doc in scope:
            for page, lab, value, text, polygon, table_id, row, column in _rows(doc):
                if lab not in spec.labels:
                    continue
                counter += 1
                result.label = result.label or text.split(":", 1)[0].strip()
                result.items.append(
                    EvidenceItem(
                        evidence_id=f"E{counter}",
                        document_id=doc.document_id,
                        name=doc.name,
                        location=doc.location,
                        page=page.page,
                        text=text[:MAX_EVIDENCE_TEXT],
                        field_key=spec.key,
                        label=result.label,
                        value=value,
                        extractor=page.extractor,
                        rotation=page.rotation,
                        polygon=polygon,
                        table_id=table_id,
                        row=row,
                        column=column,
                    )
                )
        selection.fields.append(result)

    # Review flags only come from documents that actually supplied evidence for the answer.
    contributing = {item.document_id for result in selection.fields for item in result.items}
    for doc in scope:
        if doc.document_id not in contributing:
            continue
        for page in doc.pages:
            if page.needs_ocr:
                selection.review_reasons.append("needs_ocr")
            if page.rotation % 360:
                selection.review_reasons.append("rotated_page")
    selection.review_reasons = sorted(set(selection.review_reasons))
    if all(r.missing for r in selection.fields):
        selection.abstain_reason = "no_evidence"
    return selection
