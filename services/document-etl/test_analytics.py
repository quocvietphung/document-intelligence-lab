import tempfile
import unittest
from pathlib import Path
from test_worker import snapshot
import worker


class AnalyticsTest(unittest.TestCase):
    def test_real_table_cells_preserve_values_and_expose_sum_difference(self):
        payload = snapshot("100.00 INR")
        doc = payload["documents"][0]
        doc.update(type="invoice", originalSha256="e" * 64)
        doc["tables"] = [{"page": 1, "cells": [
            {"row": 0, "column": 0, "text": "Description"}, {"row": 0, "column": 1, "text": "Gross worth"},
            {"row": 1, "column": 0, "text": "Item A"}, {"row": 1, "column": 1, "text": "80.00"}]}]
        with tempfile.TemporaryDirectory() as root:
            result = worker.transform(payload, Path(root) / payload["id"], False)
            report = result["analytics"]
            self.assertEqual(report["invoiceLines"], 1)
            self.assertEqual(report["reviewedDocuments"], 0)
            self.assertEqual(result["gold"], 0)
            findings = {f["code"]: f for f in report["findings"]}
            self.assertIn("REQUIRED_INVOICE_FIELD_MISSING", findings)
            finding = findings["LINE_SUM_DIFFERS_FROM_RECORDED_TOTAL"]
            self.assertEqual(finding["documentId"], "invoice")
            self.assertEqual(finding["page"], 1)
            self.assertEqual(len(finding["sourceIds"]), 1)
            self.assertTrue(all((Path(root) / payload["id"] / a["name"]).exists() for a in result["artifacts"]))

    def test_ambiguous_or_merged_table_cells_do_not_create_a_calculated_mismatch(self):
        payload = snapshot()
        doc = payload["documents"][0]
        doc.update(type="invoice")
        doc["tables"] = [{"page": 1, "cells": [{"row": 0, "column": 0, "text": "Description"},
            {"row": 0, "column": 1, "text": "Gross worth"}, {"row": 1, "column": 0, "text": "A"},
            {"row": 1, "column": 1, "text": "1.234", "columnSpan": 2}]}]
        with tempfile.TemporaryDirectory() as root:
            result = worker.transform(payload, Path(root) / payload["id"], False)
            self.assertEqual(result["analytics"]["invoiceLines"], 0)
            self.assertNotIn("LINE_SUM_DIFFERS_FROM_RECORDED_TOTAL", {f["code"] for f in result["analytics"]["findings"]})

    def test_insurance_text_does_not_invent_invoice_fields(self):
        payload = snapshot()
        payload["documents"][0].update(type="insurance", fields=[])
        with tempfile.TemporaryDirectory() as root:
            result = worker.transform(payload, Path(root) / payload["id"], False)
            self.assertEqual({f["code"] for f in result["analytics"]["findings"]}, {"NO_STRUCTURED_FIELDS", "AMBIGUOUS_DATE_PRESERVED"})


if __name__ == "__main__":
    unittest.main()
