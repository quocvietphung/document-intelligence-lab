"""Local-only PDF input and a bounded, short-lived Docling subprocess, not a service."""
from __future__ import annotations

import hashlib
import json
import math
import os
import stat
import subprocess
import sys
from dataclasses import dataclass, replace
from pathlib import Path

from .models import Cell, Document, Page, Source, Table
from .structure import docling_structure, pdf_structure_from_dict


class DocumentReadError(ValueError):
    """Contains a safe code, never document content or a parser traceback."""


def _integer(value: object, minimum: int, maximum: int) -> int:
    if type(value) is not int or not minimum <= value <= maximum:
        raise DocumentReadError("INVALID_DOCLING_STRUCTURE")
    return value


def normalize_docling(payload: dict, *, name: str, sha256: str, provider_version: str = "unknown",
                      max_pages: int = 4) -> Document:
    """Normalize a complete DoclingDocument export without inventing confidence."""
    if len(sha256) != 64 or any(c not in "0123456789abcdef" for c in sha256):
        raise DocumentReadError("INVALID_SOURCE_HASH")
    if not isinstance(payload, dict):
        raise DocumentReadError("INVALID_DOCLING_STRUCTURE")
    pages = payload.get("pages")
    if not isinstance(pages, dict) or not 1 <= len(pages) <= max_pages:
        raise DocumentReadError("INVALID_DOCLING_PAGES")
    numbers: dict[int, list[Source]] = {}
    sizes: dict[int, dict] = {}
    for metadata in pages.values():
        if not isinstance(metadata, dict):
            raise DocumentReadError("INVALID_DOCLING_STRUCTURE")
        page = _integer(metadata.get("page_no"), 1, max_pages)
        if page in numbers:
            raise DocumentReadError("DUPLICATE_DOCLING_PAGE")
        numbers[page] = []
        sizes[page] = metadata.get("size", {})
    doc_id = "sha256-" + sha256
    source_refs: dict[str, str] = {}

    def add(item: dict, text: str, suffix: str, kind: str = "text") -> Source:
        if not isinstance(item, dict):
            raise DocumentReadError("INVALID_DOCLING_STRUCTURE")
        prov = item.get("prov", [])
        if not isinstance(prov, list) or not prov or any(not isinstance(p, dict) for p in prov):
            raise DocumentReadError("SOURCE_PAGE_MISSING")
        page_set = {_integer(p.get("page_no"), 1, max_pages) for p in prov}
        if len(page_set) != 1 or next(iter(page_set)) not in numbers:
            raise DocumentReadError("AMBIGUOUS_SOURCE_PAGE")
        page = next(iter(page_set))
        if not isinstance(text, str) or len(text) > 12000:
            raise DocumentReadError("SOURCE_TEXT_LIMIT")
        bbox = None
        box = prov[0].get("bbox") if len(prov) == 1 else None
        size = sizes[page]
        if box is not None:
            try:
                width, height = float(size["width"]), float(size["height"])
                left, top, right, bottom = (float(box[key]) for key in ("l", "t", "r", "b"))
                if box.get("coord_origin") == "BOTTOMLEFT":
                    top, bottom = height - top, height - bottom
                elif box.get("coord_origin") != "TOPLEFT":
                    raise ValueError()
                values = (left / width, top / height, right / width, bottom / height)
                if not all(math.isfinite(v) and 0 <= v <= 1 for v in values) or not (values[0] <= values[2] and values[1] <= values[3]):
                    raise ValueError()
                bbox = values
            except (KeyError, ValueError, ZeroDivisionError, TypeError, OverflowError):
                raise DocumentReadError("INVALID_SOURCE_BBOX") from None
        source = Source(f"{doc_id}:p{page}:{suffix}", page, text, bbox, kind=kind)
        numbers[page].append(source)
        if sum(len(source.text) for source in numbers[page] if source.kind != "table_cell") > 12000:
            raise DocumentReadError("PAGE_TEXT_LIMIT")
        return source

    texts, source_tables = payload.get("texts", []), payload.get("tables", [])
    if not isinstance(texts, list) or len(texts) > 4000 or not isinstance(source_tables, list) or len(source_tables) > 30:
        raise DocumentReadError("DOCLING_OUTPUT_LIMIT")
    for index, item in enumerate(texts):
        if not isinstance(item, dict):
            raise DocumentReadError("INVALID_DOCLING_STRUCTURE")
        text = item.get("text", "")
        if text:
            block = add(item, text, f"b{index + 1}", str(item.get("label", "text"))[:80])
            source_refs[f"#/texts/{index}"] = block.id
    tables = []
    for index, item in enumerate(source_tables):
        if not isinstance(item, dict) or not isinstance(item.get("data"), dict):
            raise DocumentReadError("INVALID_DOCLING_STRUCTURE")
        data = item.get("data", {})
        rows, columns = _integer(data.get("num_rows"), 1, 500), _integer(data.get("num_cols"), 1, 100)
        raw_cells = data.get("table_cells", [])
        if not isinstance(raw_cells, list) or len(raw_cells) > 1500:
            raise DocumentReadError("TABLE_CELL_LIMIT")
        cells, cell_locations = [], []
        for raw in raw_cells:
            if not isinstance(raw, dict):
                raise DocumentReadError("INVALID_TABLE_CELL")
            row = _integer(raw.get("start_row_offset_idx"), 0, rows - 1)
            column = _integer(raw.get("start_col_offset_idx"), 0, columns - 1)
            end_row = _integer(raw.get("end_row_offset_idx", row + 1), row + 1, rows)
            end_column = _integer(raw.get("end_col_offset_idx", column + 1), column + 1, columns)
            text = raw.get("text", "")
            if not isinstance(text, str) or len(text) > 500:
                raise DocumentReadError("INVALID_TABLE_CELL")
            flags = [raw.get("column_header"), raw.get("row_header")]
            if any(flag is not None and type(flag) is not bool for flag in flags):
                raise DocumentReadError("INVALID_TABLE_CELL")
            cells.append(Cell(row, column, text, end_row - row, end_column - column,
                              column_header=flags[0], row_header=flags[1]))
            cell_locations.append((row, column, text, raw.get("bbox")))
        cells.sort(key=lambda cell: (cell.row, cell.column))
        source = add(item, "\n".join(cell.text for cell in cells), f"t{index + 1}", "table")
        source_refs[f"#/tables/{index}"] = source.id
        cells = [replace(cell, source_id=f"{source.id}:r{cell.row+1}:c{cell.column+1}") for cell in cells]
        for row, column, text, box in cell_locations:
            add({"prov": [{"page_no": source.page, **({"bbox": box} if box is not None else {})}]}, text,
                f"t{index+1}:r{row+1}:c{column+1}", "table_cell")
        tables.append(Table(source.id, source.page, rows, columns, tuple(cells)))
    if not any(source.text.strip() for sources in numbers.values() for source in sources):
        raise DocumentReadError("NO_READABLE_TEXT")
    nodes, order, issues = docling_structure(payload, source_refs)
    result_pages = tuple(Page(n, tuple(numbers[n]), tuple(key for key in order if any(s.id == key for s in numbers[n])),
                              "docling-body" if order else "unavailable") for n in sorted(numbers))
    return Document(doc_id, name, sha256, result_pages, tuple(tables), provider_version=provider_version,
                    structure=nodes, structure_issues=issues)


def local_pdf_bytes(path: str | Path, max_bytes: int = 3_000_000) -> tuple[Path, bytes]:
    if "://" in str(path):
        raise DocumentReadError("LOCAL_PDF_REQUIRED")
    source = Path(path)
    try:
        with source.open("rb") as stream:
            if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
                raise DocumentReadError("LOCAL_PDF_REQUIRED")
            content = stream.read(max_bytes + 1)
    except OSError:
        raise DocumentReadError("LOCAL_PDF_UNAVAILABLE") from None
    if not content.startswith(b"%PDF-") or len(content) > max_bytes:
        raise DocumentReadError("PDF_FORMAT_OR_SIZE_LIMIT")
    return source, content


@dataclass(frozen=True)
class DoclingReader:
    artifacts_path: str | Path | None = None
    allow_model_download: bool = False
    ocr: bool = True
    max_pages: int = 4
    max_file_bytes: int = 3_000_000
    timeout_seconds: int = 180

    def read(self, path: str | Path) -> Document:
        if not 1 <= self.max_pages <= 100 or not 1 <= self.max_file_bytes <= 50_000_000 or not 1 <= self.timeout_seconds <= 1800:
            raise ValueError("Invalid reader limits")
        source, content = local_pdf_bytes(path, self.max_file_bytes)
        args = [sys.executable, "-m", "document_evidence._docling_worker", "--max-pages", str(self.max_pages),
                "--timeout", str(max(1, self.timeout_seconds - 10))]
        if not self.ocr:
            args.append("--no-ocr")
        if self.allow_model_download:
            args.append("--allow-model-download")
        if self.artifacts_path is not None:
            model_path = Path(self.artifacts_path)
            if not model_path.is_dir():
                raise DocumentReadError("MODEL_DIRECTORY_UNAVAILABLE")
            args += ["--artifacts-path", str(model_path.resolve())]
        env = dict(os.environ)
        if not self.allow_model_download:
            env.update(HF_HUB_OFFLINE="1", HF_DATASETS_OFFLINE="1", TRANSFORMERS_OFFLINE="1")
        try:
            process = subprocess.run(args, input=content, capture_output=True, timeout=self.timeout_seconds, env=env)
        except subprocess.TimeoutExpired:
            raise DocumentReadError("DOCLING_TIMEOUT") from None
        if len(process.stdout) > 6_000_000:
            raise DocumentReadError("DOCLING_OUTPUT_LIMIT")
        try:
            result = json.loads(process.stdout)
        except (ValueError, UnicodeDecodeError):
            raise DocumentReadError("DOCLING_WORKER_FAILED") from None
        if not isinstance(result, dict):
            raise DocumentReadError("DOCLING_WORKER_FAILED")
        if process.returncode or result.get("error"):
            code = result.get("error")
            raise DocumentReadError(code if code in {"DOCLING_NOT_INSTALLED", "PDF_REJECTED", "DOCLING_CONVERSION_FAILED"} else "DOCLING_WORKER_FAILED")
        if "document" not in result or not isinstance(result.get("version"), str):
            raise DocumentReadError("DOCLING_WORKER_FAILED")
        document = normalize_docling(result["document"], name=source.name, sha256=hashlib.sha256(content).hexdigest(),
                                     provider_version=result["version"], max_pages=self.max_pages)
        if isinstance(result.get("native_structure"), dict):
            document = replace(document, native_structure=pdf_structure_from_dict(result["native_structure"]))
        return document
