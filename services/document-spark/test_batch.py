import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "document-ml"))
from test_engine import prepared
from batch import run


@unittest.skipUnless(os.environ.get("TEST_SPARK") == "1", "Explicitly enable local Java/Spark test")
class SparkTest(unittest.TestCase):
    def test_actual_spark_preserves_decimal_gold_and_reports_synthetic_replication(self):
        with tempfile.TemporaryDirectory() as root:
            directory, _ = prepared(root, 2)
            result = run(directory, Path(root) / "spark-result", repeat=3)
            self.assertTrue(result["parity"])
            self.assertEqual(result["rows"], 6)
            self.assertEqual(result["sourceDocuments"], 2)
            self.assertEqual(result["datasetKind"], "synthetic-repetition")
            self.assertEqual(result["totals"][0]["total"], "603.000000")
            self.assertFalse(result["distributedCluster"])
            self.assertGreater(result["sparkStartupAndQueryMs"], 0)


if __name__ == "__main__":
    unittest.main()
