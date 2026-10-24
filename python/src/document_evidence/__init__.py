"""Document Validation & Evidence. Importing this package never loads a model."""
from .models import Cell, Document, Page, Source, Table
from .reader import DoclingReader, DocumentReadError, normalize_docling
from .validation import (
    CitationError, Finding, Money, ValidationReport, check_evidence,
    normalize_money, validate_citations, validate_document,
)

__version__ = "0.1.0a1"
__all__ = [
    "Cell", "CitationError", "DoclingReader", "Document", "DocumentReadError", "Finding",
    "Money", "Page", "Source", "Table", "ValidationReport", "check_evidence",
    "normalize_docling", "normalize_money", "validate_citations", "validate_document",
]
