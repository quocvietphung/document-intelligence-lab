"""Read-only access to the local Java API.

`login()` performs the same Keycloak authorization-code + PKCE flow as scripts/test-oauth.mjs, for the
documented local development account, and keeps the token in memory only. `ReadOnlyApi` permits GET plus
the read-only evidence search; every other method or path is refused before any request is sent.
"""
from __future__ import annotations

import base64
import hashlib
import html
import json
import os
import re
import secrets
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable

from .otel import Tracer

READ_ONLY_POST = re.compile(r"^/api/cases/[-A-Za-z0-9]{1,80}/platform/search$")
GET_PATHS = re.compile(r"^/api/cases/[-A-Za-z0-9]{1,80}(?:/platform(?:/contractor-precheck)?)?(?:\?locale=(?:en|de|vi))?$")
LOCAL_HOSTS = {"localhost", "127.0.0.1", "credit-api"}


class PolicyError(PermissionError):
    """Raised when code tries to leave the read-only boundary."""


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # keep 302 responses visible
        return None


def login(auth_url: str = "http://localhost:8080", web_url: str = "http://localhost:3000") -> str:
    """Return an access token for the local development account (never printed or written to disk)."""
    for url in (auth_url, web_url):
        if urllib.parse.urlparse(url).hostname not in LOCAL_HOSTS:
            raise PolicyError("Lab login is for the local development realm only")
    realm = f"{auth_url}/realms/credit-intelligence"
    # Keycloak marks its session cookies Secure; browsers accept that on localhost, CookieJar does not.
    # Keep them by hand, like scripts/test-oauth.mjs, and only for this local origin.
    cookies: dict[str, str] = {}
    opener = urllib.request.build_opener(_NoRedirect())

    def send(url: str, data: bytes | None = None):
        request = urllib.request.Request(url, data=data, method="POST" if data else "GET",
                                         headers={"Cookie": "; ".join(f"{k}={v}" for k, v in cookies.items())})
        try:
            response = opener.open(request, timeout=20)
        except urllib.error.HTTPError as redirect:
            response = redirect
        for header in response.headers.get_all("Set-Cookie") or []:
            name, _, value = header.split(";", 1)[0].partition("=")
            cookies[name.strip()] = value.strip()
        return response

    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    state, redirect = secrets.token_hex(16), f"{web_url}/en"
    query = urllib.parse.urlencode({"client_id": "credit-intelligence-web", "response_type": "code", "scope": "openid profile email",
                                    "redirect_uri": redirect, "state": state, "code_challenge": challenge, "code_challenge_method": "S256"})
    page = send(f"{realm}/protocol/openid-connect/auth?{query}").read().decode()
    action = re.search(r'<form[^>]*action="([^"]+)"', page)
    if not action:
        raise RuntimeError("Keycloak login form not found")
    form = urllib.parse.urlencode({"username": os.environ.get("LAB_USERNAME", "advisor.demo"),
                                   "password": os.environ.get("LAB_PASSWORD", "demo-password"), "credentialId": ""}).encode()
    response = send(html.unescape(action.group(1)), form)
    if response.status != 302:
        raise RuntimeError(f"Login failed with HTTP {response.status}")
    callback = urllib.parse.urlparse(response.headers["Location"])
    params = urllib.parse.parse_qs(callback.query)
    if params.get("state") != [state]:
        raise RuntimeError("OAuth state mismatch")
    token = urllib.parse.urlencode({"grant_type": "authorization_code", "client_id": "credit-intelligence-web", "code": params["code"][0],
                                    "redirect_uri": redirect, "code_verifier": verifier}).encode()
    with urllib.request.urlopen(urllib.request.Request(f"{realm}/protocol/openid-connect/token", data=token, method="POST"), timeout=20) as reply:
        return json.loads(reply.read())["access_token"]


class ReadOnlyApi:
    def __init__(self, base_url: str, token: Callable[[], str] | str, tracer: Tracer | None = None, timeout: float = 60):
        if urllib.parse.urlparse(base_url).hostname not in LOCAL_HOSTS:
            raise PolicyError("The lab agent talks only to the local Java API")
        self.base_url = base_url.rstrip("/")
        self._token = token if callable(token) else (lambda: token)
        self.tracer = tracer
        self.timeout = timeout
        self.requests: list[tuple[str, str]] = []

    def get(self, path: str) -> dict:
        if not GET_PATHS.match(path):
            raise PolicyError(f"GET {path} is outside the read-only tool surface")
        return self._send("GET", path, None)

    def post(self, path: str, body: dict, *, allow_model: bool = False) -> dict:
        if not (READ_ONLY_POST.match(path) or (allow_model and path == "/api/assistant/chat")):
            raise PolicyError(f"POST {path} is not a read-only operation")
        return self._send("POST", path, body)

    def _send(self, method: str, path: str, body: dict | None) -> dict:
        headers = {"Authorization": f"Bearer {self._token()}", "Accept": "application/json"}
        if self.tracer is not None:
            headers["traceparent"] = self.tracer.traceparent()
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode()
        self.requests.append((method, path))
        request = urllib.request.Request(self.base_url + path, data=data, method=method, headers=headers)
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            return json.loads(response.read())
