"""Document Validation & Evidence. Importing this package never loads a model."""
from .models import Cell, Document, Page, PdfStructure, PdfTag, Source, StructureNode, Table
from .structure import validate_structure
from .inspection import GroundingCandidate, GroundingResult, ground_pdf, read_pdf_structure
from .reader import DoclingReader, DocumentReadError, normalize_docling
from .validation import (
    CitationError, Finding, Money, ValidationReport, check_evidence,
    normalize_money, validate_citations, validate_document,
)

__version__ = "0.2.0a1"
__all__ = [
    "Cell", "CitationError", "DoclingReader", "Document", "DocumentReadError", "Finding",
    "Money", "Page", "PdfStructure", "PdfTag", "Source", "StructureNode", "Table", "ValidationReport", "check_evidence", "validate_structure",
    "normalize_docling", "normalize_money", "validate_citations", "validate_document",
    "GroundingCandidate", "GroundingResult", "ground_pdf", "read_pdf_structure",
]
