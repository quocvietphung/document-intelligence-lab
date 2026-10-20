import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("foundry_bridge", Path(__file__).with_name("evaluate-foundry.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class EvaluationConfigurationTests(unittest.TestCase):
    def test_default_has_no_sdk_import_or_cloud_call(self):
        rows = module.validate({"schemaVersion": "foundry-evaluation-input-v1", "rows": [
            {"id": "synthetic-answer", "query": "Total?", "response": "INR 12", "context": "Total INR 12", "ground_truth": ""}]})
        result = module.run(rows)
        self.assertFalse(result["cloudCalled"])
        self.assertEqual(result["completenessReady"], 0)

    def test_missing_context_is_not_groundedness(self):
        with self.assertRaises(ValueError):
            module.validate({"schemaVersion": "foundry-evaluation-input-v1", "rows": [{"id": "x", "query": "q", "response": "r", "context": ""}]})


if __name__ == "__main__":
    unittest.main()
