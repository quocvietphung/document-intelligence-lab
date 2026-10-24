"""Opt-in actual local PDF conversion. No mocked success and no Java/Docker call."""
import os
from pathlib import Path
import unittest

from document_evidence import DoclingReader, check_evidence, validate_document


@unittest.skipUnless(os.environ.get("TEST_PYTHON_PDF"), "Set TEST_PYTHON_PDF for real Docling inference")
class DoclingSmokeTest(unittest.TestCase):
    def test_actual_local_pdf(self):
        document = DoclingReader(artifacts_path=os.environ.get("DOCLING_ARTIFACTS_PATH"),
                                 allow_model_download=os.environ.get("TEST_ALLOW_MODEL_DOWNLOAD") == "1",
                                 timeout_seconds=int(os.environ.get("TEST_DOCLING_TIMEOUT", "180"))).read(Path(os.environ["TEST_PYTHON_PDF"]))
        self.assertTrue(document.sources)
        self.assertTrue(document.pages)
        self.assertFalse(document.human_approved)
        for source in document.sources:
            self.assertIsNone(source.confidence)
            self.assertTrue(check_evidence(document, source.id, source.text))
        self.assertTrue(validate_document(document).human_review_required)
        if os.environ.get("TEST_PYTHON_EXPECT_TEXT"):
            self.assertIn(os.environ["TEST_PYTHON_EXPECT_TEXT"], "\n".join(p.text for p in document.pages))
        if os.environ.get("TEST_PYTHON_MIN_TABLES"):
            self.assertGreaterEqual(len(document.tables), int(os.environ["TEST_PYTHON_MIN_TABLES"]))


if __name__ == "__main__":
    unittest.main()
