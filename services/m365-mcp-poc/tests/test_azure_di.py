"""Azure Document Intelligence contract tests (mocked HTTP, synthetic recorded shapes). Nothing live."""

import logging

import httpx
import pytest

from m365_poc.errors import (
    ExtractionError,
    ProviderBadRequest,
    ProviderForbidden,
    ProviderNotFound,
    ProviderRateLimited,
    ProviderTimeout,
    ProviderUnauthorized,
    ProviderUnavailable,
)
from m365_poc.providers.azure_di import AzureDocumentIntelligenceExtractor

ENDPOINT = "https://example-docs.cognitiveservices.azure.com/"
TOKEN = "TEST-TOKEN-NEVER-LOG-ME"
OP = "https://example-docs.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-layout/analyzeResults/abc?api-version=2024-11-30"
PDF = b"%PDF-1.4\n%synthetic\n"


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


def make(handler, clock=None, max_wait=30.0):
    clock = clock or FakeClock()
    return AzureDocumentIntelligenceExtractor(
        endpoint=ENDPOINT,
        api_version="2024-11-30",
        token_provider=lambda: TOKEN,
        transport=httpx.MockTransport(handler),
        sleep=clock.sleep,
        clock=clock,
        poll_interval_seconds=1.0,
        max_wait_seconds=max_wait,
    )


def submit_ok(request):
    return httpx.Response(202, headers={"Operation-Location": OP})


def test_success_maps_pages_blocks_polygons_tables_and_flags(recorded_di):
    def handler(request):
        if request.method == "POST":
            assert request.headers["Content-Type"] == "application/pdf"
            assert request.headers["Authorization"] == f"Bearer {TOKEN}"
            return submit_ok(request)
        return httpx.Response(200, json=recorded_di)

    result = make(handler).extract(PDF)
    assert result.extractor == "azure-document-intelligence-prebuilt-layout"
    first, second = result.pages
    assert first.page == 1 and "Projektname: Berlin Living" in first.text
    assert first.blocks[0].polygon == (1.0, 1.0, 4.0, 1.0, 4.0, 1.3, 1.0, 1.3)
    assert first.needs_ocr is False
    # Page 2 has low word confidence in the recorded shape, so it is flagged for review.
    assert second.needs_ocr is True
    table_cells = [b for b in second.blocks if b.kind == "table_cell"]
    assert [c.text for c in table_cells] == ["Position", "Betrag"]
    assert {c.table_id for c in table_cells} == {"table-1"}


@pytest.mark.parametrize(
    "status,error",
    [
        (400, ProviderBadRequest),
        (401, ProviderUnauthorized),
        (403, ProviderForbidden),
        (404, ProviderNotFound),
        (429, ProviderRateLimited),
        (500, ProviderUnavailable),
        (503, ProviderUnavailable),
    ],
)
def test_submit_errors_are_explicit(status, error):
    with pytest.raises(error):
        make(lambda r: httpx.Response(status, json={"error": {"code": "x"}})).extract(PDF)


def test_timeout_on_submit_is_explicit():
    def handler(request):
        raise httpx.ReadTimeout("slow", request=request)

    with pytest.raises(ProviderTimeout):
        make(handler).extract(PDF)


def test_poll_error_is_explicit():
    def handler(request):
        if request.method == "POST":
            return submit_ok(request)
        return httpx.Response(429, json={})

    with pytest.raises(ProviderRateLimited):
        make(handler).extract(PDF)


def test_unsupported_or_encrypted_document_is_an_extraction_error():
    def handler(request):
        if request.method == "POST":
            return submit_ok(request)
        return httpx.Response(200, json={"status": "failed", "error": {"code": "InvalidContent"}})

    with pytest.raises(ExtractionError) as info:
        make(handler).extract(PDF)
    assert info.value.reason == "unsupported"


def test_bounded_wait_times_out_without_a_fallback():
    def handler(request):
        if request.method == "POST":
            return submit_ok(request)
        return httpx.Response(200, json={"status": "running"})

    with pytest.raises(ProviderTimeout):
        make(handler, max_wait=5.0).extract(PDF)


def test_operation_location_off_origin_never_receives_the_token():
    seen = []

    def handler(request):
        seen.append(request)
        return httpx.Response(202, headers={"Operation-Location": "https://attacker.example.com/op"})

    with pytest.raises(ProviderUnavailable):
        make(handler).extract(PDF)
    assert len(seen) == 1  # the bearer token was not sent to a foreign host


def test_non_pdf_and_oversized_inputs_are_rejected_before_any_request():
    seen = []
    client = make(lambda r: seen.append(r) or submit_ok(r))
    with pytest.raises(ExtractionError):
        client.extract(b"not a pdf")
    with pytest.raises(ExtractionError):
        client.extract(b"%PDF-" + b"x" * (5 * 1024 * 1024))
    assert seen == []


def test_token_is_never_logged(caplog, recorded_di):
    caplog.set_level(logging.DEBUG)

    def handler(request):
        if request.method == "POST":
            return submit_ok(request)
        return httpx.Response(200, json=recorded_di)

    make(handler).extract(PDF)
    assert TOKEN not in caplog.text


def test_plain_http_endpoint_is_rejected():
    from m365_poc.errors import ProviderError

    with pytest.raises(ProviderError):
        AzureDocumentIntelligenceExtractor(
            endpoint="http://example.azure.com/", api_version="x", token_provider=lambda: TOKEN
        )
