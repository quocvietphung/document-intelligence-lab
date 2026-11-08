"""Microsoft Graph provider contract tests (mocked transport). Not verified against a live tenant."""

import httpx
import pytest

from m365_poc.auth import AuthContext
from m365_poc.config import Settings
from m365_poc.errors import (
    ProviderConflict,
    ProviderError,
    ProviderForbidden,
    ProviderNotFound,
    ProviderRateLimited,
    ProviderTimeout,
    ProviderUnauthorized,
    ProviderUnavailable,
)
from m365_poc.providers.graph import MicrosoftGraphProvider

GUID = "11111111-2222-3333-4444-555555555555"
TOKEN = "GRAPH-TEST-TOKEN-NEVER-LOG"
CTX = AuthContext(tenant_id=GUID, principal_id="user-1", mode="entra-delegated")
SECRET_BODY = "Sensitive-Graph-Body-Content-Do-Not-Expose"


def provider(handler):
    settings = Settings(provider="graph", live_graph_enabled=True, graph_tenant_id=GUID, graph_client_id=GUID)
    return MicrosoftGraphProvider(settings, token_provider=lambda: TOKEN, transport=httpx.MockTransport(handler))


@pytest.mark.parametrize(
    "status,error",
    [
        (401, ProviderUnauthorized),
        (403, ProviderForbidden),
        (404, ProviderNotFound),
        (409, ProviderConflict),
        (500, ProviderUnavailable),
        (503, ProviderUnavailable),
    ],
)
def test_status_codes_map_to_stable_errors_without_echoing_the_body(status, error):
    def handler(request):
        return httpx.Response(status, text=SECRET_BODY)

    with pytest.raises(error) as info:
        provider(handler).search(CTX, "Berlin Living", 5)
    assert SECRET_BODY not in str(info.value) and TOKEN not in str(info.value)


def test_throttling_honours_numeric_retry_after():
    def handler(request):
        return httpx.Response(429, headers={"Retry-After": "7"}, text=SECRET_BODY)

    with pytest.raises(ProviderRateLimited) as info:
        provider(handler).search(CTX, "Berlin Living", 5)
    assert info.value.retry_after == 7.0


def test_throttling_ignores_http_date_retry_after():
    def handler(request):
        return httpx.Response(429, headers={"Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT"})

    with pytest.raises(ProviderRateLimited) as info:
        provider(handler).search(CTX, "Berlin Living", 5)
    assert info.value.retry_after is None


def test_timeout_and_network_failures_are_explicit():
    def timeout(request):
        raise httpx.ReadTimeout("slow", request=request)

    def network(request):
        raise httpx.ConnectError("refused", request=request)

    with pytest.raises(ProviderTimeout):
        provider(timeout).search(CTX, "x", 1)
    with pytest.raises(ProviderUnavailable):
        provider(network).search(CTX, "x", 1)


def test_search_returns_eTag_and_item_id_without_inferring_pages():
    def handler(request):
        return httpx.Response(
            200,
            json={
                "value": [
                    {
                        "id": "ITEM-1",
                        "name": "vertrag.pdf",
                        "file": {"mimeType": "application/pdf"},
                        "eTag": '"{ABC},1"',
                        "size": 1234,
                        "webUrl": "https://example.sharepoint.com/vertrag.pdf",
                    },
                    {"id": "ITEM-2", "name": "notiz.docx", "file": {}},
                ]
            },
        )

    hits = provider(handler).search(CTX, "Vertrag", 5)
    assert [h.document_id for h in hits] == ["ITEM-1"]
    assert hits[0].version == '"{ABC},1"' and hits[0].size == 1234
    assert hits[0].tenant_id == GUID and hits[0].acl_source == "graph-delegated"


def test_fetch_rejects_malformed_identifiers_before_any_request():
    seen = []
    with pytest.raises(ProviderNotFound):
        provider(lambda r: seen.append(r) or httpx.Response(200)).fetch_pdf(CTX, "../../etc")
    assert seen == []


def test_graph_provider_refuses_to_start_without_live_settings():
    with pytest.raises(ProviderError):
        MicrosoftGraphProvider(Settings(provider="mock"), token_provider=lambda: TOKEN)
