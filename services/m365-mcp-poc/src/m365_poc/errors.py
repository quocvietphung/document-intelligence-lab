"""Error types. Each error carries a stable code and a public message that never includes secrets or content."""

from __future__ import annotations


class ConfigurationError(Exception):
    """Settings are missing, invalid or inconsistent. The service refuses to start or to answer."""

    code = "configuration_error"
    http_status = 503


class AuthError(Exception):
    """Authentication or authorisation failed at the API boundary."""

    def __init__(self, code: str, message: str, http_status: int) -> None:
        super().__init__(message)
        self.code = code
        self.http_status = http_status
        self.public_message = message


class ProviderError(Exception):
    """A document provider could not serve the request. The message is safe to show."""

    code = "provider_error"
    http_status = 502
    public_message = "The document provider could not complete the request."
    transient = False

    def __init__(self, detail: str | None = None) -> None:
        # `detail` is for diagnostics only and must never contain tokens, document text or identifiers.
        super().__init__(detail or self.public_message)
        self.detail = detail


class ProviderUnauthorized(ProviderError):
    code = "provider_unauthorized"
    http_status = 502
    public_message = "The provider rejected the credentials for this request."


class ProviderForbidden(ProviderError):
    code = "provider_forbidden"
    http_status = 502
    public_message = "The provider denied access to this resource."


class ProviderBadRequest(ProviderError):
    code = "provider_bad_request"
    http_status = 502
    public_message = "The provider rejected the request as invalid for this document."


class ProviderNotFound(ProviderError):
    code = "provider_not_found"
    http_status = 404
    public_message = "The requested document was not found."


class ProviderConflict(ProviderError):
    code = "provider_conflict"
    http_status = 409
    public_message = "The provider reported a conflicting state for this document."


class ProviderRateLimited(ProviderError):
    code = "provider_rate_limited"
    http_status = 503
    public_message = "The provider is rate limiting requests. Retry later."
    transient = True

    def __init__(self, detail: str | None = None, retry_after: float | None = None) -> None:
        super().__init__(detail)
        # Seconds from the provider's Retry-After header, when it sent a numeric value.
        self.retry_after = retry_after


class ProviderTimeout(ProviderError):
    code = "provider_timeout"
    http_status = 504
    public_message = "The provider did not respond in time."
    transient = True


class ProviderUnavailable(ProviderError):
    code = "provider_unavailable"
    http_status = 502
    public_message = "The provider is unreachable or failed."
    transient = True


class ExtractionError(Exception):
    """A PDF could not be read or does not meet the configured limits."""

    code = "extraction_error"
    http_status = 422

    def __init__(self, reason: str = "unreadable", message: str | None = None) -> None:
        super().__init__(message or "The document could not be read within the configured limits.")
        self.reason = reason
        self.public_message = message or "The document could not be read within the configured limits."


class AnswerRejected(Exception):
    """Model output failed backend validation (missing or foreign evidence IDs, unsupported claims)."""

    code = "citation_validation_failed"

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


_STATUS_TO_ERROR: dict[int, type[ProviderError]] = {
    401: ProviderUnauthorized,
    403: ProviderForbidden,
    404: ProviderNotFound,
    429: ProviderRateLimited,
}


def parse_retry_after(value: str | None) -> float | None:
    """Only numeric Retry-After values are honoured; HTTP-date values are ignored (safe default)."""
    if value is None or not value.strip().isdigit():
        return None
    return min(float(value.strip()), 300.0)


def map_http_status(status_code: int, retry_after: str | None = None) -> ProviderError:
    """Translate a provider HTTP status into the matching error. The status code is kept, the body is not."""
    if status_code == 400:
        return ProviderBadRequest(f"provider returned HTTP {status_code}")
    if status_code == 409:
        return ProviderConflict(f"provider returned HTTP {status_code}")
    if status_code == 429:
        return ProviderRateLimited(f"provider returned HTTP {status_code}", parse_retry_after(retry_after))
    error_type = _STATUS_TO_ERROR.get(status_code, ProviderUnavailable)
    return error_type(f"provider returned HTTP {status_code}")
