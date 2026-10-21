"""Interview exercises, deliberately separate from the application's AI feature count.

Use a private research bundle exported from real PDF evidence. No training model,
SMOTE performance, cloud run or production claim is fabricated by this module.
"""
from collections import Counter
from math import isqrt
import json
import random
import sys


def parity(values):
    return [n for n in values if n % 2 == 0], [n for n in values if n % 2 != 0]


def is_prime(number):
    return number >= 2 and all(number % divisor for divisor in range(2, isqrt(number) + 1))


def class_weights(labels):
    counts = Counter(labels)
    return {label: len(labels) / (len(counts) * count) for label, count in counts.items()}


def resample_training(rows, label_key, strategy, seed=42):
    """Call ONLY after splitting by source PDF; never resample held-out test rows."""
    groups = {}
    for row in rows:
        groups.setdefault(row[label_key], []).append(row)
    if not groups:
        return []
    randomizer = random.Random(seed)
    target = max(map(len, groups.values())) if strategy == "over" else min(map(len, groups.values()))
    if strategy not in {"over", "under"}:
        raise ValueError("Use over or under; SMOTE requires a separate justified numeric-feature experiment")
    return [row for values in groups.values() for row in (values + randomizer.choices(values, k=target - len(values)) if strategy == "over" else randomizer.sample(values, target))]


def classification_metrics(expected, predicted):
    if not expected or len(expected) != len(predicted):
        raise ValueError("Paired independent reference and predicted labels required")
    classes = sorted(set(expected) | set(predicted))
    confusion = {label: Counter() for label in classes}
    rows = {}
    for truth, actual in zip(expected, predicted):
        confusion[truth][actual] += 1
    for label in classes:
        tp = sum(a == b == label for a, b in zip(expected, predicted))
        fp = sum(a != label and b == label for a, b in zip(expected, predicted))
        fn = sum(a == label and b != label for a, b in zip(expected, predicted))
        rows[label] = {"precision": tp / (tp + fp) if tp + fp else 0, "recall": tp / (tp + fn) if tp + fn else 0,
                       "f1": 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else 0, "support": expected.count(label)}
    micro = sum(a == b for a, b in zip(expected, predicted)) / len(expected)
    return {"perClass": rows, "confusion": {k: dict(v) for k, v in confusion.items()}, "macroF1": sum(r["f1"] for r in rows.values()) / len(classes),
            "weightedF1": sum(r["f1"] * r["support"] for r in rows.values()) / len(expected), "microF1": micro}


def inspect_bundle(bundle):
    if bundle.get("format") != "document-research-assets-v1":
        raise ValueError("Export a private research bundle from Data Pipelines first")
    documents = bundle.get("silver", [])
    # Concrete PDF page numbers connect the Python exercises to document processing.
    pages = [page["number"] for doc in documents for page in doc.get("pages", [])]
    even, odd = parity(pages)
    return {"documents": [{"id": d["documentId"], "pages": len(d.get("pages", [])), "fields": len(d.get("fields", []))} for d in documents],
            "pageExercises": {"even": even, "odd": odd, "primePageNumbers": [n for n in pages if is_prime(n)]},
            "limitations": "Page arithmetic is a Python exercise, not an AI feature or model-quality score. Classification requires independent type labels; no score is invented here."}


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 scripts/practice-document-data.py /private/path/research-bundle.json")
    with open(sys.argv[1], encoding="utf-8") as source:
        print(json.dumps(inspect_bundle(json.load(source)), indent=2))
