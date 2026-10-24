"""One local conversion per child process; no HTTP listener or Java dependency."""
from __future__ import annotations

import argparse
import contextlib
import io
import json
import sys
from importlib.metadata import version
from pathlib import Path


def _deny_network(event: str, args: tuple) -> None:
    """Fail closed for network attempts in this offline child, including non-HF OCR downloads."""
    if event in {"socket.connect", "socket.getaddrinfo", "socket.gethostbyname", "socket.gethostbyaddr", "socket.sendto"}:
        raise PermissionError("OFFLINE_NETWORK_DISABLED")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-pages", type=int, required=True)
    parser.add_argument("--timeout", type=int, required=True)
    parser.add_argument("--artifacts-path")
    parser.add_argument("--no-ocr", action="store_true")
    parser.add_argument("--allow-model-download", action="store_true")
    args = parser.parse_args()
    if not args.allow_model_download:
        sys.addaudithook(_deny_network)
    try:
        from pypdf import PdfReader
    except ImportError:
        print(json.dumps({"error": "DOCLING_NOT_INSTALLED"}))
        return 1
    content = sys.stdin.buffer.read(50_000_001)
    try:
        pdf = PdfReader(io.BytesIO(content))
        if pdf.is_encrypted or not 1 <= len(pdf.pages) <= args.max_pages:
            raise ValueError()
    except Exception:
        print(json.dumps({"error": "PDF_REJECTED"}))
        return 1
    try:
        from docling.datamodel.base_models import DocumentStream, InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions
        from docling.datamodel.settings import settings
        from docling.document_converter import DocumentConverter, PdfFormatOption
        # Keep library progress/logging out of the private JSON result stream.
        with contextlib.redirect_stdout(sys.stderr):
            # Prepare the same bounded OCR backend on every OS, including weights
            # lazily needed only by scanned pages. An invoice text layer alone
            # must not imply that the OCR cache is ready for the next document.
            model_path = Path(args.artifacts_path) if args.artifacts_path else settings.cache_dir / "models"
            if args.allow_model_download:
                from docling.utils.model_downloader import download_models
                download_models(output_dir=model_path, with_layout=True, with_tableformer=True,
                                with_code_formula=False, with_picture_classifier=False,
                                with_rapidocr=not args.no_ocr,
                                rapidocr_models=["torch:ch"] if not args.no_ocr else None)
            options = PdfPipelineOptions(enable_remote_services=False, allow_external_plugins=False,
                                         do_ocr=not args.no_ocr, do_table_structure=True,
                                         document_timeout=args.timeout, artifacts_path=model_path,
                                         ocr_options=RapidOcrOptions(backend="torch"))
            converter = DocumentConverter(allowed_formats=[InputFormat.PDF],
                format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)})
            result = converter.convert(DocumentStream(name="document.pdf", stream=io.BytesIO(content)),
                                       max_num_pages=args.max_pages, max_file_size=len(content))
            if result.status.value != "success":
                raise ValueError()
            payload = {"document": result.document.export_to_dict(), "version": version("docling")}
        encoded = json.dumps(payload, ensure_ascii=False, allow_nan=False)
        if len(encoded.encode("utf-8")) > 6_000_000:
            raise ValueError()
        print(encoded)
        return 0
    except ImportError:
        print(json.dumps({"error": "DOCLING_NOT_INSTALLED"}))
        return 1
    except Exception:
        print(json.dumps({"error": "DOCLING_CONVERSION_FAILED"}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
