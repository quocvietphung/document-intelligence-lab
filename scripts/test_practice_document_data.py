import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("practice", Path(__file__).with_name("practice-document-data.py"))
practice = importlib.util.module_from_spec(spec)
spec.loader.exec_module(practice)


class PracticeTest(unittest.TestCase):
    def test_page_parity_and_primality_include_boundary_values(self):
        self.assertEqual(practice.parity([-2, -1, 0, 1, 2, 3]), ([-2, 0, 2], [-1, 1, 3]))
        for number in [-2, 0, 1, 4, 9, 25, 49]:
            self.assertFalse(practice.is_prime(number))
        for number in [2, 3, 5, 97]:
            self.assertTrue(practice.is_prime(number))

    def test_classification_macro_exposes_minority_failure(self):
        metrics = practice.classification_metrics(["invoice"] * 9 + ["policy"], ["invoice"] * 10)
        self.assertEqual(metrics["microF1"], .9)
        self.assertEqual(metrics["perClass"]["policy"]["recall"], 0)
        self.assertLess(metrics["macroF1"], metrics["microF1"])

    def test_resampling_never_mutates_or_uses_test_rows(self):
        train = [{"id": "a", "type": "invoice"}, {"id": "b", "type": "invoice"}, {"id": "c", "type": "policy"}]
        self.assertEqual(len(practice.resample_training(train, "type", "over")), 4)
        self.assertEqual(len(practice.resample_training(train, "type", "under")), 2)
        self.assertEqual(len(train), 3)
        self.assertGreater(practice.class_weights([r["type"] for r in train])["policy"], practice.class_weights([r["type"] for r in train])["invoice"])

    def test_real_bundle_provenance_is_required_without_inventing_accuracy(self):
        result = practice.inspect_bundle({"format": "document-research-assets-v1", "silver": [{"documentId": "invoice", "pages": [{"number": 1}], "fields": []}]})
        self.assertEqual(result["pageExercises"]["odd"], [1])
        self.assertNotIn("accuracy", result)


if __name__ == "__main__":
    unittest.main()
