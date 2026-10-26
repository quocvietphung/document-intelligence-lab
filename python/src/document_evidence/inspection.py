"""Bounded local source-location checks. A text match is never visual verification."""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

from .reader import DocumentReadError, local_pdf_bytes
from .structure import pdf_structure_from_dict


@dataclass(frozen=True)
class GroundingCandidate:
    id: str
    page: int
    text: str
    bbox: tuple[float, float, float, float]
    polygon: tuple[tuple[float, float], ...]
    method: str
    context: str
    deskew_degrees: float = 0.0
    ocr_confidence: float | None = None


@dataclass(frozen=True)
class GroundingResult:
    sha256: str
    value: str
    status: str
    candidates: tuple[GroundingCandidate, ...]
    selected_id: str | None = None
    coordinate_space: str = "displayed-page-normalized-top-left"
    verification: str = "text-match-only"
    human_review_required: bool = True
    engine_versions: tuple[tuple[str, str], ...] = ()

    def to_dict(self) -> dict:
        return asdict(self)


def _inspect(path: str | Path, mode: str, options: dict, timeout_seconds: int):
    if type(timeout_seconds) is not int or not 1 <= timeout_seconds <= 300:
        raise ValueError("Inspection timeout must be between 1 and 300 seconds")
    source, content = local_pdf_bytes(path)
    try:
        result = subprocess.run([sys.executable, "-m", "document_evidence._inspection_worker", mode,
                                 json.dumps(options)], input=content, capture_output=True, timeout=timeout_seconds)
    except subprocess.TimeoutExpired:
        raise DocumentReadError("INSPECTION_TIMEOUT") from None
    if len(result.stdout) > 3_000_000:
        raise DocumentReadError("INSPECTION_OUTPUT_LIMIT")
    try:
        data = json.loads(result.stdout)
    except (ValueError, UnicodeDecodeError):
        raise DocumentReadError("INSPECTION_FAILED") from None
    codes = {"INSPECTION_DEPENDENCY_MISSING", "PDF_REJECTED", "OCR_UNAVAILABLE", "OCR_TIMEOUT", "OCR_FAILED", "INSPECTION_LIMIT"}
    if result.returncode or not isinstance(data, dict) or data.get("error"):
        raise DocumentReadError(data.get("error") if isinstance(data, dict) and data.get("error") in codes else "INSPECTION_FAILED")
    if data.get("sha256") != hashlib.sha256(content).hexdigest():
        raise DocumentReadError("INSPECTION_SOURCE_MISMATCH")
    return data


def read_pdf_structure(path: str | Path, *, timeout_seconds: int = 60):
    """Read the native tag tree, including raw/mapped roles, hierarchy and MCIDs."""
    return pdf_structure_from_dict(_inspect(path, "structure", {}, timeout_seconds)["structure"])


def ground_pdf(path: str | Path, value: str, *, page: int | None = None,
               occurrence_id: str | None = None, ocr: bool = True, deskew: bool = True,
               languages: str = "eng", timeout_seconds: int = 60) -> GroundingResult:
    """Find exact occurrences locally; duplicates never silently select the first.

    Native glyph boxes use PDFium's page-to-device transform (rotation/crop included).
    Image-only pages may use Tesseract. Deskewed OCR polygons are mapped back to the
    original rendered page. No LLM, URLs, API, automatic downloads or PDF rewriting.
    """
    if not isinstance(value, str) or not value.strip() or len(value) > 500:
        raise ValueError("A non-empty value of at most 500 characters is required")
    if page is not None and (type(page) is not int or not 1 <= page <= 4):
        raise ValueError("Page must be between 1 and 4")
    if not isinstance(languages,str) or not re.fullmatch(r"[a-z]{3}(?:\+[a-z]{3}){0,3}", languages):
        raise ValueError("Use installed Tesseract language codes, such as eng+deu")
    if occurrence_id is not None and (not isinstance(occurrence_id, str) or len(occurrence_id) > 200):
        raise ValueError("Invalid occurrence ID")
    if type(ocr) is not bool or type(deskew) is not bool:
        raise ValueError("OCR and deskew options must be booleans")
    data = _inspect(path, "ground", {"value": value, "page": page, "ocr": ocr, "deskew": deskew,
                                     "languages": languages}, timeout_seconds)
    candidates = tuple(GroundingCandidate(**{**c, "bbox": tuple(c["bbox"]),
                                               "polygon": tuple(tuple(p) for p in c["polygon"])}) for c in data["candidates"])
    selected = next((c.id for c in candidates if c.id == occurrence_id), None)
    status = "selected-candidate" if selected else "ambiguous" if len(candidates) > 1 else "matched" if candidates else "not-found"
    if occurrence_id and not selected:
        status = "unknown-occurrence"
    return GroundingResult(data["sha256"], value, status, candidates, selected,
                           engine_versions=tuple(sorted(data.get('engine_versions',{}).items())))
