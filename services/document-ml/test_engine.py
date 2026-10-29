"""Synthetic contract fixtures; these tests do not measure real PDF anomaly accuracy."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "document-etl"))
import worker
from engine import evaluate
from snapshot import load_snapshot


def prepared(root, count=1, reviewed=True):
    scope = "a" * 64
    payload = {"format": "document-etl-v1", "id": "etl-" + str(uuid4()), "scope": scope, "sourceHash": "b" * 64,
               "time": "2026-10-29T18:00:00Z", "documents": []}
    for n in range(count):
        payload["documents"].append({"id": "fixture-" + str(n), "name": "synthetic-contract-fixture.pdf", "type": "invoice",
            "status": "verified" if reviewed else "review", "originalAvailable": True,
            "originalSha256": hashlib.sha256(f"synthetic-independent-source-{n}".encode()).hexdigest(),
            "pages": [{"number": 1, "text": "INR"}], "fields": [{"label": "invoiceTotal", "value": f"{100+n}.00", "page": 1}], "tables": []})
    directory = Path(root) / scope / payload["id"]
    worker.transform(payload, directory, use_dbt=False)
    return directory, payload


class CohortTest(unittest.TestCase):
    def test_tiny_pdf_set_abstains_and_has_no_invented_accuracy(self):
        with tempfile.TemporaryDirectory() as root:
            directory, _ = prepared(root)
            result = evaluate(directory)
            self.assertEqual(result["status"], "INSUFFICIENT_BASELINE")
            self.assertEqual(result["scores"], [])
            self.assertIsNone(result["precision"])
            self.assertEqual(result["cloudCalls"], 0)

    def test_training_and_holdout_have_disjoint_source_hashes(self):
        with tempfile.TemporaryDirectory() as root:
            directory, _ = prepared(root, 35)
            result = evaluate(directory)
            self.assertEqual(result["status"], "COMPLETE")
            cohort = result["cohorts"][0]
            self.assertFalse(set(cohort["trainingSourceHashes"]) & set(cohort["testSourceHashes"]))
            self.assertEqual(cohort["trainingDocuments"] + cohort["testDocuments"], 35)
            self.assertEqual(len(result["scores"]), 7)
            self.assertTrue(all(r["sample"] == "holdout" for r in result["scores"]))
            self.assertEqual(result["scores"], evaluate(directory)["scores"])

    def test_model_artifacts_are_source_bound_versioned_and_not_promoted(self):
        with tempfile.TemporaryDirectory() as root:
            directory, _ = prepared(root, 35)
            models = Path(root) / "private-models"
            result = evaluate(directory, models_root=models)
            model = next(models.glob("*/model.joblib"))
            self.assertEqual(hashlib.sha256(model.read_bytes()).hexdigest(), result["cohorts"][0]["modelSha256"])
            metadata = json.loads(model.with_name("model.json").read_text())
            self.assertFalse(metadata["operationalApproval"])
            self.assertEqual(metadata["manifestSha256"], result["manifestSha256"])
            self.assertEqual(evaluate(directory, models_root=models)["cohorts"][0]["modelSha256"], result["cohorts"][0]["modelSha256"])
            model.write_bytes(b"tampered")
            with self.assertRaisesRegex(ValueError, "MODEL_VERSION_CONFLICT"):
                evaluate(directory, models_root=models)

    def test_unreviewed_values_are_not_training_data(self):
        with tempfile.TemporaryDirectory() as root:
            directory, _ = prepared(root, 35, False)
            self.assertEqual(evaluate(directory)["cohorts"], [])

    def test_currencies_are_separate_and_repeated_originals_cannot_fill_a_cohort(self):
        with tempfile.TemporaryDirectory() as root:
            _, payload = prepared(root, 35)
            for n, doc in enumerate(payload["documents"]):
                doc["pages"][0]["text"] = "EUR" if n < 20 else "INR"
            payload["id"] = "etl-" + str(uuid4())
            directory = Path(root) / payload["scope"] / payload["id"]
            worker.transform(payload, directory, False)
            result = evaluate(directory)
            self.assertEqual(result["status"], "INSUFFICIENT_BASELINE")
            self.assertEqual({c["currency"]: c["eligibleDocuments"] for c in result["cohorts"]}, {"EUR": 20, "INR": 15})
            for doc in payload["documents"]:
                doc["originalSha256"] = "c" * 64
                doc["pages"][0]["text"] = "INR"
            payload["id"] = "etl-" + str(uuid4())
            directory = Path(root) / payload["scope"] / payload["id"]
            worker.transform(payload, directory, False)
            self.assertEqual(evaluate(directory)["cohorts"][0]["eligibleDocuments"], 0)

    def test_artifact_tampering_is_rejected_before_training(self):
        with tempfile.TemporaryDirectory() as root:
            directory, _ = prepared(root)
            (directory / "silver.parquet").write_bytes(b"tampered")
            with self.assertRaisesRegex(ValueError, "ARTIFACT_HASH_MISMATCH"):
                evaluate(directory)

    def test_wrong_scope_symlink_and_manifest_version_are_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            directory, _ = prepared(root)
            with self.assertRaisesRegex(ValueError, "MANIFEST_CHANGED"):
                load_snapshot(directory, "f" * 64)
            alias = Path(root) / "alias"
            alias.symlink_to(directory, target_is_directory=True)
            with self.assertRaises(ValueError):
                load_snapshot(alias)
            manifest = json.loads((directory / "manifest.json").read_text())
            manifest["scope"] = "c" * 64
            (directory / "manifest.json").write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError, "SCOPE_MISMATCH"):
                load_snapshot(directory)

    def test_actual_local_mlflow_records_only_parameters_and_measured_counts(self):
        import mlflow
        with tempfile.TemporaryDirectory() as root:
            directory, _ = prepared(root)
            uri = "sqlite:///" + str(Path(root) / "tracking" / "mlflow.db")
            result = evaluate(directory, tracking_uri=uri)
            run = mlflow.MlflowClient(tracking_uri=uri).get_run(result["trackingRunId"])
            self.assertEqual(run.data.params["status"], "INSUFFICIENT_BASELINE")
            self.assertEqual(run.data.metrics["heldout_documents"], 0)
            self.assertNotIn("precision", run.data.metrics)
            self.assertNotIn("synthetic-contract-fixture.pdf", json.dumps(run.data.to_dictionary()))


if __name__ == "__main__":
    unittest.main()
