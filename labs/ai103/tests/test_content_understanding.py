"""Exercise 6: the request uses documented analyzer names and keys; nothing is sent."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from contractor_lab import LAB_ROOT
from contractor_lab.content_understanding import analyze_url, body_of, validate_request

SAMPLE = LAB_ROOT / "azure/content-understanding/analyze-document.request.json"


class ContentUnderstandingTests(unittest.TestCase):
    def check(self, document: dict) -> list[str]:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "request.json"
            path.write_text(json.dumps(document), encoding="utf-8")
            return validate_request(path)

    def test_the_shipped_sample_passes(self):
        self.assertEqual([], validate_request(SAMPLE))

    def test_the_analyzer_name_from_the_old_template_is_rejected(self):
        document = json.loads(SAMPLE.read_text(encoding="utf-8"))
        document["analyzerId"] = "prebuilt-documentAnalyzer"
        self.assertTrue(any("not a documented" in problem for problem in self.check(document)))

    def test_contentType_is_rejected_because_the_documented_key_is_mimeType(self):
        document = json.loads(SAMPLE.read_text(encoding="utf-8"))
        document["inputs"][0]["contentType"] = document["inputs"][0].pop("mimeType")
        problems = self.check(document)
        self.assertTrue(any("unknown input keys" in problem for problem in problems), problems)
        self.assertTrue(any("needs mimeType" in problem for problem in problems), problems)

    def test_an_input_needs_exactly_one_of_url_or_data(self):
        document = json.loads(SAMPLE.read_text(encoding="utf-8"))
        document["inputs"][0]["url"] = "https://example.invalid/x.pdf"
        self.assertTrue(any("exactly one of url or data" in problem for problem in self.check(document)))

    def test_the_analyzer_id_is_removed_from_the_body_and_placed_in_the_url(self):
        body = body_of(json.loads(SAMPLE.read_text(encoding="utf-8")))
        self.assertNotIn("analyzerId", body)
        self.assertEqual("https://x.services.ai.azure.com/contentunderstanding/analyzers/prebuilt-documentSearch:analyze?api-version=2025-11-01",
                         analyze_url("https://x.services.ai.azure.com/", "prebuilt-documentSearch"))


if __name__ == "__main__":
    unittest.main()
