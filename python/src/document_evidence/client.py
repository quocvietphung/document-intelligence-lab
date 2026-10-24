"""Explicit authenticated SDK for the existing Java API, not a second backend."""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Callable
from uuid import UUID, uuid4

from .reader import local_pdf_bytes


class PlatformError(RuntimeError):
    def __init__(self, status: int, code: str) -> None:
        self.status, self.code = status, code
        super().__init__(f"Platform request failed: {code} (HTTP {status})")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class PlatformClient:
    """Every request needs an existing Bearer token; RBAC stays in Java.

    A token callback may supply a refreshed token. No login, password storage,
    automatic retry, proxy discovery, redirect or LLM call happens implicitly.
    """
    def __init__(self, base_url: str, token: str | Callable[[], str], *, timeout: float = 30) -> None:
        if not isinstance(base_url, str) or any(ord(c) <= 32 or ord(c) == 127 for c in base_url):
            raise ValueError("Invalid API origin")
        parsed = urllib.parse.urlsplit(base_url)
        parsed.port  # Validate the port before constructing a credential-bearing request.
        local = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
        if (not parsed.hostname or parsed.username is not None or parsed.password is not None
                or parsed.query or parsed.fragment or parsed.path not in {"", "/"}
                or (parsed.scheme != "https" and not (parsed.scheme == "http" and local))):
            raise ValueError("Use an HTTPS API origin, or HTTP loopback for local development")
        if not 0 < timeout <= 420:
            raise ValueError("Invalid request timeout")
        if not callable(token) and not isinstance(token, str):
            raise ValueError("A Bearer token or token callback is required")
        self.base_url = base_url.rstrip("/")
        self._token, self.timeout = token, timeout
        # Do not forward credentials through environment-configured proxies.
        self._http = urllib.request.build_opener(urllib.request.ProxyHandler({}), _NoRedirect())

    @staticmethod
    def _id(value: str) -> str:
        if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9-]{1,100}", value):
            raise ValueError("Invalid resource ID")
        return value

    def _request(self, path: str, *, data: bytes | None = None, content_type: str | None = None):
        token = self._token() if callable(self._token) else self._token
        if not isinstance(token, str) or not re.fullmatch(r"[A-Za-z0-9._~+/=-]+", token):
            raise ValueError("A non-empty Bearer token is required; never pass a password")
        headers = {"Authorization": "Bearer " + token, "Accept": "application/json"}
        if content_type:
            headers["Content-Type"] = content_type
        request = urllib.request.Request(self.base_url + path, data=data, headers=headers)
        try:
            with self._http.open(request, timeout=self.timeout) as response:
                payload = response.read(6_000_001)
                if len(payload) > 6_000_000:
                    raise PlatformError(response.status, "RESPONSE_SIZE_LIMIT")
        except urllib.error.HTTPError as error:
            # Do not include the URL, token, document data or server error body.
            status = error.code
            error.close()
            raise PlatformError(status, {401: "UNAUTHENTICATED", 403: "FORBIDDEN", 404: "NOT_FOUND",
                                        409: "CONFLICT", 422: "INVALID_INPUT", 429: "RATE_LIMITED"}.get(status, "API_ERROR")) from None
        except (urllib.error.URLError, OSError):
            raise PlatformError(0, "CONNECTION_FAILED") from None
        try:
            return json.loads(payload)
        except (ValueError, UnicodeDecodeError):
            raise PlatformError(0, "INVALID_RESPONSE") from None

    def list_cases(self) -> list[dict]:
        return self._request("/api/cases")

    def get_case(self, case_id: str) -> dict:
        return self._request("/api/cases/" + self._id(case_id))

    def workflow(self, case_id: str) -> dict:
        return self._request("/api/cases/" + self._id(case_id) + "/platform")

    def trust(self, case_id: str) -> dict:
        return self._request("/api/cases/" + self._id(case_id) + "/trust")

    def audit(self, case_id: str) -> list:
        return self.get_case(case_id)["audit"]

    def batches(self, case_id: str) -> dict:
        return self._request("/api/cases/" + self._id(case_id) + "/platform/batches")

    def submit_pdf(self, case_id: str, path: str | Path, *, consent: bool,
                   request_id: str, profile: str = "general", name: str = "Python SDK intake",
                   source: str = "Operator-selected local PDF") -> dict:
        """Explicit persistent intake; Java retains scanning, roles and idempotency.

        Keep request_id and metadata unchanged when inspecting/retrying an
        uncertain submission. HTTP 202 is an intake receipt, not finished OCR.
        """
        if consent is not True:
            raise ValueError("Explicit document-processing consent is required")
        case_id = self._id(case_id)
        try:
            if str(UUID(request_id)) != request_id.lower():
                raise ValueError()
        except (ValueError, TypeError, AttributeError):
            raise ValueError("Use a stable UUID request_id") from None
        if profile not in {"general", "invoice", "payroll", "insurance-wording"}:
            raise ValueError("Unsupported extraction profile")
        for text, limit in [(name, 100), (source, 160)]:
            if not isinstance(text, str) or not text.strip() or len(text) > limit or any(ord(c) < 32 or ord(c) == 127 for c in text):
                raise ValueError("Invalid batch metadata")
        _, content = local_pdf_bytes(path)
        boundary = "document-evidence-" + uuid4().hex
        parts = []
        for key, value in {"requestId": request_id, "name": name, "source": source, "profile": profile}.items():
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
        # A fixed transport filename prevents path disclosure and header injection.
        parts += [f'--{boundary}\r\nContent-Disposition: form-data; name="files"; filename="document.pdf"\r\nContent-Type: application/pdf\r\n\r\n'.encode(),
                  content, f'\r\n--{boundary}--\r\n'.encode()]
        return self._request("/api/cases/" + case_id + "/platform/batches", data=b"".join(parts),
                             content_type="multipart/form-data; boundary=" + boundary)
