"""Read and validate one local PDF. JSON output is private document data."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from .reader import DoclingReader, DocumentReadError
from .validation import validate_document


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--artifacts-path", type=Path, help="Prepared Docling model directory")
    parser.add_argument("--allow-model-download", action="store_true", help="Explicitly allow Docling to fetch missing model weights")
    parser.add_argument("--no-ocr", action="store_true", help="Use embedded PDF text; scanned pages may remain empty")
    parser.add_argument("--timeout", type=int, default=180, choices=range(1, 1801), metavar="SECONDS",
                        help="Conversion deadline (default 180; first model preparation may need longer)")
    parser.add_argument("--require-label", action="append", default=[], help="Literal required text label; repeat for several")
    parser.add_argument("--output", type=Path, help="New private JSON file; existing files are never overwritten")
    args = parser.parse_args(argv)
    try:
        document = DoclingReader(artifacts_path=args.artifacts_path,
                                 allow_model_download=args.allow_model_download, ocr=not args.no_ocr,
                                 timeout_seconds=args.timeout).read(args.pdf)
        encoded = json.dumps({"document": document.to_dict(),
                              "validation": validate_document(document, required_labels=args.require_label).to_dict()},
                             ensure_ascii=False, allow_nan=False, indent=2)
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
    except OSError:
        print("OUTPUT_UNAVAILABLE_OR_ALREADY_EXISTS", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
