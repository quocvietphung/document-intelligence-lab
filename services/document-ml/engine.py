"""Bounded local cohort experiments; model output never changes a document review."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from snapshot import load_snapshot, read_rows

METHOD = "isolation-forest-heldout-v1"
MINIMUM_DOCUMENTS = 30


def evaluate(directory, expected_hash=None, tracking_uri=None, models_root=None):
    import numpy as np
    import sklearn
    from sklearn.ensemble import IsolationForest

    start = time.monotonic()
    manifest, checksum = load_snapshot(directory, expected_hash)
    facts = {row["document_id"]: row for row in read_rows(directory, "document_facts")}
    groups = defaultdict(list)
    counts = defaultdict(int)
    fields = read_rows(directory, "field_observations")
    for field in fields:
        counts[(field["document_id"], field["field_key"])] += 1
    for field in fields:
        doc = facts.get(field["document_id"], {})
        if (field["quality"] == "VALID" and field["reviewed"] and field["amount"] is not None
                and field["currency"] and len(doc.get("original_sha256", "")) == 64
                and counts[(field["document_id"], field["field_key"])] == 1):
            groups[(doc["document_type"], field["field_key"], field["currency"])].append((field, doc["original_sha256"]))
    cohorts, scores, findings = [], [], []
    for key, candidates in sorted(groups.items()):
        # All copies/versions of the same source bytes stay together. Repeated originals
        # are excluded rather than overweighted or split between training and holdout.
        frequencies = defaultdict(int)
        for _, source in candidates:
            frequencies[source] += 1
        distinct = sorted(((row, source) for row, source in candidates if frequencies[source] == 1), key=lambda pair: pair[1])
        cohort = {"documentType": key[0], "field": key[1], "currency": key[2], "eligibleDocuments": len(distinct),
                  "minimumDocuments": MINIMUM_DOCUMENTS, "status": "INSUFFICIENT_BASELINE", "trainingDocuments": 0,
                  "testDocuments": 0, "flagged": 0, "baselineFlagged": 0}
        cohorts.append(cohort)
        if len(distinct) < MINIMUM_DOCUMENTS:
            continue
        split = len(distinct) * 4 // 5
        train, test = distinct[:split], distinct[split:]
        feature = lambda rows: np.array([[math.copysign(math.log1p(abs(float(row["amount"]))), float(row["amount"]))] for row, _ in rows])
        model = IsolationForest(n_estimators=100, contamination="auto", random_state=17, n_jobs=1).fit(feature(train))
        decision = model.decision_function(feature(test))
        train_amounts = np.array([float(row["amount"]) for row, _ in train])
        median = float(np.median(train_amounts))
        mad = float(np.median(np.abs(train_amounts - median)))
        cohort.update(status="COMPLETE", trainingDocuments=len(train), testDocuments=len(test),
                      trainingSourceHashes=[source for _, source in train], testSourceHashes=[source for _, source in test],
                      featureSchema="signed-log1p-amount-v1", threshold=0.0)
        if models_root is not None:
            cohort.update(save_model(model, Path(models_root) / hashlib.sha256(json.dumps(key).encode()).hexdigest()[:24],
                                     {"manifestSha256": checksum, "sourceHash": manifest["sourceHash"], "library": sklearn.__version__,
                                      "method": METHOD, "featureSchema": cohort["featureSchema"], "trainingSourceHashes": cohort["trainingSourceHashes"],
                                      "operationalApproval": False}))
        for (row, _), score in zip(test, decision, strict=True):
            flagged = bool(score < 0)
            # A zero MAD abstains; it is not a claim that every deviation is fraud.
            baseline = bool(abs(float(row["amount"]) - median) * .67448975 / mad > 3.5) if mad else None
            scores.append({"documentId": row["document_id"], "page": row["page"], "field": row["field_key"],
                           "sourceId": row["observation_id"], "currency": row["currency"], "decisionScore": float(score),
                           "flagged": flagged, "madFlagged": baseline, "sample": "holdout"})
            cohort["flagged"] += int(flagged)
            cohort["baselineFlagged"] += int(baseline is True)
            if flagged:
                findings.append({"id": hashlib.sha256((row["observation_id"] + METHOD).encode()).hexdigest()[:24],
                                 "documentId": row["document_id"], "page": row["page"], "field": row["field_key"],
                                 "code": "STATISTICAL_OUTLIER", "category": "statistical", "sourceIds": [row["observation_id"]]})
    result = {"method": METHOD, "sourceHash": manifest["sourceHash"], "etlRunId": manifest["runId"],
              "manifestSha256": checksum, "status": "COMPLETE" if any(c["status"] == "COMPLETE" for c in cohorts) else "INSUFFICIENT_BASELINE",
              "cohorts": cohorts, "scores": scores, "findings": findings, "library": "scikit-learn " + sklearn.__version__,
              "precision": None, "recall": None, "prAuc": None, "cloudCalls": 0,
              "elapsedMs": round((time.monotonic() - start) * 1000), "tracking": "NOT_REQUESTED",
              "limitations": ["Evaluation only; no model is promoted to operational use.",
                              "Lower decision scores indicate relative unusualness, not a fraud probability.",
                              "No labelled anomaly ground truth: precision, recall and PR-AUC are not measured.",
                              "Only reviewed, unambiguous amounts from distinct original hashes are eligible.",
                              "Training and holdout share no original PDF hashes; domain drift is not evaluated."]}
    result["limitations"].append("Related templates/vendors can still cross the split; hash separation alone does not establish statistical independence.")
    if tracking_uri:
        track(result, tracking_uri)
    return result


def save_model(model, directory, identity):
    """Private local artifacts only. No remote model loading or automatic promotion."""
    import joblib
    directory.mkdir(parents=True, exist_ok=True)
    artifact, record = directory / "model.joblib", directory / "model.json"
    if directory.is_symlink() or artifact.is_symlink() or record.is_symlink():
        raise ValueError("INVALID_MODEL_PATH")
    if record.exists():
        saved = json.loads(record.read_text())
        if any(saved.get(k) != v for k, v in identity.items()) or hashlib.sha256(artifact.read_bytes()).hexdigest() != saved.get("sha256"):
            raise ValueError("MODEL_VERSION_CONFLICT")
    else:
        # A crashed attempt may leave an unpublished file; metadata publishes it last.
        temporary = directory / "model.tmp"
        joblib.dump(model, temporary, compress=3)
        os.replace(temporary, artifact)
        saved = {**identity, "sha256": hashlib.sha256(artifact.read_bytes()).hexdigest()}
        atomic_json(record, saved)
    return {"modelSha256": saved["sha256"], "modelVersion": saved["sha256"][:24], "operationalApproval": False}


def track(result, uri):
    # Deliberate opt-in, with neither PDF text, raw values nor prompts in tracking.
    os.environ["MLFLOW_DISABLE_TELEMETRY"] = "true"
    import mlflow
    if not uri.startswith("sqlite:////"):
        raise ValueError("LOCAL_SQLITE_TRACKING_REQUIRED")
    location = Path(uri.removeprefix("sqlite:///"))
    location.parent.mkdir(parents=True, exist_ok=True)
    mlflow.set_tracking_uri(uri)
    client = mlflow.MlflowClient()
    name = "document-cohort-evaluation"
    experiment = client.get_experiment_by_name(name)
    if experiment is None:
        client.create_experiment(name, artifact_location=(location.parent / "artifacts").as_uri())
    mlflow.set_experiment(name)
    with mlflow.start_run() as run:
        mlflow.log_params({"method": METHOD, "feature_schema": "signed-log1p-amount-v1", "seed": 17,
                           "dataset_fingerprint": result["manifestSha256"], "source_hash": result["sourceHash"],
                           "status": result["status"], "library": result["library"], "labelled_ground_truth": False})
        mlflow.log_metrics({"cohorts": len(result["cohorts"]), "heldout_documents": len(result["scores"]),
                            "flagged": len(result["findings"]), "elapsed_ms": result["elapsedMs"]})
        versions = [c["modelSha256"] for c in result["cohorts"] if c.get("modelSha256")]
        if versions:
            mlflow.log_param("model_sha256", ",".join(versions))
        result["tracking"] = "RECORDED"
        result["trackingRunId"] = run.info.run_id


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False))
    os.replace(temp, path)


def work(root, etl_root):
    import re
    root, etl_root = Path(root), Path(etl_root)
    root.mkdir(parents=True, exist_ok=True)
    while True:
        (root / "heartbeat").touch()
        from classification import process as classify_documents
        classify_documents(root)
        for path in sorted((root / "queue").glob("*/*.input.json"))[:100]:
            result_path = path.with_name(path.name.replace(".input.json", ".result.json"))
            if result_path.exists() or path.is_symlink() or path.stat().st_size > 10_000:
                continue
            request = {}
            try:
                request = json.loads(path.read_text())
                scope, run = request["scope"], request["etlRunId"]
                if (request["format"] != "document-cohort-v1" or not re.fullmatch(r"[a-f0-9]{64}", scope)
                        or path.parent.name != scope or not re.fullmatch(r"etl-[a-f0-9-]{36}", run)
                        or not re.fullmatch(r"ml-[a-f0-9-]{36}", request["id"]) or path.name != request["id"] + ".input.json"):
                    raise ValueError("INVALID_REQUEST")
                output = evaluate(etl_root / "assets" / scope / run, request["manifestSha256"], os.environ.get("MLFLOW_TRACKING_URI"), root / "models" / scope / request["id"])
                if output["sourceHash"] != request["sourceHash"]:
                    raise ValueError("SOURCE_CHANGED")
                receipt = {"id": request["id"], "sourceHash": request["sourceHash"], "status": "COMPLETE", "result": output}
            except Exception:
                receipt = {"id": request.get("id", ""), "sourceHash": request.get("sourceHash", ""), "status": "FAILED", "errorCode": "COHORT_EVALUATION_FAILED"}
            receipt["finishedAt"] = datetime.now(timezone.utc).isoformat()
            atomic_json(result_path, receipt)
        (root / "heartbeat").touch()
        time.sleep(2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    worker = sub.add_parser("worker")
    worker.add_argument("--root", default="/data")
    worker.add_argument("--etl-root", default="/etl")
    single = sub.add_parser("evaluate")
    single.add_argument("--input", required=True)
    single.add_argument("--output", required=True)
    single.add_argument("--tracking-uri")
    single.add_argument("--models-root", help="Explicit private directory for versioned model artifacts")
    args = parser.parse_args()
    if args.command == "worker":
        work(args.root, args.etl_root)
    else:
        if Path(args.output).exists():
            parser.error("Output already exists; choose a new result path")
        atomic_json(args.output, evaluate(args.input, tracking_uri=args.tracking_uri, models_root=args.models_root))
