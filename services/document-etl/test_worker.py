import importlib.util
import json
import shutil
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

spec = importlib.util.spec_from_file_location("worker", Path(__file__).with_name("worker.py"))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


def snapshot(value="1,844,673.60", reviewed=False):
    return {"format": "document-etl-v1", "id": "etl-" + str(uuid4()), "scope": "a" * 64, "sourceHash": "b" * 64,
            "time": "2026-10-21T18:00:00Z", "documents": [{"id": "invoice", "name": "kaggle-invoice-51109301.pdf", "status": "verified" if reviewed else "review", "originalAvailable": True,
            "pages": [{"number": 1, "text": "INR. Date of issue: 03/07/2023"}], "fields": [{"label": "invoiceTotal", "page": 1, "value": value}], "tables": []}]}


class MoneyTest(unittest.TestCase):
    def test_shared_python_library_money_contract(self):
        fixture = json.loads((Path(__file__).resolve().parents[2] / "python/src/document_evidence/contracts/validation-cases.json").read_text())
        for row in fixture["money"]:
            with self.subTest(raw=row["raw"]):
                amount, currency, quality = worker.normalize_money(row["raw"], row["context"])
                self.assertEqual(str(amount) if amount is not None else None, row["amount"])
                self.assertEqual(currency, row["currency"])
                self.assertEqual(quality, row["status"])

    def test_locale_and_signs_preserve_currency(self):
        self.assertEqual(worker.normalize_money("2.967,11 EUR", ""), (Decimal("2967.11"), "EUR", "VALID"))
        self.assertEqual(worker.normalize_money("-1,844,673.60", "INR"), (Decimal("-1844673.60"), "INR", "VALID"))

    def test_ambiguous_values_never_become_guessed_amounts(self):
        for raw, context in [("1.234", "EUR"), ("100", "EUR USD"), ("100", "")]:
            self.assertIsNone(worker.normalize_money(raw, context)[0])

    def test_decimal_comma_without_thousands_separator(self):
        for raw, expected in [("2967,11 EUR", "2967.11"), ("1000,00 EUR", "1000.00"), ("-12345,67 €", "-12345.67"), ("2.967,11 EUR", "2967.11")]:
            with self.subTest(raw=raw):
                self.assertEqual(worker.normalize_money(raw, ""), (Decimal(expected), "EUR", "VALID"))
        for raw in ["29.67,11 EUR", "2.96.711,00 EUR", "2967,1 EUR", "1,234 EUR"]:
            self.assertIsNone(worker.normalize_money(raw, "")[0])

    @unittest.skipUnless(shutil.which("dbt"), "Install the pinned ETL dependencies for the real dbt check")
    def test_reviewed_decimal_comma_amount_reaches_gold_without_changing_raw_value(self):
        with tempfile.TemporaryDirectory() as folder:
            payload = snapshot("2967,11 EUR", reviewed=True)
            payload["documents"][0]["pages"][0]["text"] = "Invoice total: 2967,11 EUR"
            result = worker.transform(payload, Path(folder) / payload["id"], use_dbt=True)
            self.assertEqual(result["gold"], 1)
            self.assertEqual(result["totals"][0]["total"], "2967.110000")
            self.assertEqual(result["totals"][0]["currency"], "EUR")
            self.assertEqual(payload["documents"][0]["fields"][0]["value"], "2967,11 EUR")

    def test_gold_requires_human_review_and_records_ambiguous_dates(self):
        with tempfile.TemporaryDirectory() as folder:
            payload = snapshot()
            result = worker.transform(payload, Path(folder) / payload["id"], use_dbt=False)
            self.assertEqual(result["gold"], 0)
            self.assertEqual(result["silver"], 1)
            self.assertEqual(result["qualityIssues"][0]["code"], "AMBIGUOUS_DATE_PRESERVED")
            self.assertEqual(worker.transform(payload, Path(folder) / payload["id"], use_dbt=False), result)

    def test_scd2_retains_old_version_and_gold_is_currency_scoped(self):
        with tempfile.TemporaryDirectory() as folder:
            first = snapshot(reviewed=True)
            worker.transform(first, Path(folder) / first["id"], use_dbt=False)
            second = snapshot("100.00", reviewed=True)
            second["time"] = "2026-10-21T19:00:00Z"
            second["sourceHash"] = "c" * 64
            result = worker.transform(second, Path(folder) / second["id"], use_dbt=False)
            self.assertEqual(result["historyVersions"], 2)
            self.assertEqual(result["totals"][0]["total"], "100.000000")
            self.assertEqual(result["totals"][0]["currency"], "INR")
            self.assertTrue(all((Path(folder) / second["id"] / x["name"]).read_bytes().startswith(b"PAR1") for x in result["artifacts"]))

    def test_invalid_page_and_missing_original_rejected(self):
        payload = snapshot()
        payload["documents"][0]["originalAvailable"] = False
        with self.assertRaises(ValueError):
            worker.validate(payload)

    @unittest.skipUnless(shutil.which("dbt"), "Install the pinned ETL dependencies for the real dbt check")
    def test_real_dbt_build_has_verified_gold_and_no_cloud_service(self):
        with tempfile.TemporaryDirectory() as folder:
            payload = snapshot(reviewed=True)
            result = worker.transform(payload, Path(folder) / payload["id"], use_dbt=True)
            self.assertTrue(result["dbtVerified"])
            self.assertEqual(result["totals"][0]["currency"], "INR")
            self.assertEqual(result["totals"][0]["total"], "1844673.600000")

    def test_duplicate_fields_are_quarantined_not_summed(self):
        with tempfile.TemporaryDirectory() as folder:
            payload = snapshot(reviewed=True)
            payload["documents"][0]["fields"] *= 2
            result = worker.transform(payload, Path(folder) / payload["id"], use_dbt=False)
            self.assertEqual(result["gold"], 0)
            self.assertEqual(sum(q["code"] == "DUPLICATE_FIELD" for q in result["qualityIssues"]), 2)


if __name__ == "__main__":
    unittest.main()
