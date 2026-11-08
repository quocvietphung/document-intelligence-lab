"""Azure Document Intelligence (prebuilt-layout) extractor.

Status: implemented and unit-tested with httpx.MockTransport and recorded SYNTHETIC responses.
NOT executed against a live Azure resource. Enabling it requires M365_POC_ENABLE_LIVE_AZURE_DI=1.

Behaviour
  * The request is submitted with an Entra token (Managed Identity or developer credential; never an API key).
  * Polling is bounded by a maximum wait. Operation-Location must stay on the configured endpoint origin,
    so a token is never sent to another host.
  * Errors are explicit. There is NO fallback to local extraction after an Azure failure.
  * Output keeps page numbers, line polygons (page coordinates), table cells with table IDs and page angle.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import httpx

from ..errors import (
    ExtractionError,
    ProviderBadRequest,
    ProviderError,
    ProviderForbidden,
    ProviderNotFound,
    ProviderRateLimited,
    ProviderTimeout,
    ProviderUnauthorized,
    ProviderUnavailable,
)
from ..extraction import MAX_PAGES, MAX_PDF_BYTES, Block, PageText

EXTRACTOR_NAME = "azure-document-intelligence-prebuilt-layout"
COGNITIVE_SCOPE = "https://cognitiveservices.azure.com/.default"
OCR_REVIEW_CONFIDENCE = 0.85  # mean word confidence below this marks a page for human review
_TERMINAL_FAILURE_CODES = {"InvalidContent", "InvalidRequest", "UnsupportedContent", "InvalidArgument"}


@dataclass(frozen=True)
class ExtractionResult:
    pages: list[PageText]
    extractor: str = EXTRACTOR_NAME


class AzureDocumentIntelligenceExtractor:
    def __init__(
        self,
        *,
        endpoint: str,
        api_version: str,
        token_provider: Callable[[], str],
        timeout_seconds: float = 30.0,
        max_wait_seconds: float = 120.0,
        poll_interval_seconds: float = 2.0,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        parsed = urlparse(endpoint)
        if parsed.scheme != "https" or not parsed.hostname:
            raise ProviderError("Azure endpoint must be https")
        self._origin = f"https://{parsed.hostname}"
        self._endpoint = self._origin + "/"
        self._api_version = api_version
        self._token = token_provider
        self._max_wait = max_wait_seconds
        self._poll = poll_interval_seconds
        self._sleep = sleep
        self._clock = clock
        self._client = httpx.Client(
            timeout=httpx.Timeout(timeout_seconds, connect=5.0),
            transport=transport,
            follow_redirects=False,  # never follow redirects with a bearer token
        )

    def close(self) -> None:
        self._client.close()

    # -- HTTP -----------------------------------------------------------------
    def _send(
        self, method: str, url: str, *, content: bytes | None = None, content_type: str | None = None
    ) -> httpx.Response:
        headers = {"Authorization": f"Bearer {self._token()}"}
        if content_type:
            headers["Content-Type"] = content_type
        try:
            response = self._client.request(method, url, content=content, headers=headers)
        except httpx.TimeoutException as exc:
            raise ProviderTimeout("azure document intelligence timeout") from exc
        except httpx.HTTPError as exc:
            raise ProviderUnavailable(f"azure network error: {type(exc).__name__}") from exc
        return response

    @staticmethod
    def _raise_for_status(response: httpx.Response) -> None:
        code = response.status_code
        if code < 400:
            return
        if code == 400:
            raise ProviderBadRequest("azure rejected the document request")
        if code == 401:
            raise ProviderUnauthorized("azure rejected the credentials")
        if code == 403:
            raise ProviderForbidden("azure denied access")
        if code == 404:
            raise ProviderNotFound("azure resource or model not found")
        if code == 429:
            raise ProviderRateLimited("azure throttled the request")
        if code >= 500:
            raise ProviderUnavailable(f"azure returned HTTP {code}")
        raise ProviderUnavailable(f"azure returned HTTP {code}")

    # -- public ----------------------------------------------------------------
    def extract(self, data: bytes) -> ExtractionResult:
        if len(data) > MAX_PDF_BYTES:
            raise ExtractionError("size", "The document exceeds the size limit.")
        if not data.startswith(b"%PDF-"):
            raise ExtractionError("not_pdf", "The file is not a PDF.")
        submit_url = (
            f"{self._endpoint}documentintelligence/documentModels/prebuilt-layout:analyze"
            f"?api-version={self._api_version}"
        )
        response = self._send("POST", submit_url, content=data, content_type="application/pdf")
        self._raise_for_status(response)
        operation = response.headers.get("Operation-Location", "")
        if (
            not operation
            or urlparse(operation).scheme != "https"
            or f"https://{urlparse(operation).hostname}" != self._origin
        ):
            raise ProviderUnavailable("azure returned an unexpected operation location")
        payload = self._poll_until_done(operation)
        return ExtractionResult(pages=self._parse(payload))

    def _poll_until_done(self, operation_url: str) -> dict[str, Any]:
        deadline = self._clock() + self._max_wait
        while True:
            response = self._send("GET", operation_url)
            self._raise_for_status(response)
            body = self._json(response)
            status = str(body.get("status", ""))
            if status == "succeeded":
                return body
            if status == "failed":
                raw_error = body.get("error")
                code = raw_error.get("code") if isinstance(raw_error, dict) else None
                if str(code or "") in _TERMINAL_FAILURE_CODES:
                    raise ExtractionError("unsupported", "The document is unsupported or unreadable by the extractor.")
                raise ProviderUnavailable("azure analysis failed")
            if status not in {"notStarted", "running"}:
                raise ProviderUnavailable("azure returned an unknown operation status")
            if self._clock() >= deadline:
                raise ProviderTimeout("azure analysis did not finish within the wait limit")
            self._sleep(self._poll)

    @staticmethod
    def _json(response: httpx.Response) -> dict[str, Any]:
        try:
            data = response.json()
        except ValueError as exc:
            raise ProviderUnavailable("azure returned a malformed response") from exc
        if not isinstance(data, dict):
            raise ProviderUnavailable("azure returned an unexpected response shape")
        return data

    # -- parsing -----------------------------------------------------------------
    def _parse(self, payload: dict[str, Any]) -> list[PageText]:
        result = payload.get("analyzeResult")
        if not isinstance(result, dict):
            raise ProviderUnavailable("azure returned no analysis result")
        raw_pages = result.get("pages") or []
        if not isinstance(raw_pages, list) or not raw_pages:
            raise ExtractionError("empty", "The document contains no pages.")
        if len(raw_pages) > MAX_PAGES:
            raise ExtractionError("pages", "The document exceeds the page limit.")

        tables_by_page: dict[int, list[Block]] = {}
        for t_index, table in enumerate(result.get("tables") or [], start=1):
            if not isinstance(table, dict):
                continue
            table_id = f"table-{t_index}"
            for cell in table.get("cells") or []:
                if not isinstance(cell, dict):
                    continue
                regions = cell.get("boundingRegions") or []
                page_no = int(regions[0].get("pageNumber", 1)) if regions and isinstance(regions[0], dict) else 1
                polygon = _polygon(regions[0].get("polygon")) if regions and isinstance(regions[0], dict) else None
                tables_by_page.setdefault(page_no, []).append(
                    Block(
                        text=str(cell.get("content", "")).strip(),
                        kind="table_cell",
                        polygon=polygon,
                        table_id=table_id,
                        row=_index(cell.get("rowIndex")),
                        column=_index(cell.get("columnIndex")),
                    )
                )

        pages: list[PageText] = []
        for raw in raw_pages:
            if not isinstance(raw, dict):
                continue
            number = int(raw.get("pageNumber", len(pages) + 1))
            lines = [
                line
                for line in (raw.get("lines") or [])
                if isinstance(line, dict) and str(line.get("content", "")).strip()
            ]
            blocks = tuple(
                Block(text=str(line["content"]).strip(), kind="line", polygon=_polygon(line.get("polygon")))
                for line in lines
            ) + tuple(tables_by_page.get(number, []))
            words = [
                w
                for w in (raw.get("words") or [])
                if isinstance(w, dict) and isinstance(w.get("confidence"), (int, float))
            ]
            mean_conf = sum(float(w["confidence"]) for w in words) / len(words) if words else 1.0
            angle = float(raw.get("angle", 0.0) or 0.0)
            pages.append(
                PageText(
                    page=number,
                    text="\n".join(b.text for b in blocks if b.kind == "line"),
                    rotation=round(angle) % 360,
                    extractor=EXTRACTOR_NAME,
                    needs_ocr=(not lines) or mean_conf < OCR_REVIEW_CONFIDENCE,
                    blocks=blocks,
                )
            )
        if not pages:
            raise ExtractionError("empty", "The document contains no readable pages.")
        return pages


def _index(value: object) -> int | None:
    return value if isinstance(value, int) and value >= 0 else None


def _polygon(value: object) -> tuple[float, ...] | None:
    if not isinstance(value, list) or not value:
        return None
    try:
        return tuple(float(v) for v in value)
    except (TypeError, ValueError):
        return None
