"""Small immutable evidence contract; no parser, model or server is imported here."""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Source:
    id: str
    page: int
    text: str
    # Normalized top-left coordinates; None means not supplied, not measured zero.
    bbox: tuple[float, float, float, float] | None = None
    confidence: float | None = None
    kind: str = "text"


@dataclass(frozen=True)
class Page:
    number: int
    sources: tuple[Source, ...]
    reading_order: tuple[str, ...] = ()
    reading_order_method: str = "unavailable"

    @property
    def text(self) -> str:
        by_id = {source.id: source for source in self.sources}
        ordered = [by_id[key] for key in self.reading_order if key in by_id]
        remaining = [source for source in self.sources if source.id not in self.reading_order]
        return "\n".join(source.text for source in ordered + remaining if source.kind != "table_cell")


@dataclass(frozen=True)
class Cell:
    row: int
    column: int
    text: str
    row_span: int = 1
    column_span: int = 1
    source_id: str | None = None
    column_header: bool | None = None
    row_header: bool | None = None


@dataclass(frozen=True)
class Table:
    source_id: str
    page: int
    rows: int
    columns: int
    cells: tuple[Cell, ...]


@dataclass(frozen=True)
class StructureNode:
    id: str
    kind: str
    children: tuple[str, ...] = ()
    source_ids: tuple[str, ...] = ()
    level: int | None = None
    origin: str = "docling-layout"


@dataclass(frozen=True)
class PdfTag:
    id: str
    role: str
    raw_role: str
    parent_id: str | None
    children: tuple[str, ...] = ()
    page: int | None = None
    mcids: tuple[int, ...] = ()
    scope: str | None = None
    headers: tuple[str, ...] = ()


@dataclass(frozen=True)
class PdfStructure:
    present: bool
    nodes: tuple[PdfTag, ...] = ()
    issues: tuple[str, ...] = ()
    status: str = "inspected-not-certified"
    accessibility_certified: bool = False


@dataclass(frozen=True)
class Document:
    id: str
    name: str
    sha256: str
    pages: tuple[Page, ...]
    tables: tuple[Table, ...] = ()
    provider: str = "docling"
    provider_version: str = "unknown"
    schema_version: str = "document-evidence-v1"
    human_approved: bool = False
    structure: tuple[StructureNode, ...] = ()
    structure_issues: tuple[str, ...] = ()
    native_structure: PdfStructure | None = None

    @property
    def sources(self) -> tuple[Source, ...]:
        return tuple(source for page in self.pages for source in page.sources)

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, allow_nan=False, indent=2)
