"""Authentication and authorisation boundary.

Production mode validates Microsoft Entra access tokens (RS256 signature via the tenant JWKS,
issuer, audience, tenant id, expiry and a required delegated scope or application role).
Local mode is a fixed fictional principal and is only allowed on loopback with the mock provider.

Tokens are never logged. The validated AuthContext carries tenant and principal identity, and
every provider call and every document decision uses it.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Protocol

import jwt
from jwt import PyJWKClient

from .config import AUTH_LOCAL_DEV, LOCAL_DEV_TENANT, Settings
from .errors import AuthError

LOCAL_PRINCIPAL = "local-dev-user"
ALGORITHMS = ["RS256"]  # never accept "none" or symmetric algorithms
CLOCK_LEEWAY_SECONDS = 60


@dataclass(frozen=True)
class AuthContext:
    tenant_id: str
    principal_id: str
    mode: str  # local-dev | entra-delegated | entra-app
    scopes: frozenset[str] = frozenset()
    roles: frozenset[str] = frozenset()

    def __repr__(self) -> str:  # keep identifiers out of accidental log lines
        return f"AuthContext(mode={self.mode!r}, tenant=<redacted>, principal=<redacted>)"


def local_dev_context(settings: Settings) -> AuthContext:
    return AuthContext(
        tenant_id=settings.local_tenant_id or LOCAL_DEV_TENANT,
        principal_id=LOCAL_PRINCIPAL,
        mode=AUTH_LOCAL_DEV,
        scopes=frozenset({"Documents.Read"}),
    )


class SigningKeyResolver(Protocol):
    def __call__(self, token: str) -> Any: ...


def jwks_uri(tenant_id: str) -> str:
    return f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"


def expected_issuer(tenant_id: str) -> str:
    return f"https://login.microsoftonline.com/{tenant_id}/v2.0"


class EntraTokenValidator:
    """Validates Entra v2 access tokens for this API. All checks fail closed."""

    def __init__(
        self,
        *,
        tenant_id: str,
        audience: str,
        api_scope: str,
        app_role: str,
        key_resolver: SigningKeyResolver | None = None,
        jwks_timeout_seconds: float = 10.0,
    ) -> None:
        self._tenant = tenant_id
        self._audience = audience
        self._scope = api_scope
        self._role = app_role
        if key_resolver is None:
            client = PyJWKClient(jwks_uri(tenant_id), timeout=jwks_timeout_seconds, cache_jwk_set=True)
            key_resolver = lambda token: client.get_signing_key_from_jwt(token).key  # noqa: E731
        self._resolve_key: SigningKeyResolver = key_resolver

    def validate(self, token: str) -> AuthContext:
        if not token or len(token) > 8192:
            raise AuthError("invalid_token", "missing or oversized token", 401)
        try:
            key = self._resolve_key(token)
        except jwt.PyJWTError as exc:
            raise AuthError("invalid_token", "signing key unavailable or token malformed", 401) from exc
        except Exception as exc:  # network errors while fetching JWKS: fail closed, do not expose detail
            raise AuthError("invalid_token", "signing key unavailable", 401) from exc
        try:
            claims: dict[str, Any] = jwt.decode(
                token,
                key,
                algorithms=ALGORITHMS,
                audience=self._audience,
                issuer=expected_issuer(self._tenant),
                leeway=CLOCK_LEEWAY_SECONDS,
                options={"require": ["exp", "iat", "nbf", "iss", "aud", "sub"]},
            )
        except jwt.ExpiredSignatureError as exc:
            raise AuthError("token_expired", "token has expired", 401) from exc
        except jwt.InvalidAudienceError as exc:
            raise AuthError("invalid_audience", "token audience is not accepted", 401) from exc
        except jwt.InvalidIssuerError as exc:
            raise AuthError("invalid_issuer", "token issuer is not accepted", 401) from exc
        except jwt.PyJWTError as exc:
            raise AuthError("invalid_token", "token validation failed", 401) from exc

        if claims.get("tid") != self._tenant:
            raise AuthError("invalid_tenant", "token tenant is not accepted", 401)

        scopes = frozenset(str(claims.get("scp", "")).split()) if claims.get("scp") else frozenset()
        roles = frozenset(claims.get("roles") or [])
        if self._scope in scopes:
            mode = "entra-delegated"
        elif self._role in roles:
            mode = "entra-app"
        else:
            raise AuthError("insufficient_scope", "required scope or application role is missing", 403)

        principal = str(claims.get("oid") or claims.get("sub"))
        return AuthContext(tenant_id=self._tenant, principal_id=principal, mode=mode, scopes=scopes, roles=roles)


def authenticate_header(
    settings: Settings, authorization: str | None, validator: EntraTokenValidator | None
) -> AuthContext:
    """Resolve the request context. Local mode ignores the header; Entra mode requires a bearer token."""
    if settings.auth_mode == AUTH_LOCAL_DEV:
        return local_dev_context(settings)
    if validator is None:
        raise AuthError("invalid_token", "authentication is not configured", 401)
    if not authorization or not authorization.startswith("Bearer "):
        raise AuthError("missing_token", "a bearer token is required", 401)
    return validator.validate(authorization[len("Bearer ") :].strip())


def can_read(ctx: AuthContext, *, tenant_id: str, allowed_principals: frozenset[str] | None, acl_source: str) -> bool:
    """Document decision. Fails closed: unknown ACLs deny application-only access."""
    if ctx.tenant_id != tenant_id:
        return False
    if acl_source == "graph-delegated":
        # Graph returns only items the signed-in user may read; the delegated token is that user.
        return ctx.mode == "entra-delegated"
    if allowed_principals is None:
        return False
    return ctx.principal_id in allowed_principals


Validator = Callable[[str], AuthContext]
