"""Settings from environment variables. Defaults are a safe local demo: mock data, loopback, no cloud call.

Every live path needs an explicit opt-in. Invalid or contradictory configuration raises
ConfigurationError at start-up instead of falling back to another provider.
"""

from __future__ import annotations

import ipaddress
import os
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

from .errors import ConfigurationError

PACKAGE_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FIXTURES_DIR = PACKAGE_ROOT / "fixtures" / "pdfs"
DEFAULT_MANIFEST = PACKAGE_ROOT / "fixtures" / "manifest.json"

PROVIDER_MOCK = "mock"
PROVIDER_GRAPH = "graph"
EXTRACTOR_LOCAL = "local"
EXTRACTOR_AZURE_DI = "azure-document-intelligence"
ANSWER_DETERMINISTIC = "deterministic"
ANSWER_AZURE_OPENAI = "azure-openai"
AUTH_LOCAL_DEV = "local-dev"
AUTH_ENTRA = "entra"

# Delegated, read-only scope for the explicitly enabled local Graph test only.
GRAPH_DELEGATED_SCOPE = "Files.Read"
# Scope and app role this API expects in Entra access tokens (defined in the API app registration).
DEFAULT_API_SCOPE = "Documents.Read"
DEFAULT_API_APP_ROLE = "DocumentEvidence.Read"
LOCAL_DEV_TENANT = "fictional-tenant-001"

# Scopes and roles that must never be requested by this PoC.
FORBIDDEN_GRAPH_SCOPES = frozenset(
    {
        "Files.Read.All",
        "Sites.Read.All",
        "Files.ReadWrite",
        "Files.ReadWrite.All",
        "Sites.ReadWrite.All",
        "Sites.Manage.All",
        "Sites.FullControl.All",
    }
)


@dataclass(frozen=True)
class Settings:
    provider: str = PROVIDER_MOCK
    extractor: str = EXTRACTOR_LOCAL
    answer_provider: str = ANSWER_DETERMINISTIC
    auth_mode: str = AUTH_LOCAL_DEV
    host: str = "127.0.0.1"
    port: int = 8765
    fixtures_dir: Path = DEFAULT_FIXTURES_DIR
    manifest_path: Path = DEFAULT_MANIFEST
    local_tenant_id: str = LOCAL_DEV_TENANT
    live_graph_enabled: bool = False
    graph_tenant_id: str | None = None
    graph_client_id: str | None = None
    graph_timeout_seconds: float = 10.0
    entra_tenant_id: str | None = None
    entra_audience: str | None = None
    entra_api_scope: str = DEFAULT_API_SCOPE
    entra_api_app_role: str = DEFAULT_API_APP_ROLE
    live_azure_di_enabled: bool = False
    live_azure_openai_enabled: bool = False
    azure_timeout_seconds: float = 30.0
    azure_di_max_wait_seconds: float = 120.0
    llm_price_input_per_1k: float | None = None
    llm_price_output_per_1k: float | None = None
    extra: dict[str, str] = field(default_factory=dict, compare=False)

    @property
    def is_live_graph(self) -> bool:
        return self.provider == PROVIDER_GRAPH

    @property
    def is_entra(self) -> bool:
        return self.auth_mode == AUTH_ENTRA


_GUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


def is_loopback(host: str) -> bool:
    if host.lower() == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def _float_or(value: str | None, default: float) -> float:
    if value is None or value.strip() == "":
        return default
    try:
        return float(value)
    except ValueError as exc:
        raise ConfigurationError("numeric setting is invalid") from exc


def _optional_float(value: str | None) -> float | None:
    if value is None or value.strip() == "":
        return None
    try:
        parsed = float(value)
    except ValueError as exc:
        raise ConfigurationError("numeric setting is invalid") from exc
    if parsed < 0:
        raise ConfigurationError("price settings must not be negative")
    return parsed


def load_settings(env: Mapping[str, str] | None = None) -> Settings:
    """Read and validate settings. Raises ConfigurationError rather than guessing."""
    source = os.environ if env is None else env

    def get(name: str) -> str:
        return (source.get(name) or "").strip()

    provider = (get("M365_POC_PROVIDER") or PROVIDER_MOCK).lower()
    if provider not in {PROVIDER_MOCK, PROVIDER_GRAPH}:
        raise ConfigurationError("M365_POC_PROVIDER must be mock or graph")
    extractor = (get("M365_POC_EXTRACTOR") or EXTRACTOR_LOCAL).lower()
    if extractor not in {EXTRACTOR_LOCAL, EXTRACTOR_AZURE_DI}:
        raise ConfigurationError("M365_POC_EXTRACTOR must be local or azure-document-intelligence")
    answer = (get("M365_POC_ANSWER_PROVIDER") or ANSWER_DETERMINISTIC).lower()
    if answer not in {ANSWER_DETERMINISTIC, ANSWER_AZURE_OPENAI}:
        raise ConfigurationError("M365_POC_ANSWER_PROVIDER must be deterministic or azure-openai")
    auth_mode = (get("M365_POC_AUTH_MODE") or AUTH_LOCAL_DEV).lower()
    if auth_mode not in {AUTH_LOCAL_DEV, AUTH_ENTRA}:
        raise ConfigurationError("M365_POC_AUTH_MODE must be local-dev or entra")

    host = get("M365_POC_HOST") or "127.0.0.1"
    try:
        port = int(get("M365_POC_PORT") or 8765)
    except ValueError as exc:
        raise ConfigurationError("M365_POC_PORT must be an integer") from exc
    if not 1024 <= port <= 65535:
        raise ConfigurationError("M365_POC_PORT must be between 1024 and 65535")

    docker_demo = get("M365_POC_ALLOW_UNAUTHENTICATED_LOCAL_DOCKER") == "1"
    if not is_loopback(host) and auth_mode != AUTH_ENTRA:
        # Non-loopback listeners require Entra JWT validation. The only exception is an explicit, local-only
        # Docker demo: fictional data, mock provider, local extraction, deterministic answers, no live cloud call.
        local_only = provider == PROVIDER_MOCK and extractor == EXTRACTOR_LOCAL and answer == ANSWER_DETERMINISTIC
        if not (docker_demo and local_only):
            raise ConfigurationError("A non-loopback M365_POC_HOST requires M365_POC_AUTH_MODE=entra")
    if auth_mode == AUTH_LOCAL_DEV and provider != PROVIDER_MOCK:
        raise ConfigurationError("local-dev authentication is only allowed with the mock provider")

    entra_tenant = get("M365_POC_ENTRA_TENANT_ID") or None
    entra_audience = get("M365_POC_ENTRA_AUDIENCE") or None
    if auth_mode == AUTH_ENTRA and not (entra_tenant and entra_audience):
        raise ConfigurationError("entra authentication requires M365_POC_ENTRA_TENANT_ID and M365_POC_ENTRA_AUDIENCE")

    fixtures_raw = get("M365_POC_FIXTURES_DIR")
    fixtures_dir = Path(fixtures_raw).expanduser().resolve() if fixtures_raw else DEFAULT_FIXTURES_DIR
    manifest_raw = get("M365_POC_MANIFEST")
    manifest_path = Path(manifest_raw).expanduser().resolve() if manifest_raw else DEFAULT_MANIFEST

    live_graph = get("M365_POC_ENABLE_LIVE_GRAPH") == "1"
    graph_tenant = get("M365_POC_TENANT_ID") or None
    graph_client = get("M365_POC_CLIENT_ID") or None
    if graph_tenant and not _GUID_RE.fullmatch(graph_tenant):
        raise ConfigurationError("M365_POC_TENANT_ID must be a tenant GUID")
    if entra_tenant and not _GUID_RE.fullmatch(entra_tenant):
        raise ConfigurationError("M365_POC_ENTRA_TENANT_ID must be a tenant GUID")
    if provider == PROVIDER_GRAPH:
        if not live_graph:
            raise ConfigurationError("Live Graph requires M365_POC_ENABLE_LIVE_GRAPH=1")
        if not graph_tenant or not graph_client:
            raise ConfigurationError("Live Graph requires M365_POC_TENANT_ID and M365_POC_CLIENT_ID")

    live_di = get("M365_POC_ENABLE_LIVE_AZURE_DI") == "1"
    live_oai = get("M365_POC_ENABLE_LIVE_AZURE_OPENAI") == "1"
    if extractor == EXTRACTOR_AZURE_DI:
        if not live_di:
            raise ConfigurationError("Azure Document Intelligence requires M365_POC_ENABLE_LIVE_AZURE_DI=1")
        load_azure_config(source, require_document_intelligence=True)
    if answer == ANSWER_AZURE_OPENAI:
        if not live_oai:
            raise ConfigurationError("Azure OpenAI requires M365_POC_ENABLE_LIVE_AZURE_OPENAI=1")
        load_azure_config(source, require_openai=True)

    return Settings(
        provider=provider,
        extractor=extractor,
        answer_provider=answer,
        auth_mode=auth_mode,
        host=host,
        port=port,
        fixtures_dir=fixtures_dir,
        manifest_path=manifest_path,
        live_graph_enabled=live_graph,
        graph_tenant_id=graph_tenant,
        graph_client_id=graph_client,
        graph_timeout_seconds=_float_or(get("M365_POC_GRAPH_TIMEOUT_SECONDS"), 10.0),
        entra_tenant_id=entra_tenant,
        entra_audience=entra_audience,
        entra_api_scope=get("M365_POC_ENTRA_API_SCOPE") or DEFAULT_API_SCOPE,
        entra_api_app_role=get("M365_POC_ENTRA_API_APP_ROLE") or DEFAULT_API_APP_ROLE,
        live_azure_di_enabled=live_di,
        live_azure_openai_enabled=live_oai,
        azure_timeout_seconds=_float_or(get("M365_POC_AZURE_TIMEOUT_SECONDS"), 30.0),
        azure_di_max_wait_seconds=_float_or(get("M365_POC_AZURE_DI_MAX_WAIT_SECONDS"), 120.0),
        llm_price_input_per_1k=_optional_float(get("M365_POC_LLM_PRICE_INPUT_PER_1K")),
        llm_price_output_per_1k=_optional_float(get("M365_POC_LLM_PRICE_OUTPUT_PER_1K")),
    )


# ---------------------------------------------------------------------------
# Azure configuration. Validation only: no request is made here.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AzureConfig:
    document_intelligence_endpoint: str | None
    openai_endpoint: str | None
    openai_deployment: str | None
    openai_api_version: str
    document_intelligence_api_version: str


DI_API_VERSION = "2024-11-30"
OPENAI_API_VERSION = "2024-10-21"


def _validate_azure_endpoint(value: str, name: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname or not parsed.hostname.endswith(".azure.com"):
        raise ConfigurationError(f"{name} must be an https resource endpoint on *.azure.com")
    if parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        raise ConfigurationError(f"{name} must be a resource root without path or query")
    return f"https://{parsed.hostname}/"


def load_azure_config(
    env: Mapping[str, str] | None = None,
    *,
    require_document_intelligence: bool = False,
    require_openai: bool = False,
) -> AzureConfig | None:
    """Validate Azure endpoints. Returns None when nothing is configured; never makes a request."""
    source = os.environ if env is None else env

    def get(name: str) -> str:
        return (source.get(name) or "").strip()

    doc = get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
    oai = get("AZURE_OPENAI_ENDPOINT")
    deployment = get("AZURE_OPENAI_DEPLOYMENT")
    if require_document_intelligence and not doc:
        raise ConfigurationError("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT is required")
    if require_openai and not (oai and deployment):
        raise ConfigurationError("AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT are required")
    if not (doc or oai or deployment):
        return None
    return AzureConfig(
        document_intelligence_endpoint=_validate_azure_endpoint(doc, "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
        if doc
        else None,
        openai_endpoint=_validate_azure_endpoint(oai, "AZURE_OPENAI_ENDPOINT") if oai else None,
        openai_deployment=deployment or None,
        openai_api_version=OPENAI_API_VERSION,
        document_intelligence_api_version=DI_API_VERSION,
    )
