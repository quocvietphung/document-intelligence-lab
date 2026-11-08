import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from m365_poc.auth import EntraTokenValidator, expected_issuer
from m365_poc.errors import AuthError

TENANT = "11111111-2222-3333-4444-555555555555"
AUDIENCE = "api://documents-poc"
SCOPE = "Documents.Read"
ROLE = "DocumentEvidence.Read"
_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_OTHER = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _claims(**overrides):
    now = int(time.time())
    base = {
        "iss": expected_issuer(TENANT),
        "aud": AUDIENCE,
        "tid": TENANT,
        "sub": "subject-1",
        "oid": "user-oid-1",
        "scp": SCOPE,
        "iat": now,
        "nbf": now,
        "exp": now + 600,
    }
    base.update(overrides)
    return {k: v for k, v in base.items() if v is not None}


def _token(key=_KEY, alg="RS256", **overrides):
    return jwt.encode(_claims(**overrides), key, algorithm=alg)


@pytest.fixture
def validator():
    return EntraTokenValidator(
        tenant_id=TENANT,
        audience=AUDIENCE,
        api_scope=SCOPE,
        app_role=ROLE,
        key_resolver=lambda token: _KEY.public_key(),
    )


def _code(validator, token):
    with pytest.raises(AuthError) as info:
        validator.validate(token)
    return info.value.code, info.value.http_status


def test_valid_delegated_token_yields_context(validator):
    ctx = validator.validate(_token())
    assert ctx.tenant_id == TENANT and ctx.mode == "entra-delegated" and ctx.principal_id == "user-oid-1"


def test_valid_application_token_with_role(validator):
    ctx = validator.validate(_token(scp=None, roles=[ROLE]))
    assert ctx.mode == "entra-app"


def test_invalid_issuer_rejected(validator):
    assert _code(validator, _token(iss="https://login.microsoftonline.com/other-tenant/v2.0")) == (
        "invalid_issuer",
        401,
    )


def test_invalid_audience_rejected(validator):
    assert _code(validator, _token(aud="api://someone-else")) == ("invalid_audience", 401)


def test_tenant_mismatch_rejected(validator):
    assert _code(validator, _token(tid="99999999-0000-0000-0000-000000000000")) == ("invalid_tenant", 401)


def test_expired_token_rejected(validator):
    past = int(time.time()) - 3600
    assert _code(validator, _token(iat=past - 10, nbf=past - 10, exp=past)) == ("token_expired", 401)


def test_missing_scope_and_role_rejected(validator):
    assert _code(validator, _token(scp="Other.Scope")) == ("insufficient_scope", 403)
    assert _code(validator, _token(scp=None)) == ("insufficient_scope", 403)


def test_wrong_signature_rejected(validator):
    assert _code(validator, _token(key=_OTHER))[0] == "invalid_token"


def test_alg_none_rejected(validator):
    unsigned = jwt.encode(_claims(), key=None, algorithm="none")
    assert _code(validator, unsigned)[0] == "invalid_token"


def test_hmac_algorithm_rejected(validator):
    hmac_token = jwt.encode(_claims(), "shared-secret-value-that-is-32-bytes!!", algorithm="HS256")
    assert _code(validator, hmac_token)[0] == "invalid_token"


def test_missing_required_claim_rejected(validator):
    claims = _claims()
    del claims["sub"]
    token = jwt.encode(claims, _KEY, algorithm="RS256")
    assert _code(validator, token)[0] == "invalid_token"


def test_oversized_and_empty_tokens_rejected(validator):
    assert _code(validator, "")[0] == "invalid_token"
    assert _code(validator, "a" * 9000)[0] == "invalid_token"


def test_key_resolver_failure_is_generic_and_fail_closed():
    def broken(token):
        raise RuntimeError("network detail that must not leak")

    v = EntraTokenValidator(tenant_id=TENANT, audience=AUDIENCE, api_scope=SCOPE, app_role=ROLE, key_resolver=broken)
    with pytest.raises(AuthError) as info:
        v.validate(_token())
    assert "network detail" not in info.value.public_message
