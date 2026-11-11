"""Exercise 5: the four pre-check queries rank the expected page first; the Azure configuration keeps documented shapes."""
from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from contractor_lab import search_lab
from contractor_lab.cloud import LiveCallRefused
from contractor_lab.search_lab import bm25, load_pages, local_check, live_query, parse_search_response, validate_config


class SearchTests(unittest.TestCase):
    def test_each_precheck_query_ranks_its_page_first(self):
        rows = local_check()
        self.assertEqual(4, len(rows))
        self.assertTrue(all(row["passed"] for row in rows), rows)

    def test_a_payment_keyword_alone_is_not_a_confirmation(self):
        payment = next(row for row in local_check() if row["purpose"] == "payment")
        self.assertIsNone(payment["top"])
        self.assertTrue(payment["passed"])

    def test_bm25_prefers_the_page_with_the_rare_term(self):
        pages = [{"documentName": "a.pdf", "page": 1, "content": "Rechnung allgemein"},
                 {"documentName": "a.pdf", "page": 2, "content": "Gesamtvergütung brutto Gesamtvergütung"}]
        self.assertEqual(("a.pdf", 2), (bm25(pages, "Gesamtvergütung")[0][1]["documentName"], bm25(pages, "Gesamtvergütung")[0][1]["page"]))

    def test_the_shipped_configuration_passes_the_structural_checks(self):
        self.assertEqual([], validate_config())

    def test_a_skillset_that_reads_the_wrong_input_is_reported(self):
        original = search_lab.CONFIG
        with tempfile.TemporaryDirectory() as tmp:
            for name in ("datasource", "skillset", "index", "indexer"):
                shutil.copy(original / f"{name}.json", Path(tmp) / f"{name}.json")
            skillset = json.loads((Path(tmp) / "skillset.json").read_text(encoding="utf-8"))
            skillset["skills"][0]["inputs"][0]["source"] = "/document/content"
            (Path(tmp) / "skillset.json").write_text(json.dumps(skillset), encoding="utf-8")
            with mock.patch.object(search_lab, "CONFIG", Path(tmp)):
                self.assertIn("OCR skill must read /document/normalized_images/*", validate_config())

    def test_an_indexer_with_image_action_but_the_wrong_parsing_mode_is_reported(self):
        original = search_lab.CONFIG
        with tempfile.TemporaryDirectory() as tmp:
            for name in ("datasource", "skillset", "index", "indexer"):
                shutil.copy(original / f"{name}.json", Path(tmp) / f"{name}.json")
            indexer = json.loads((Path(tmp) / "indexer.json").read_text(encoding="utf-8"))
            indexer["parameters"]["configuration"]["parsingMode"] = "text"
            (Path(tmp) / "indexer.json").write_text(json.dumps(indexer), encoding="utf-8")
            with mock.patch.object(search_lab, "CONFIG", Path(tmp)):
                self.assertTrue(any("imageAction needs" in problem for problem in validate_config()))

    def test_search_results_map_to_document_page_and_score(self):
        sample = {"value": [{"@search.score": 9.1, "documentName": "nachtrag-n01-wv-2026-031.pdf", "page": 2, "sourceId": "aHR0cHM6"}]}
        self.assertEqual([{"documentName": "nachtrag-n01-wv-2026-031.pdf", "page": 2, "score": 9.1, "sourceId": "aHR0cHM6"}],
                         parse_search_response(sample))

    def test_live_search_refuses_without_opt_in(self):
        with mock.patch("urllib.request.urlopen", side_effect=AssertionError("network used")):
            with self.assertRaises(LiveCallRefused):
                live_query("Genehmigte Gesamtvergütung", "token", {"AZURE_SEARCH_ENDPOINT": "https://x.search.windows.net", "AZURE_SEARCH_INDEX": "i"})


if __name__ == "__main__":
    unittest.main()
