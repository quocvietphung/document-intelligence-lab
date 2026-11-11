"""Part 3 – opt-in Azure configuration for running the same AI-103 tests against Azure later.

This module only reads configuration and prints a plan. It never opens a network connection, never
creates resources and never reads keys' values into output. A live Azure adapter must call
`require_live(service, env)`, which refuses unless the person set the explicit billable opt-in and
listed that service. Prefer Microsoft Entra ID (`az login`); keys are discouraged and only reported.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

OPT_IN_VALUE = "billable-calls-approved"
HOST_SUFFIXES = (".cognitiveservices.azure.com", ".openai.azure.com", ".search.windows.net", ".services.ai.azure.com",
                 ".api.cognitive.microsoft.com", ".cognitive.microsofttranslator.com")


@dataclass(frozen=True)
class Service:
    key: str
    name: str
    endpoint_var: str
    other_vars: tuple[str, ...]
    exercises: tuple[str, ...]
    local: str
    local_mode: str  # "real" or "mock"
    api_version_var: str | None = None


SERVICES = (
    Service("search", "Azure AI Search", "AZURE_SEARCH_ENDPOINT", ("AZURE_SEARCH_INDEX",), ("1-evidence-search", "5-search-hybrid"),
            "Qdrant + BM25 in the Java API; BM25 check over the same PDF pages", "mock", "AZURE_SEARCH_API_VERSION"),
    Service("speech", "Azure AI Speech (fast transcription, text to speech)", "AZURE_SPEECH_ENDPOINT", ("AZURE_SPEECH_REGION",),
            ("4-speech-translation",), "Reference transcript of the synthetic site note; macOS voice for listening", "mock",
            "AZURE_SPEECH_API_VERSION"),
    Service("translator", "Azure AI Translator", "AZURE_TRANSLATOR_ENDPOINT", ("AZURE_TRANSLATOR_REGION",), ("4-translator-email",),
            "English reference translation of the fictional e-mail", "mock", "AZURE_TRANSLATOR_API_VERSION"),
    Service("voice-live", "Azure AI Voice Live", "AZURE_VOICELIVE_ENDPOINT", ("AZURE_VOICELIVE_MODEL",), ("4-voice-live",),
            "Scripted Voice Live events with barge-in (no live session)", "mock", "AZURE_VOICELIVE_API_VERSION"),
    Service("content-understanding", "Azure AI Content Understanding", "AZURE_CONTENT_UNDERSTANDING_ENDPOINT",
            ("AZURE_CONTENT_UNDERSTANDING_ANALYZER",), ("1-extraction", "6-content-understanding"),
            "Docling (documents), Tesseract (photo captions), reference transcript (audio)", "mock",
            "AZURE_CONTENT_UNDERSTANDING_API_VERSION"),
    Service("document-intelligence", "Azure AI Document Intelligence", "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", ("AZURE_DOCUMENT_INTELLIGENCE_MODEL",),
            ("1-extraction",), "Docling in Docker", "real", "AZURE_DOCUMENT_INTELLIGENCE_API_VERSION"),
    Service("foundry-agent", "Azure AI Foundry Agent Service", "AZURE_AI_FOUNDRY_PROJECT_ENDPOINT", ("AZURE_AI_AGENT_MODEL_DEPLOYMENT",),
            ("2a-read-only-agent",), "Python agent with scripted or local Ollama planner", "real"),
    Service("openai", "Azure OpenAI", "AZURE_OPENAI_ENDPOINT", ("AZURE_OPENAI_DEPLOYMENT",), ("2b-nova-summary-email",),
            "Nova on local Ollama (qwen3 4B)", "real"),
    Service("content-safety", "Azure AI Content Safety (Prompt Shields)", "AZURE_CONTENT_SAFETY_ENDPOINT", (),
            ("2c-embedded-instruction",), "EvidenceGuard rules in Java and Python", "real", "AZURE_CONTENT_SAFETY_API_VERSION"),
    Service("language", "Azure AI Language (PII, classification)", "AZURE_LANGUAGE_ENDPOINT", ("AZURE_LANGUAGE_CLASSIFICATION_PROJECT",),
            ("2d-email-triage-pii",), "Deterministic rules and regex masking", "real", "AZURE_LANGUAGE_API_VERSION"),
    Service("vision", "Azure AI Vision (Image Analysis)", "AZURE_VISION_ENDPOINT", (), ("2e-photo-linking", "2f-image-audio-schema"),
            "Local Tesseract OCR; no semantic caption", "mock", "AZURE_VISION_API_VERSION"),
    Service("app-insights", "Application Insights", "APPLICATIONINSIGHTS_CONNECTION_STRING", (), ("2g-opentelemetry",),
            "Local OpenTelemetry collector writing a JSON file", "real"),
)
KEY_VARS = ("AZURE_SEARCH_API_KEY", "AZURE_OPENAI_API_KEY", "AZURE_CONTENT_SAFETY_KEY", "AZURE_LANGUAGE_KEY", "AZURE_VISION_KEY",
            "AZURE_CONTENT_UNDERSTANDING_KEY", "AZURE_DOCUMENT_INTELLIGENCE_KEY", "AZURE_SPEECH_KEY", "AZURE_TRANSLATOR_KEY",
            "AZURE_VOICELIVE_API_KEY")


class LiveCallRefused(PermissionError):
    pass


def read_env_file(path: Path) -> dict[str, str]:
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$", line)
        if match and not line.lstrip().startswith("#"):
            values[match.group(1)] = match.group(2).strip('"').strip("'")
    return values


def _endpoint_problem(service: Service, value: str) -> str | None:
    if service.key == "app-insights":
        return None if "InstrumentationKey=" in value and "IngestionEndpoint=https://" in value else "expected a connection string with InstrumentationKey and IngestionEndpoint"
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname:
        return "must be an https URL"
    if not parsed.hostname.endswith(HOST_SUFFIXES):
        return "host is not an Azure AI endpoint"
    if service.key == "foundry-agent" and "/api/projects/" not in parsed.path:
        return "use the Foundry project endpoint (…/api/projects/<project>)"
    if service.key in {"openai", "document-intelligence"} and parsed.path not in {"", "/"}:
        return "use the resource-root endpoint without a path"
    return None


def plan(env: dict[str, str] | None = None) -> dict:
    env = dict(os.environ if env is None else env)
    opted_in = env.get("AI103_AZURE_OPT_IN") == OPT_IN_VALUE
    selected = {s.strip() for s in env.get("AI103_AZURE_SERVICES", "").split(",") if s.strip()}
    rows = []
    for service in SERVICES:
        endpoint = env.get(service.endpoint_var, "")
        missing = [var for var in (service.endpoint_var, *service.other_vars) if not env.get(var)]
        problem = _endpoint_problem(service, endpoint) if endpoint else None
        configured = not missing and problem is None
        if opted_in and service.key in selected and configured:
            mode = "azure-ready (billable when run)"
        elif service.key in selected and not opted_in:
            mode = f"local-{service.local_mode} (Azure selected but AI103_AZURE_OPT_IN is not set)"
        else:
            mode = f"local-{service.local_mode}"
        rows.append({"service": service.key, "name": service.name, "exercises": list(service.exercises), "mode": mode,
                     "localCounterpart": service.local, "configured": configured, "missing": missing, "endpointProblem": problem,
                     "endpointHost": urlparse(endpoint).hostname if endpoint and service.key != "app-insights" else ("set" if endpoint else None),
                     "apiVersion": env.get(service.api_version_var) if service.api_version_var else None})
    keys = [var for var in KEY_VARS if env.get(var)]
    unknown = sorted(selected - {s.key for s in SERVICES})
    return {"optedIn": opted_in, "selected": sorted(selected), "unknownServices": unknown, "services": rows,
            "auth": "keys present – prefer Microsoft Entra ID (az login) and remove keys" if keys else "Microsoft Entra ID (az login / managed identity)",
            "keysPresent": keys, "networkCalls": 0}


def require_live(service_key: str, env: dict[str, str] | None = None) -> dict:
    """Gate for any future live adapter: explicit billable opt-in, service selected, configuration valid."""
    current = plan(env)
    row = next((r for r in current["services"] if r["service"] == service_key), None)
    if row is None:
        raise LiveCallRefused(f"unknown service {service_key}")
    if not current["optedIn"]:
        raise LiveCallRefused(f"set AI103_AZURE_OPT_IN={OPT_IN_VALUE} to allow billable Azure calls")
    if service_key not in current["selected"]:
        raise LiveCallRefused(f"add {service_key} to AI103_AZURE_SERVICES to call it")
    if not row["configured"]:
        raise LiveCallRefused(f"{service_key} configuration incomplete: missing {row['missing']} {row['endpointProblem'] or ''}".strip())
    return row
