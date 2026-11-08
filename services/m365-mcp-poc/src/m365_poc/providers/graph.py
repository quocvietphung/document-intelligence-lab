"""MicrosoftGraphProvider: read-only access to OneDrive/SharePoint file content and metadata.

Graph supplies content and metadata only. Page numbers and evidence locations come from extraction.
Status: implemented and unit-tested with httpx.MockTransport. NOT verified against a live tenant.

Permission model (documented in README, not requested by this code beyond the local test scope):
  * local delegated test: Files.Read (default scope below);
  * production application access: Sites.Selected on one dedicated test site, with an explicit
    document allowlist enforced by this service (fail closed when no allowlist exists);
  * forbidden: Files.Read.All, Sites.Read.All and every write scope (see config.FORBIDDEN_GRAPH_SCOPES).

The provider never falls back to mock data. Every failure is a ProviderError.
"""

from __future__ import annotations

import re
import sys
from collections.abc import Callable
from urllib.parse import quote

import httpx
import msal

from ..auth import AuthContext
from ..config import FORBIDDEN_GRAPH_SCOPES, GRAPH_DELEGATED_SCOPE, Settings
from ..errors import (
    ExtractionError,
    ProviderError,
    ProviderNotFound,
    ProviderTimeout,
    ProviderUnauthorized,
    ProviderUnavailable,
    map_http_status,
)
from ..extraction import MAX_PDF_BYTES
from .base import DocumentRef, FetchedDocument

GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"
_ITEM_ID_RE = re.compile(r"^[A-Za-z0-9!_\-]{1,256}$")
_CONNECT_TIMEOUT_SECONDS = 5.0


class DelegatedTokenProvider:
    """MSAL device-code acquisition for the local delegated test. Tokens stay in memory and are never logged."""

    def __init__(self, tenant_id: str, client_id: str, scope: str = GRAPH_DELEGATED_SCOPE) -> None:
        if scope in FORBIDDEN_GRAPH_SCOPES:
            raise ProviderError("requested Graph scope is not permitted")
        self._scopes = [scope]
        self._app = msal.PublicClientApplication(client_id, authority=f"https://login.microsoftonline.com/{tenant_id}")

    def __call__(self) -> str:
        accounts = self._app.get_accounts()
        result = self._app.acquire_token_silent(self._scopes, account=accounts[0]) if accounts else None
        if not result or "access_token" not in result:
            flow = self._app.initiate_device_flow(scopes=self._scopes)
            if "user_code" not in flow:
                raise ProviderUnauthorized("device-code flow could not start")
            # The message holds the sign-in URL and a one-time code only. It is shown to the operator.
            print(flow.get("message", "Open the Microsoft sign-in page and enter the code shown."), file=sys.stderr)
            result = self._app.acquire_token_by_device_flow(flow)
        if "access_token" not in result:
            raise ProviderUnauthorized("token acquisition failed")
        return str(result["access_token"])


class MicrosoftGraphProvider:
    name = "graph"

    def __init__(
        self,
        settings: Settings,
        token_provider: Callable[[], str],
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        if not settings.is_live_graph:
            raise ProviderError("MicrosoftGraphProvider requires provider=graph")
        self._token_provider = token_provider
        self._client = httpx.Client(
            base_url=GRAPH_BASE_URL,
            timeout=httpx.Timeout(settings.graph_timeout_seconds, connect=_CONNECT_TIMEOUT_SECONDS),
            transport=transport,
            follow_redirects=True,  # /content redirects to a pre-authenticated download URL
        )

    def close(self) -> None:
        self._client.close()

    def _get(self, path: str, params: dict[str, str | int] | None = None) -> httpx.Response:
        token = self._token_provider()
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        try:
            response = self._client.get(path, params=params, headers=headers)
        except httpx.TimeoutException as exc:
            raise ProviderTimeout("graph timeout") from exc
        except httpx.HTTPError as exc:
            raise ProviderUnavailable(f"graph network error: {type(exc).__name__}") from exc
        if response.status_code >= 400:
            raise map_http_status(response.status_code, response.headers.get("Retry-After"))
        return response

    def _json(self, response: httpx.Response) -> dict[str, object]:
        try:
            data = response.json()
        except ValueError as exc:
            raise ProviderUnavailable("graph returned a malformed response") from exc
        if not isinstance(data, dict):
            raise ProviderUnavailable("graph returned an unexpected response shape")
        return data

    def _ref(self, ctx: AuthContext, item: dict[str, object], score: float) -> DocumentRef | None:
        name = str(item.get("name", ""))
        if "file" not in item or not name.lower().endswith(".pdf") or "id" not in item:
            return None
        size_raw = item.get("size")
        etag = item.get("eTag")
        file_info = item.get("file")
        mime = str(file_info.get("mimeType")) if isinstance(file_info, dict) and file_info.get("mimeType") else None
        return DocumentRef(
            document_id=str(item["id"]),
            name=name,
            location=str(item.get("webUrl") or f"graph://items/{item['id']}"),
            tenant_id=ctx.tenant_id,
            allowed_principals=None,
            acl_source="graph-delegated",
            mime_type=mime,
            size=size_raw if isinstance(size_raw, int) else None,
            version=str(etag) if etag else None,
            score=score,
        )

    def search(self, ctx: AuthContext, query: str, max_results: int) -> list[DocumentRef]:
        literal = quote(query.replace("'", "''"), safe="")
        data = self._json(
            self._get(
                f"/me/drive/root/search(q='{literal}')",
                params={"$top": max_results, "$select": "id,name,webUrl,file,size,eTag"},
            )
        )
        items = data.get("value", [])
        if not isinstance(items, list):
            raise ProviderUnavailable("graph returned an unexpected search shape")
        refs = [self._ref(ctx, item, float(len(items) - i)) for i, item in enumerate(items) if isinstance(item, dict)]
        return [r for r in refs if r is not None][:max_results]

    def list_documents(self, ctx: AuthContext, max_results: int) -> list[DocumentRef]:
        data = self._json(
            self._get(
                "/me/drive/root/children", params={"$top": max_results, "$select": "id,name,webUrl,file,size,eTag"}
            )
        )
        items = data.get("value", [])
        if not isinstance(items, list):
            raise ProviderUnavailable("graph returned an unexpected listing shape")
        refs = [self._ref(ctx, item, 0.0) for item in items if isinstance(item, dict)]
        return [r for r in refs if r is not None][:max_results]

    def fetch_pdf(self, ctx: AuthContext, document_id: str) -> FetchedDocument:
        if not _ITEM_ID_RE.fullmatch(document_id):
            raise ProviderNotFound("document not found")
        meta = self._json(
            self._get(f"/me/drive/items/{document_id}", params={"$select": "id,name,webUrl,size,file,eTag"})
        )
        ref = self._ref(ctx, meta, 0.0)
        if ref is None:
            raise ProviderNotFound("document is not a PDF file")
        if ref.size is not None and ref.size > MAX_PDF_BYTES:
            raise ExtractionError("size", "The document exceeds the size limit.")
        content = self._get(f"/me/drive/items/{document_id}/content").content
        if len(content) > MAX_PDF_BYTES:
            raise ExtractionError("size", "The document exceeds the size limit.")
        return FetchedDocument(ref=ref, data=content)
