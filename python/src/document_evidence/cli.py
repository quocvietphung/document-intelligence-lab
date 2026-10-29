"""Read and validate one local PDF. JSON output is private document data."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from .reader import DoclingReader, DocumentReadError
from .validation import validate_document
from .structure import validate_structure
from .inspection import ground_pdf, read_pdf_structure
from dataclasses import asdict


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--artifacts-path", type=Path, help="Prepared Docling model directory")
    parser.add_argument("--allow-model-download", action="store_true", help="Explicitly allow Docling to fetch missing model weights")
    parser.add_argument("--no-ocr", action="store_true", help="Use embedded PDF text; scanned pages may remain empty")
    parser.add_argument("--timeout", type=int, default=180, choices=range(1, 1801), metavar="SECONDS",
                        help="Conversion deadline (default 180; first model preparation may need longer)")
    parser.add_argument("--require-label", action="append", default=[], help="Literal required text label; repeat for several")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--ground", metavar="VALUE", help="Locate exact native/OCR occurrences without loading Docling")
    mode.add_argument("--tags-only", action="store_true", help="Inspect native PDF tags without loading Docling")
    parser.add_argument("--inspect-structure", action="store_true", help="Include structural-preservation findings, not accessibility certification")
    parser.add_argument("--page", type=int, choices=range(1,5), help="Limit grounding to one page")
    parser.add_argument("--occurrence-id", help="Explicit candidate ID; never select the first duplicate implicitly")
    parser.add_argument("--ocr-language", default="eng", help="Installed Tesseract languages for --ground, e.g. eng+deu")
    parser.add_argument("--orientation", choices=("auto","0","90","180","270"), default="auto", help="Clockwise OCR correction; auto returns a query-specific candidate, not verified orientation")
    parser.add_argument("--no-deskew", action="store_true", help="Disable conservative Hough-line correction for image-only pages")
    parser.add_argument("--output", type=Path, help="New private JSON file; existing files are never overwritten")
    args = parser.parse_args(argv)
    try:
        if args.ground is not None:
            value = ground_pdf(args.pdf, args.ground, page=args.page, occurrence_id=args.occurrence_id,
                               ocr=not args.no_ocr, deskew=not args.no_deskew, languages=args.ocr_language, orientation=args.orientation,
                               timeout_seconds=min(args.timeout,300)).to_dict()
        elif args.tags_only:
            value = {"native_structure": asdict(read_pdf_structure(args.pdf, timeout_seconds=min(args.timeout,300)))}
        else:
            document = DoclingReader(artifacts_path=args.artifacts_path,
                                     allow_model_download=args.allow_model_download, ocr=not args.no_ocr,
                                     timeout_seconds=args.timeout).read(args.pdf)
            value = {"document": document.to_dict(), "validation": validate_document(document, required_labels=args.require_label).to_dict()}
            if args.inspect_structure:
                value["structure_validation"] = validate_structure(document).to_dict()
        encoded = json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2)
        if args.output:
            descriptor = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "w", encoding="utf-8") as output:
                output.write(encoded + "\n")
        else:
            print(encoded)
        return 0
    except DocumentReadError as error:
        print(str(error), file=sys.stderr)
        return 2
    except ValueError:
        print("INVALID_INSPECTION_OPTIONS", file=sys.stderr)
        return 2
    except OSError:
        print("OUTPUT_UNAVAILABLE_OR_ALREADY_EXISTS", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
