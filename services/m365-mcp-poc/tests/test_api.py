"""FastAPI boundary: local mode, Entra mode, limits, correlation IDs, no wildcard CORS, no fallback."""

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from m365_poc.api import create_app
from m365_poc.auth import EntraTokenValidator, expected_issuer
from m365_poc.config import Settings
from m365_poc.errors import ProviderForbidden, ProviderTimeout, ProviderUnauthorized
from m365_poc.service import EvidenceService

TENANT = "fictional-tenant-001"  # matches fixtures/manifest.json
AUDIENCE = "api://documents-poc"
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def token(**overrides):
    now = int(time.time())
    claims = {
        "iss": expected_issuer(TENANT),
        "aud": AUDIENCE,
        "tid": TENANT,
        "sub": "s",
        "oid": "local-dev-user",
        "scp": "Documents.Read",
        "iat": now,
        "nbf": now,
        "exp": now + 600,
    }
    claims.update(overrides)
    return jwt.encode({k: v for k, v in claims.items() if v is not None}, KEY, algorithm="RS256")


@pytest.fixture
def local_client(settings, mock_service):
    return TestClient(create_app(settings=settings, service=mock_service))


@pytest.fixture
def entra_client(settings, mock_service):
    s = Settings(
        fixtures_dir=settings.fixtures_dir,
        manifest_path=settings.manifest_path,
        host="0.0.0.0",
        auth_mode="entra",
        entra_tenant_id=TENANT,
        entra_audience=AUDIENCE,
    )
    validator = EntraTokenValidator(
        tenant_id=TENANT,
        audience=AUDIENCE,
        api_scope="Documents.Read",
        app_role="DocumentEvidence.Read",
        key_resolver=lambda t: KEY.public_key(),
    )
    return TestClient(create_app(settings=s, service=mock_service, token_validator=validator))


def test_health_is_minimal(local_client):
    body = local_client.get("/health").json()
    assert body["status"] == "ok" and body["provider"] == "mock" and body["answer_provider"] == "deterministic"
    assert set(body) <= {"status", "version", "auth_mode", "provider", "extractor", "answer_provider", "live", "labels"}


def test_search_and_list_return_only_authorised_documents(local_client):
    names = {h["name"] for h in local_client.get("/documents", params={"max_results": 20}).json()["results"]}
    assert "vorstandsnotiz-berlin-living.pdf" not in names
    found = local_client.get("/documents/search", params={"q": "Vorstandsnotiz Berlin Living"}).json()["results"]
    assert all("vorstand" not in h["name"] for h in found)


def test_content_returns_only_authorised_pdf_bytes_without_existence_oracle(local_client):
    r = local_client.get("/documents/project-status-001/content")
    assert r.status_code == 200 and r.content.startswith(b"%PDF-")
    assert r.headers["content-type"] == "application/pdf"
    assert r.headers["cache-control"] == "no-store" and r.headers["x-content-type-options"] == "nosniff"
    hidden = local_client.get("/documents/restricted-exec-001/content")
    missing = local_client.get("/documents/does-not-exist/content")
    assert hidden.status_code == missing.status_code == 404
    assert hidden.json()["error"]["code"] == missing.json()["error"]["code"]
    assert local_client.get("/documents/bad id!/content").status_code == 422


def test_core_question_is_grounded_with_page_source(local_client):
    r = local_client.post(
        "/ask",
        json={"question": "Wie ist der aktuelle Status des Projekts Berlin Living und wann ist der nächste Termin?"},
    )
    body = r.json()
    assert r.status_code == 200 and body["grounded"] is True and body["abstained"] is False
    assert "beantragt" in body["answer"] and "20.11.2026" in body["answer"]
    assert ("projektstatus-berlin-living.pdf", 1) in {(s["name"], s["page"]) for s in body["sources"]}
    assert body["answer_provider"] == "deterministic" and body["model"] == "deterministic-non-llm"
    assert body["claims"] and all(c["evidence_ids"] for c in body["claims"])


def test_unanswerable_question_abstains(local_client):
    body = local_client.post("/ask", json={"question": "Wie hoch sind die Mietpreise im Projekt Berlin Living?"}).json()
    assert body["abstained"] is True and body["sources"] == [] and body["requires_review"] is True


def test_invalid_question_rejected(local_client):
    assert local_client.post("/ask", json={"question": "ab"}).status_code == 422
    assert local_client.post("/ask", json={"question": "x" * 501}).status_code == 422
    assert local_client.post("/ask", json={"question": "Budget?", "extra": 1}).status_code == 422


def test_correlation_id_generated_or_echoed(local_client):
    assert len(local_client.get("/health").headers["X-Correlation-ID"]) >= 8
    assert (
        local_client.get("/health", headers={"X-Correlation-ID": "abcdef1234"}).headers["X-Correlation-ID"]
        == "abcdef1234"
    )
    assert (
        local_client.get("/health", headers={"X-Correlation-ID": "bad value!!"}).headers["X-Correlation-ID"]
        != "bad value!!"
    )


def test_no_wildcard_cors(local_client):
    r = local_client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in {k.lower() for k in r.headers}


def test_oversized_body_rejected(local_client):
    r = local_client.post(
        "/ask", content=b"x" * 5000, headers={"content-type": "application/json", "content-length": "5000"}
    )
    assert r.status_code == 413


def test_entra_mode_requires_valid_bearer_token(entra_client):
    q = {"question": "Wie ist der Status des Projekts Berlin Living?"}
    missing = entra_client.post("/ask", json=q)
    assert missing.status_code == 401 and missing.json()["error"]["code"] == "missing_token"
    assert missing.headers["WWW-Authenticate"].startswith("Bearer")
    ok = entra_client.post("/ask", json=q, headers={"Authorization": f"Bearer {token()}"})
    assert ok.status_code == 200 and ok.json()["grounded"] is True


@pytest.mark.parametrize(
    "overrides,code,status",
    [
        ({"iss": "https://login.microsoftonline.com/other/v2.0"}, "invalid_issuer", 401),
        ({"aud": "api://someone-else"}, "invalid_audience", 401),
        ({"tid": "99999999-0000-0000-0000-000000000000"}, "invalid_tenant", 401),
        (
            {"exp": int(time.time()) - 3600, "iat": int(time.time()) - 4000, "nbf": int(time.time()) - 4000},
            "token_expired",
            401,
        ),
        ({"scp": "Other.Scope"}, "insufficient_scope", 403),
    ],
)
def test_entra_rejections_return_stable_codes(entra_client, overrides, code, status):
    r = entra_client.get(
        "/documents/search", params={"q": "Berlin"}, headers={"Authorization": f"Bearer {token(**overrides)}"}
    )
    assert r.status_code == status and r.json()["error"]["code"] == code


def test_application_role_token_without_explicit_acl_mapping_sees_nothing(entra_client):
    r = entra_client.get(
        "/documents/search",
        params={"q": "Berlin"},
        headers={"Authorization": f"Bearer {token(scp=None, roles=['DocumentEvidence.Read'], oid='app-sp-unmapped')}"},
    )
    # An application identity without an explicit document mapping is denied (fail closed).
    assert r.status_code == 200 and r.json()["results"] == []


class FailingProvider:
    name = "graph"

    def __init__(self, error):
        self.error = error

    def search(self, ctx, query, max_results):
        raise self.error

    def list_documents(self, ctx, max_results):
        raise self.error

    def fetch_pdf(self, ctx, document_id):
        raise self.error


@pytest.mark.parametrize(
    "error,status,code",
    [
        (ProviderUnauthorized("x"), 502, "provider_unauthorized"),
        (ProviderForbidden("x"), 502, "provider_forbidden"),
        (ProviderTimeout("x"), 504, "provider_timeout"),
    ],
)
def test_provider_failures_are_explicit_and_never_answered_from_mock(settings, telemetry, error, status, code):
    service = EvidenceService(FailingProvider(error), telemetry=telemetry)
    client = TestClient(create_app(settings=settings, service=service))
    r = client.post("/ask", json={"question": "Wie ist der Status des Projekts Berlin Living?"})
    assert r.status_code == status and r.json()["error"]["code"] == code
    assert "answer" not in r.json()


def test_responses_label_every_component(local_client):
    body = local_client.post(
        "/ask", json={"question": "Wie ist der aktuelle Status des Projekts Berlin Living?"}
    ).json()
    assert body["labels"] == {
        "document_source": "simulated",
        "extraction": "verified-local",
        "answering": "verified-local",
        "data": "fictional",
    }
    health = local_client.get("/health").json()
    assert health["labels"]["document_source"] == "simulated"
    assert "live-verified" not in str(health) + str(body)
