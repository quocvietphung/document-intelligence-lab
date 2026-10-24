import hashlib
import contextlib
import io
from importlib.resources import files
import json
import os
from pathlib import Path
import subprocess
import tempfile
import sys
import unittest
from unittest.mock import patch

from document_evidence import (
    CitationError, DoclingReader, Document, DocumentReadError, Page, Source,
    check_evidence, normalize_docling, normalize_money, validate_citations, validate_document,
)
from document_evidence.cli import main as cli

FIXTURES = json.loads(files("document_evidence").joinpath("contracts/validation-cases.json").read_text())
HASH = hashlib.sha256(b"synthetic fixture, not a PDF conversion").hexdigest()


def export():
    """Synthetic Docling export shape, not evidence of live model execution."""
    return {
        "pages": {"1": {"page_no": 1, "size": {"width": 600, "height": 800}}},
        "texts": [{"text": "Invoice no: 51109301\nDate: 03/07/2023", "prov": [
            {"page_no": 1, "bbox": {"l": 60, "t": 720, "r": 300, "b": 680, "coord_origin": "BOTTOMLEFT"}}]}],
        "tables": [{"prov": [{"page_no": 1}], "data": {"num_rows": 2, "num_cols": 2, "table_cells": [
            {"start_row_offset_idx": 0, "start_col_offset_idx": 0, "end_row_offset_idx": 1, "end_col_offset_idx": 2, "text": "Amounts"},
            {"start_row_offset_idx": 1, "start_col_offset_idx": 0, "text": "Total"},
            {"start_row_offset_idx": 1, "start_col_offset_idx": 1, "text": "2967,11 EUR"},
        ]}}],
    }


class SharedRulesTest(unittest.TestCase):
    def test_citations_match_shared_java_contract(self):
        for row in FIXTURES["citations"]:
            with self.subTest(answer=row["answer"]):
                if row["valid"]:
                    self.assertEqual(validate_citations(row["answer"], row["ids"]), row["canonical"])
                else:
                    with self.assertRaises(CitationError):
                        validate_citations(row["answer"], row["ids"])

    def test_money_matches_shared_etl_contract(self):
        for row in FIXTURES["money"]:
            with self.subTest(raw=row["raw"]):
                result = normalize_money(row["raw"], row["context"])
                self.assertEqual(str(result.amount) if result.amount is not None else None, row["amount"])
                self.assertEqual(result.currency, row["currency"])
                self.assertEqual(result.status, row["status"])

    def test_exact_ids_not_regex_patterns(self):
        self.assertEqual(validate_citations("Value [doc.1:p1]", ["doc.1:p1"]), "Value [doc.1:p1]")
        with self.assertRaises(CitationError):
            validate_citations("Value [docX1:p1]", ["doc.1:p1"])


class NormalizationTest(unittest.TestCase):
    def test_preserves_hash_page_quotes_table_spans_and_unknown_confidence(self):
        document = normalize_docling(export(), name="invoice.pdf", sha256=HASH, provider_version="fixture")
        self.assertEqual(document.sha256, HASH)
        self.assertEqual(document.pages[0].number, 1)
        self.assertEqual(document.sources[0].bbox, (0.1, 0.1, 0.5, 0.15))
        self.assertIsNone(document.sources[0].confidence)
        self.assertEqual(document.tables[0].cells[0].column_span, 2)
        self.assertEqual(document.tables[0].cells[2].text, "2967,11 EUR")
        self.assertFalse(document.human_approved)
        self.assertEqual(json.loads(document.to_json())["schema_version"], "document-evidence-v1")

    def test_ids_are_stable_for_identical_content_and_export(self):
        self.assertEqual(normalize_docling(export(), name="a.pdf", sha256=HASH).sources,
                         normalize_docling(export(), name="b.pdf", sha256=HASH).sources)

    def test_refuses_ambiguous_pages_and_invalid_table_spans(self):
        data = export()
        data["texts"][0]["prov"].append({"page_no": 2})
        with self.assertRaisesRegex(DocumentReadError, "AMBIGUOUS_SOURCE_PAGE"):
            normalize_docling(data, name="x.pdf", sha256=HASH)
        data = export()
        data["tables"][0]["data"]["table_cells"][0]["end_col_offset_idx"] = 3
        with self.assertRaises(DocumentReadError):
            normalize_docling(data, name="x.pdf", sha256=HASH)

    def test_bad_coordinates_are_not_invented(self):
        data = export()
        data["texts"][0]["prov"][0]["bbox"]["l"] = -100
        with self.assertRaisesRegex(DocumentReadError, "INVALID_SOURCE_BBOX"):
            normalize_docling(data, name="x.pdf", sha256=HASH)

    def test_blank_output_does_not_become_success(self):
        with self.assertRaisesRegex(DocumentReadError, "NO_READABLE_TEXT"):
            normalize_docling({"pages": export()["pages"]}, name="x.pdf", sha256=HASH)

    def test_shape_and_size_limits(self):
        for data in [{"pages": []}, {"pages": {}}, {"pages": export()["pages"], "texts": {}}]:
            with self.assertRaises(DocumentReadError):
                normalize_docling(data, name="x.pdf", sha256=HASH)


class ValidationTest(unittest.TestCase):
    def setUp(self):
        self.document = normalize_docling(export(), name="invoice.pdf", sha256=HASH)

    def test_flags_ambiguous_date_without_changing_source(self):
        report = validate_document(self.document, required_labels=["Invoice no", "Missing policy"])
        self.assertEqual([finding.code for finding in report.findings],
                         ["AMBIGUOUS_DATE_PRESERVED", "REQUIRED_LABEL_MISSING"])
        self.assertTrue(report.human_review_required)
        self.assertIn("03/07/2023", self.document.pages[0].text)

    def test_quote_and_value_must_both_be_in_exact_source(self):
        source = self.document.sources[0]
        self.assertTrue(check_evidence(self.document, source.id, "Invoice no: 51109301", value="51109301"))
        self.assertFalse(check_evidence(self.document, source.id, "Invoice no: 51109301", value="999"))
        self.assertFalse(check_evidence(self.document, "missing", source.text))
        self.assertFalse(check_evidence(self.document, source.id, ""))

    def test_duplicate_source_does_not_establish_evidence(self):
        source = self.document.sources[0]
        document = Document("x", "x.pdf", HASH, (Page(1, (source, source)),))
        self.assertFalse(check_evidence(document, source.id, source.text))
        self.assertIn("DUPLICATE_SOURCE", [f.code for f in validate_document(document).findings])

    def test_no_findings_is_not_approval(self):
        document = Document("x", "x.pdf", HASH, (Page(1, (Source("s", 1, "Clear source text"),)),))
        report = validate_document(document)
        self.assertEqual(report.findings, ())
        self.assertTrue(report.human_review_required)
        self.assertFalse(document.human_approved)


class ReaderBoundaryTest(unittest.TestCase):
    def test_offline_child_blocks_non_huggingface_network_attempts(self):
        program = """
import socket, sys
from document_evidence._docling_worker import _deny_network
sys.addaudithook(_deny_network)
try:
    socket.getaddrinfo('example.com', 443)
except PermissionError:
    pass
else:
    raise AssertionError('Offline DNS unexpectedly allowed')
with socket.socket() as sock:
    try:
        sock.connect(('127.0.0.1', 9))
    except PermissionError:
        pass
    else:
        raise AssertionError('Offline socket unexpectedly allowed')
"""
        result = subprocess.run([sys.executable, "-c", program], capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr.decode())

    def test_local_only_and_size_limits_run_before_docling(self):
        with self.assertRaisesRegex(DocumentReadError, "LOCAL_PDF_REQUIRED"):
            DoclingReader().read("https://example.com/invoice.pdf")
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "not.pdf"
            file.write_bytes(b"not pdf")
            with self.assertRaisesRegex(DocumentReadError, "PDF_FORMAT_OR_SIZE_LIMIT"):
                DoclingReader().read(file)
            file.write_bytes(b"%PDF-" + b"x" * 100)
            with self.assertRaisesRegex(DocumentReadError, "PDF_FORMAT_OR_SIZE_LIMIT"):
                DoclingReader(max_file_bytes=20).read(file)

    def test_offline_is_scoped_to_child_process(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "synthetic-header.pdf"
            file.write_bytes(b"%PDF-1.7 synthetic boundary fixture")
            result = subprocess.CompletedProcess([], 0, json.dumps({"document": export(), "version": "fixture"}).encode(), b"")
            previous = os.environ.get("HF_HUB_OFFLINE")
            with patch("document_evidence.reader.subprocess.run", return_value=result) as run:
                document = DoclingReader().read(file)
                self.assertEqual(document.sha256, hashlib.sha256(file.read_bytes()).hexdigest())
                self.assertEqual(run.call_args.kwargs["env"]["HF_HUB_OFFLINE"], "1")
                self.assertNotIn("--allow-model-download", run.call_args.args[0])
                self.assertNotIn("shell", run.call_args.kwargs)
            self.assertEqual(os.environ.get("HF_HUB_OFFLINE"), previous)
            with patch("document_evidence.reader.subprocess.run", return_value=result) as run:
                DoclingReader(allow_model_download=True).read(file)
                self.assertIn("--allow-model-download", run.call_args.args[0])

    def test_errors_never_include_private_parser_payload(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "private.pdf"
            file.write_bytes(b"%PDF-1.7 synthetic boundary fixture")
            result = subprocess.CompletedProcess([], 1, b'{"error":"private document text"}', b"private token")
            with patch("document_evidence.reader.subprocess.run", return_value=result):
                with self.assertRaisesRegex(DocumentReadError, "^DOCLING_WORKER_FAILED$"):
                    DoclingReader().read(file)
            with patch("document_evidence.reader.subprocess.run", side_effect=subprocess.TimeoutExpired("worker", 1)):
                with self.assertRaisesRegex(DocumentReadError, "DOCLING_TIMEOUT"):
                    DoclingReader().read(file)


class CliTest(unittest.TestCase):
    def test_private_output_does_not_overwrite_existing_files(self):
        document = normalize_docling(export(), name="synthetic.pdf", sha256=HASH)
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "result.json"
            with patch("document_evidence.cli.DoclingReader.read", return_value=document):
                self.assertEqual(cli(["synthetic.pdf", "--output", str(output)]), 0)
                original = output.read_bytes()
                self.assertEqual(json.loads(original)["document"]["sha256"], HASH)
                if os.name == "posix":
                    self.assertEqual(output.stat().st_mode & 0o777, 0o600)
                with contextlib.redirect_stderr(io.StringIO()) as errors:
                    self.assertEqual(cli(["synthetic.pdf", "--output", str(output)]), 2)
                self.assertEqual(errors.getvalue().strip(), "OUTPUT_UNAVAILABLE_OR_ALREADY_EXISTS")
                self.assertEqual(output.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
