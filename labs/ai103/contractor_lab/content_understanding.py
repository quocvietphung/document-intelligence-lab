"""Exercise 6 – Azure AI Content Understanding request shape, checked without any call.

Documented (learn.microsoft.com, read 2026-11-11): analyze at {endpoint}/contentunderstanding/analyzers/{analyzerId}:analyze
?api-version=2025-11-01; the body holds inputs[] with url or data (base64), mimeType, name and range. The analyzer id is
part of the URL, so the sample keeps it under "analyzerId" and this module removes it from the body before sending.
"""
from __future__ import annotations

import json
from pathlib import Path

DOCUMENTED_ANALYZERS = {
    "prebuilt-documentSearch", "prebuilt-layout", "prebuilt-read", "prebuilt-digitalParse", "prebuilt-invoice",
    "prebuilt-contract", "prebuilt-receipt", "prebuilt-idDocument", "prebuilt-imageSearch", "prebuilt-audioSearch",
    "prebuilt-callCenter", "prebuilt-videoSearch", "prebuilt-document", "prebuilt-image", "prebuilt-audio", "prebuilt-video",
}
INPUT_KEYS = {"url", "data", "mimeType", "name", "range"}
API_VERSION = "2025-11-01"


def body_of(request: dict) -> dict:
    return {key: value for key, value in request.items() if key not in {"_comment", "analyzerId"}}


def validate_request(path: Path) -> list[str]:
    request = json.loads(path.read_text(encoding="utf-8"))
    problems = []
    analyzer = request.get("analyzerId")
    if analyzer not in DOCUMENTED_ANALYZERS:
        problems.append(f"analyzerId {analyzer!r} is not a documented prebuilt analyzer")
    body = body_of(request)
    inputs = body.get("inputs")
    if not isinstance(inputs, list) or not inputs:
        problems.append("inputs must be a non-empty list")
        return problems
    for item in inputs:
        unknown = set(item) - INPUT_KEYS
        if unknown:
            problems.append(f"unknown input keys {sorted(unknown)}")
        if ("url" in item) == ("data" in item):
            problems.append("an input needs exactly one of url or data")
        if "mimeType" not in item:
            problems.append("an input needs mimeType")
    return problems


def analyze_url(endpoint: str, analyzer: str) -> str:
    return f"{endpoint.rstrip('/')}/contentunderstanding/analyzers/{analyzer}:analyze?api-version={API_VERSION}"
