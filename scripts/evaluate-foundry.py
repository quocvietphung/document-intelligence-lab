"""Explicit Azure AI Evaluation SDK bridge. Default is dependency-free input validation, NOT inference."""
import argparse
import json
import logging
import os
import re
from pathlib import Path
from urllib.parse import urlparse


def validate(data):
    if data.get("schemaVersion") != "foundry-evaluation-input-v1":
        raise ValueError("Unsupported evaluation export")
    rows = data.get("rows")
    if not isinstance(rows, list) or not 1 <= len(rows) <= 10:
        raise ValueError("Use one to ten explicitly reviewed examples")
    for row in rows:
        for field, limit in (("id", 80), ("query", 2000), ("response", 12000), ("context", 40000)):
            if not isinstance(row.get(field), str) or not row[field].strip() or len(row[field]) > limit:
                raise ValueError("Invalid bounded evaluation row")
        if not isinstance(row.get("ground_truth", ""), str) or len(row.get("ground_truth", "")) > 12000:
            raise ValueError("Invalid independently checked reference answer")
    return rows


def run(rows, execute=False):
    if not execute:
        return {"mode": "validation-only", "cloudCalled": False, "rows": len(rows),
                "completenessReady": sum(bool(r.get("ground_truth", "").strip()) for r in rows)}
    endpoint = os.environ.get("AZURE_EVALUATION_ENDPOINT", "")
    deployment = os.environ.get("AZURE_EVALUATION_DEPLOYMENT", "")
    uri = urlparse(endpoint)
    if uri.scheme != "https" or not re.fullmatch(r"[a-zA-Z0-9-]+\.openai\.azure\.com", uri.hostname or "") or uri.query or uri.fragment or uri.username or uri.port is not None or uri.path not in ("", "/"):
        raise ValueError("Configure your Azure OpenAI resource-root evaluation endpoint")
    if not re.fullmatch(r"[a-zA-Z0-9_.-]{1,100}", deployment):
        raise ValueError("Configure an explicit judge deployment")
    # Never print SDK traces containing source excerpts, answers or bearer credentials.
    logging.disable(logging.CRITICAL)
    os.environ["OTEL_SDK_DISABLED"] = "true"
    from azure.identity import AzureCliCredential
    from azure.ai.evaluation import GroundednessEvaluator, RelevanceEvaluator, ResponseCompletenessEvaluator
    configuration = {"azure_endpoint": endpoint, "azure_deployment": deployment,
                     "api_version": "2024-10-21"}
    credential = AzureCliCredential()
    grounded = GroundednessEvaluator(model_config=configuration, credential=credential)
    relevant = RelevanceEvaluator(model_config=configuration, credential=credential)
    complete = ResponseCompletenessEvaluator(model_config=configuration, credential=credential)
    results = []
    for row in rows:
        value = {"id": row["id"], "groundedness": grounded(query=row["query"], response=row["response"], context=row["context"]),
                 "relevance": relevant(query=row["query"], response=row["response"])}
        value["completeness"] = complete(response=row["response"], ground_truth=row["ground_truth"]) if row.get("ground_truth", "").strip() else {"status": "NOT_EVALUATED", "reason": "No human-checked reference answer"}
        results.append(value)
    return {"schemaVersion": "foundry-evaluation-result-v1", "provider": "azure-ai-evaluation-sdk", "model": deployment,
            "cloudCalled": True, "humanApproved": False, "rows": results,
            "limitation": "Model-judge results are not factual accuracy, source authenticity or human approval; no Foundry project upload is performed"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("--execute-cloud", action="store_true")
    parser.add_argument("--output")
    args = parser.parse_args()
    try:
        path = Path(args.input)
        if path.stat().st_size > 700_000:
            raise ValueError("Evaluation export too large")
        rows = validate(json.loads(path.read_text()))
        if args.execute_cloud and not args.output:
            raise ValueError("Set a new private output file before executing billable evaluation")
        # Reserve output before any billable call. An existing result is never silently overwritten.
        if args.execute_cloud:
            output = Path(args.output).resolve()
            if not output.is_relative_to(Path(".local").resolve()):
                raise ValueError("Evaluation results must remain under .local/")
            output.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            fd = os.open(output, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            with os.fdopen(fd, "w") as handle:
                json.dump({"state": "SUBMITTING", "warning": "Inspect this run before repeating a paid request"}, handle)
            result = run(rows, True)
            output.write_text(json.dumps(result, ensure_ascii=False))
            print(json.dumps({"cloudCalled": True, "rows": len(rows), "privateResultWritten": True}))
        else:
            print(json.dumps(run(rows)))
    except Exception:
        print("Evaluation not completed. Check input/configuration and private result; provider content is not logged.")
        raise SystemExit(1)
