"""FastAPI application. Loopback by default; Entra JWT validation for every non-local deployment.

Routes (all read-only):
  GET  /health                  minimal status, no tenant or secret information
  GET  /documents               authorised documents (names and IDs)
  GET  /documents/search        authorised search results
  POST /ask                     grounded answer with citations, or abstention
"""

from __future__ import annotations

import logging
import re
import uuid
from collections.abc import Awaitable, Callable
from time import perf_counter

from fastapi import FastAPI, Query, Request, Response
from fastapi.responses import JSONResponse

from . import __version__
from .answering.azure_openai import AzureOpenAIAnswerProvider
from .answering.base import AnswerProvider
from .answering.deterministic import DeterministicAnswerProvider
from .auth import AuthContext, EntraTokenValidator, authenticate_header
from .azure_auth import default_token_provider
from .config import (
    ANSWER_AZURE_OPENAI,
    AUTH_ENTRA,
    DI_API_VERSION,
    EXTRACTOR_AZURE_DI,
    OPENAI_API_VERSION,
    PROVIDER_GRAPH,
    Settings,
    load_azure_config,
    load_settings,
)
from .errors import AuthError, ConfigurationError, ExtractionError, ProviderError
from .evidence import query_terms  # noqa: F401  (re-exported for callers that build queries)
from .extraction import PageText, extract_pages
from .labels import capability_labels
from .models import (
    DEFAULT_RESULTS,
    MAX_REQUEST_BODY_BYTES,
    MAX_RESULTS,
    MAX_SEARCH_QUERY_CHARS,
    AskRequest,
    AskResponse,
    SearchResponse,
)
from .providers.base import DocumentProvider
from .service import EvidenceService, ExtractorInfo
from .telemetry import Telemetry

logger = logging.getLogger("m365_poc.api")
_CORRELATION_RE = re.compile(r"^[A-Za-z0-9\-]{8,64}$")
CORRELATION_HEADER = "X-Correlation-ID"


def build_service(
    settings: Settings,
    *,
    provider: DocumentProvider | None = None,
    telemetry: Telemetry | None = None,
    token_provider_factory: Callable[[str], Callable[[], str]] = default_token_provider,
) -> EvidenceService:
    """Build the configured providers. Each choice is fixed by settings; nothing switches at runtime."""
    telemetry = telemetry or Telemetry(
        price_input_per_1k=settings.llm_price_input_per_1k, price_output_per_1k=settings.llm_price_output_per_1k
    )
    doc_provider = provider or _document_provider(settings, token_provider_factory)

    extractor = ExtractorInfo("local-pypdf-native-text", extract_pages)
    if settings.extractor == EXTRACTOR_AZURE_DI:
        from .providers.azure_di import AzureDocumentIntelligenceExtractor

        cfg = load_azure_config(require_document_intelligence=True)
        if cfg is None or cfg.document_intelligence_endpoint is None:
            raise ConfigurationError("Azure Document Intelligence endpoint is not configured")
        di = AzureDocumentIntelligenceExtractor(
            endpoint=cfg.document_intelligence_endpoint,
            api_version=DI_API_VERSION,
            token_provider=token_provider_factory("https://cognitiveservices.azure.com/.default"),
            timeout_seconds=settings.azure_timeout_seconds,
            max_wait_seconds=settings.azure_di_max_wait_seconds,
        )

        def extract_azure(data: bytes) -> list[PageText]:
            # No fallback to local extraction: an Azure failure is an error, never a silent switch.
            return di.extract(data).pages

        extractor = ExtractorInfo(
            di.__class__.__name__ and "azure-document-intelligence-prebuilt-layout", extract_azure
        )

    answers: AnswerProvider = DeterministicAnswerProvider()
    if settings.answer_provider == ANSWER_AZURE_OPENAI:
        cfg = load_azure_config(require_openai=True)
        if cfg is None or cfg.openai_endpoint is None or cfg.openai_deployment is None:
            raise ConfigurationError("Azure OpenAI endpoint or deployment is not configured")
        answers = AzureOpenAIAnswerProvider(
            endpoint=cfg.openai_endpoint,
            deployment=cfg.openai_deployment,
            api_version=OPENAI_API_VERSION,
            token_provider=token_provider_factory("https://cognitiveservices.azure.com/.default"),
            timeout_seconds=settings.azure_timeout_seconds,
        )
    return EvidenceService(doc_provider, extractor=extractor, answer_provider=answers, telemetry=telemetry)


def _document_provider(
    settings: Settings, token_provider_factory: Callable[[str], Callable[[], str]]
) -> DocumentProvider:
    if settings.provider == PROVIDER_GRAPH:
        from .providers.graph import DelegatedTokenProvider, MicrosoftGraphProvider

        if not (settings.graph_tenant_id and settings.graph_client_id):
            raise ConfigurationError("Live Graph tenant and client identifiers are not configured")
        return MicrosoftGraphProvider(
            settings, DelegatedTokenProvider(settings.graph_tenant_id, settings.graph_client_id)
        )
    from .providers.mock import MockGraphProvider

    return MockGraphProvider(settings.fixtures_dir, settings.manifest_path)


def create_app(
    settings: Settings | None = None,
    service: EvidenceService | None = None,
    token_validator: EntraTokenValidator | None = None,
) -> FastAPI:
    settings = settings or load_settings()
    service = service or build_service(settings)
    telemetry = service.telemetry
    if settings.is_entra and token_validator is None:
        if not (settings.entra_tenant_id and settings.entra_audience):
            raise ConfigurationError("entra authentication is not fully configured")
        token_validator = EntraTokenValidator(
            tenant_id=settings.entra_tenant_id,
            audience=settings.entra_audience,
            api_scope=settings.entra_api_scope,
            app_role=settings.entra_api_app_role,
        )

    app = FastAPI(
        title="M365 document evidence PoC", version=__version__, docs_url=None, redoc_url=None, openapi_url=None
    )

    @app.middleware("http")
    async def boundary(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        started = perf_counter()
        incoming = request.headers.get(CORRELATION_HEADER, "")
        cid = incoming if _CORRELATION_RE.fullmatch(incoming) else uuid.uuid4().hex
        request.state.correlation_id = cid
        length = request.headers.get("content-length")
        if length is not None and length.isdigit() and int(length) > MAX_REQUEST_BODY_BYTES:
            response: Response = _error(413, "request_too_large", "The request body is too large.", cid)
        else:
            response = await call_next(request)
        response.headers[CORRELATION_HEADER] = cid
        route = request.scope.get("route")
        telemetry.record_request(
            getattr(route, "path", "unmatched"), response.status_code, (perf_counter() - started) * 1000
        )
        return response

    def _cid(request: Request) -> str:
        return str(getattr(request.state, "correlation_id", uuid.uuid4().hex))

    def _ctx(request: Request) -> AuthContext:
        return authenticate_header(settings, request.headers.get("authorization"), token_validator)

    @app.exception_handler(AuthError)
    async def auth_error(request: Request, exc: AuthError) -> JSONResponse:
        headers = {"WWW-Authenticate": f'Bearer error="{exc.code}"'} if exc.http_status == 401 else {}
        return _error(exc.http_status, exc.code, exc.public_message, _cid(request), headers)

    @app.exception_handler(ProviderError)
    async def provider_error(request: Request, exc: ProviderError) -> JSONResponse:
        telemetry.record_provider_error(service.provider_name, exc.code)
        logger.warning("provider error code=%s cid=%s", exc.code, _cid(request))
        return _error(exc.http_status, exc.code, exc.public_message, _cid(request))

    @app.exception_handler(ConfigurationError)
    async def config_error(request: Request, exc: ConfigurationError) -> JSONResponse:
        logger.error("configuration error cid=%s", _cid(request))
        return _error(exc.http_status, exc.code, "The service is not configured for this request.", _cid(request))

    @app.exception_handler(ExtractionError)
    async def extraction_error(request: Request, exc: ExtractionError) -> JSONResponse:
        return _error(exc.http_status, exc.code, exc.public_message, _cid(request))

    @app.get("/health")
    async def health() -> dict[str, object]:
        return {
            "status": "ok",
            "version": __version__,
            "auth_mode": settings.auth_mode,
            "provider": service.provider_name,
            "extractor": service.extractor_name,
            "answer_provider": service.answer_provider_name,
            "live": settings.is_live_graph
            or settings.extractor == EXTRACTOR_AZURE_DI
            or settings.answer_provider == ANSWER_AZURE_OPENAI,
            "labels": capability_labels(service.provider_name, service.extractor_name, service.answer_provider_name),
        }

    @app.get("/documents")
    async def list_documents(
        request: Request, max_results: int = Query(default=DEFAULT_RESULTS, ge=1, le=MAX_RESULTS)
    ) -> dict[str, object]:
        ctx = _ctx(request)
        hits = service.list_documents(ctx, max_results)
        return {"results": [h.model_dump() for h in hits]}

    @app.get("/documents/search", response_model=SearchResponse)
    async def search_documents(
        request: Request,
        q: str = Query(min_length=1, max_length=MAX_SEARCH_QUERY_CHARS),
        max_results: int = Query(default=DEFAULT_RESULTS, ge=1, le=MAX_RESULTS),
    ) -> SearchResponse:
        ctx = _ctx(request)
        return SearchResponse(query=q, results=service.search(ctx, q, max_results))

    @app.post("/ask", response_model=AskResponse)
    async def ask(body: AskRequest, request: Request) -> AskResponse:
        ctx = _ctx(request)
        return service.ask(ctx, body.question, correlation_id=_cid(request))

    return app


def _error(
    status: int, code: str, message: str, correlation_id: str, extra_headers: dict[str, str] | None = None
) -> JSONResponse:
    headers = {CORRELATION_HEADER: correlation_id, **(extra_headers or {})}
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "correlation_id": correlation_id}},
        headers=headers,
    )


__all__ = ["AUTH_ENTRA", "build_service", "create_app", "load_settings"]
