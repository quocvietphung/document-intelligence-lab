"""PDF text extraction. Page numbers and evidence locations come from extraction, never from Graph.

Two extractors produce the same shape (`DocumentText`):
  * local  — pypdf, for PDFs with a native text layer (no OCR, no cloud call);
  * azure-document-intelligence — see providers/azure_di.py (prebuilt-layout, optional and opt-in).
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from .errors import ExtractionError

MAX_PDF_BYTES = 5 * 1024 * 1024
MAX_PAGES = 20
EXTRACTOR_LOCAL_NAME = "local-pypdf-native-text"


@dataclass(frozen=True)
class Block:
    """One text line or table cell with optional bounding polygon (page coordinates, when provided)."""

    text: str
    kind: str = "line"  # line | table_cell
    polygon: tuple[float, ...] | None = None
    table_id: str | None = None
    row: int | None = None
    column: int | None = None


@dataclass(frozen=True)
class PageText:
    page: int
    text: str
    rotation: int = 0
    extractor: str = EXTRACTOR_LOCAL_NAME
    needs_ocr: bool = False
    blocks: tuple[Block, ...] = field(default=())


def _blocks_from_text(text: str) -> tuple[Block, ...]:
    return tuple(Block(text=line.strip()) for line in text.splitlines() if line.strip())


def extract_pages(data: bytes) -> list[PageText]:
    """Local native-text extraction. Fails closed on oversized, encrypted or malformed files."""
    if len(data) > MAX_PDF_BYTES:
        raise ExtractionError("size", "The document exceeds the size limit.")
    if not data.startswith(b"%PDF-"):
        raise ExtractionError("not_pdf", "The file is not a PDF.")
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ExtractionError("encrypted", "Encrypted PDFs are not supported.")
        if len(reader.pages) > MAX_PAGES:
            raise ExtractionError("pages", "The document exceeds the page limit.")
        pages: list[PageText] = []
        for index, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            rotation = int(page.get("/Rotate", 0) or 0) % 360
            pages.append(
                PageText(
                    page=index,
                    text=text,
                    rotation=rotation,
                    needs_ocr=not text.strip(),
                    blocks=_blocks_from_text(text),
                )
            )
        return pages
    except ExtractionError:
        raise
    except (PdfReadError, ValueError, KeyError, IndexError, TypeError, OverflowError) as exc:
        raise ExtractionError("unreadable", "The document could not be read.") from exc
