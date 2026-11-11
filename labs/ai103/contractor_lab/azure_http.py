"""One HTTP POST for the optional Azure adapters (Speech, Translator, Search, Voice Live, Content Understanding).

Telemetry keeps only the service, the operation, the HTTP status, the duration, an error type and the correlation id.
Request bodies, responses, transcripts, keys and tokens are never recorded. Callers must pass the cloud.require_live
gate before calling `post`.
"""
from __future__ import annotations

import time
import urllib.error
import urllib.request
from contextlib import nullcontext


class AzureCallError(RuntimeError):
    def __init__(self, service: str, operation: str, status: int, correlation_id: str | None, duration_ms: float, error_type: str):
        super().__init__(f"{service}.{operation} failed: {error_type} (HTTP {status})")
        self.telemetry = {"service": service, "operation": operation, "status": status, "durationMs": round(duration_ms, 1),
                          "errorType": error_type, "correlationId": correlation_id}


def post(service: str, operation: str, url: str, body: bytes, headers: dict[str, str], timeout: float = 120, tracer=None,
         method: str = "POST") -> tuple[bytes, dict]:
    started = time.monotonic()
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    context = tracer.span(f"azure.{service}.{operation}") if tracer else nullcontext(None)
    with context as span:
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                payload = response.read()
                correlation = response.headers.get("apim-request-id") or response.headers.get("x-ms-request-id")
                status = response.status
        except urllib.error.HTTPError as error:
            correlation = error.headers.get("apim-request-id") or error.headers.get("x-ms-request-id")
            if span is not None:
                span.set("status", error.code)
                span.set("errorType", "HTTPError")
            raise AzureCallError(service, operation, error.code, correlation, (time.monotonic() - started) * 1000, "HTTPError") from None
        except (urllib.error.URLError, TimeoutError) as error:
            if span is not None:
                span.set("errorType", type(error).__name__)
            raise AzureCallError(service, operation, 0, None, (time.monotonic() - started) * 1000, type(error).__name__) from None
        if span is not None:
            span.set("status", status)
            if correlation:
                span.set("correlationId", correlation)
    return payload, {"status": status, "correlationId": correlation}
