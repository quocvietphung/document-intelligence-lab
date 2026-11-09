"""Production ETL path (DuckDB Bronze -> Silver -> Gold) exercised with an approved fictional PDF.

The fixture is services/credit-api/src/main/resources/real-estate/fictional-construction-invoice.pdf,
which is marked as an invented research document. Text is extracted locally with pypdf (the same
dependency the ETL image installs), and every transform runs with outbound network connections blocked,
so these tests prove that no fixture content is sent to Azure or any other service.
"""

import hashlib
import importlib.util
import json
import shutil
import socket
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest import mock
from uuid import uuid4

import duckdb
from pypdf import PdfReader

spec = importlib.util.spec_from_file_location("worker", Path(__file__).with_name("worker.py"))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)

REPO = Path(__file__).resolve().parents[2]
FIXTURE = REPO / "services/credit-api/src/main/resources/real-estate/fictional-construction-invoice.pdf"


class NetworkBlocked(AssertionError):
    pass


@contextmanager
def no_network():
    """Fail the test if anything tries to open an outbound connection."""
    def refuse(*args, **kwargs):
        raise NetworkBlocked("network access attempted during an offline ETL test")

    with mock.patch.object(socket.socket, "connect", refuse), mock.patch.object(socket, "create_connection", refuse):
        yield


def pdf_snapshot(path=FIXTURE, reviewed=True, run_id=None):
    """Build a document-etl-v1 snapshot from a permitted PDF, as the Java extraction step would."""
    data = path.read_bytes()
    if not data.startswith(b"%PDF-"):
        raise ValueError("NOT_A_PDF")
    pages = [{"number": index, "text": page.extract_text() or ""} for index, page in enumerate(PdfReader(path).pages, start=1)]
    fields = []
    for page in pages:
        lines = [line.strip() for line in page["text"].splitlines()]
        for position, line in enumerate(lines[:-1]):
            if line == "Rechnungsbetrag:":
                fields.append({"label": "invoiceTotal", "page": page["number"], "value": lines[position + 1]})
    return {
        "format": "document-etl-v1",
        "id": run_id or "etl-" + str(uuid4()),
        "scope": hashlib.sha256(b"fictional-tenant|real-estate").hexdigest(),
        "sourceHash": hashlib.sha256(data).hexdigest(),
        "time": "2026-11-09T10:00:00Z",
        "documents": [{
            "id": "fictional-construction-invoice",
            "name": path.name,
            "status": "verified" if reviewed else "review",
            "originalAvailable": True,
            "pages": pages,
            "fields": fields,
            "tables": [],
        }],
    }


def query(folder, sql, params=()):
    db = duckdb.connect(str(folder.parent / "history.duckdb"), read_only=True)
    try:
        return db.execute(sql, list(params)).fetchall()
    finally:
        db.close()


class ProductionFlowTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def run_transform(self, payload, use_dbt=False):
        folder = self.root / payload["id"]
        if use_dbt:  # dbt runs as a subprocess; the socket patch cannot reach it
            return folder, worker.transform(payload, folder, use_dbt=True)
        with no_network():
            return folder, worker.transform(payload, folder, use_dbt=False)

    def test_network_guard_is_effective(self):
        # Without this check, a broken guard would make every "offline" assertion meaningless.
        with self.assertRaises(NetworkBlocked), no_network():
            socket.create_connection(("192.0.2.1", 443), timeout=1)

    def test_fixture_is_fictional_and_yields_a_labelled_amount(self):
        payload = pdf_snapshot()
        text = payload["documents"][0]["pages"][0]["text"]
        self.assertIn("FIKTIVES FORSCHUNGSDOKUMENT", text)
        self.assertEqual(payload["documents"][0]["fields"], [{"label": "invoiceTotal", "page": 1, "value": "198.250,00 EUR"}])

    def test_pdf_flows_to_bronze_silver_gold_with_provenance(self):
        payload = pdf_snapshot()
        folder, manifest = self.run_transform(payload)

        self.assertEqual(manifest["sourceHash"], hashlib.sha256(FIXTURE.read_bytes()).hexdigest())
        self.assertEqual((manifest["bronze"], manifest["silver"]), (1, 1))

        bronze = query(folder, "SELECT document_id, content_hash, raw_json FROM bronze_documents WHERE run_id=?", [payload["id"]])
        self.assertEqual(len(bronze), 1)
        document_id, content_hash, raw_json = bronze[0]
        self.assertEqual(document_id, "fictional-construction-invoice")
        self.assertRegex(content_hash, r"^[a-f0-9]{64}$")
        self.assertEqual(json.loads(raw_json)["name"], FIXTURE.name)

        silver = query(folder, "SELECT document_id, page, field_key, raw_value, CAST(amount AS VARCHAR), currency, quality, reviewed "
                               "FROM silver_fields WHERE run_id=?", [payload["id"]])
        self.assertEqual(silver, [("fictional-construction-invoice", 1, "invoiceTotal", "198.250,00 EUR", "198250.000000", "EUR", "VALID", True)])
        # The cited page really contains the raw value: provenance is checkable against the PDF.
        self.assertIn("198.250,00 EUR", payload["documents"][0]["pages"][0]["text"])

        self.assertEqual(manifest["totals"], [{"field": "invoiceTotal", "currency": "EUR", "observations": 1, "total": "198250.000000"}])
        for artifact in manifest["artifacts"]:
            produced = folder / artifact["name"]
            self.assertTrue(produced.is_file(), artifact["name"])
            self.assertEqual(hashlib.sha256(produced.read_bytes()).hexdigest(), artifact["sha256"])

    def test_unreviewed_values_stay_out_of_gold(self):
        payload = pdf_snapshot(reviewed=False)
        _, manifest = self.run_transform(payload)
        self.assertEqual(manifest["silver"], 1)
        self.assertEqual(manifest["totals"], [])

    def test_rerun_is_idempotent_and_conflicting_rerun_is_refused(self):
        payload = pdf_snapshot()
        folder, first = self.run_transform(payload)
        _, second = self.run_transform(payload)
        self.assertEqual(first, second)
        self.assertEqual(query(folder, "SELECT count(*) FROM bronze_documents WHERE run_id=?", [payload["id"]]), [(1,)])
        self.assertEqual(query(folder, "SELECT count(*) FROM silver_fields WHERE run_id=?", [payload["id"]]), [(1,)])
        self.assertEqual(query(folder, "SELECT count(*) FROM etl_runs WHERE run_id=?", [payload["id"]]), [(1,)])

        conflicting = json.loads(json.dumps(payload))
        conflicting["sourceHash"] = "c" * 64
        with self.assertRaisesRegex(ValueError, "IDEMPOTENCY_CONFLICT"), no_network():
            worker.transform(conflicting, folder, use_dbt=False)

    def test_same_pdf_in_a_new_run_keeps_one_current_version(self):
        first = pdf_snapshot()
        folder, _ = self.run_transform(first)
        second = pdf_snapshot()
        with no_network():
            worker.transform(second, self.root / second["id"], use_dbt=False)
        versions = query(folder, "SELECT count(*), sum(CASE WHEN is_current THEN 1 ELSE 0 END) FROM document_versions "
                                 "WHERE document_id='fictional-construction-invoice'")
        self.assertEqual(versions, [(1, 1)])  # unchanged content is not duplicated in history

    def test_malformed_contracts_are_rejected(self):
        payload = pdf_snapshot()
        payload["documents"][0]["pages"][0]["number"] = 0
        with self.assertRaisesRegex(ValueError, "INVALID_PAGE"):
            worker.validate(payload)
        payload = pdf_snapshot()
        payload["documents"][0]["originalAvailable"] = False
        with self.assertRaisesRegex(ValueError, "ORIGINAL_REQUIRED"):
            worker.validate(payload)
        payload = pdf_snapshot()
        payload["sourceHash"] = "not-a-hash"
        with self.assertRaisesRegex(ValueError, "INVALID_SCOPE"):
            worker.validate(payload)

    def test_non_pdf_input_is_rejected_before_the_etl(self):
        bogus = self.root / "not-really.pdf"
        bogus.write_bytes(b"<html>not a pdf</html>")
        with self.assertRaisesRegex(ValueError, "NOT_A_PDF"):
            pdf_snapshot(bogus)

    def test_fields_without_a_source_page_or_value_are_quarantined_not_promoted(self):
        payload = pdf_snapshot()
        payload["documents"][0]["fields"] = [
            {"label": "invoiceTotal", "page": 2, "value": "198.250,00 EUR"},
            {"label": "invoiceTotal", "page": 1, "value": "  "},
        ]
        _, manifest = self.run_transform(payload)
        self.assertEqual(sorted(q["code"] for q in manifest["qualityIssues"]), ["EMPTY_VALUE", "SOURCE_PAGE_MISSING"])
        self.assertEqual(manifest["totals"], [])

    @unittest.skipUnless(shutil.which("dbt"), "Install the pinned ETL dependencies for the real dbt check")
    def test_real_dbt_build_verifies_the_pdf_flow(self):
        payload = pdf_snapshot()
        _, manifest = self.run_transform(payload, use_dbt=True)
        self.assertTrue(manifest["dbtVerified"])
        self.assertEqual(manifest["totals"][0]["total"], "198250.000000")


if __name__ == "__main__":
    unittest.main()
