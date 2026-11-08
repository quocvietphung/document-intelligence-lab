import pytest

from m365_poc.config import load_azure_config, load_settings
from m365_poc.errors import ConfigurationError

GUID = "11111111-2222-3333-4444-555555555555"


def test_defaults_are_mock_deterministic_local_loopback():
    s = load_settings({})
    assert (s.provider, s.extractor, s.answer_provider, s.auth_mode, s.host) == (
        "mock",
        "local",
        "deterministic",
        "local-dev",
        "127.0.0.1",
    )
    assert s.is_live_graph is False


def test_non_loopback_requires_entra_and_static_token_is_gone():
    with pytest.raises(ConfigurationError, match="entra"):
        load_settings({"M365_POC_HOST": "0.0.0.0", "M365_POC_API_TOKEN": "static-token-value"})
    s = load_settings(
        {
            "M365_POC_HOST": "0.0.0.0",
            "M365_POC_AUTH_MODE": "entra",
            "M365_POC_ENTRA_TENANT_ID": GUID,
            "M365_POC_ENTRA_AUDIENCE": "api://a",
        }
    )
    assert s.is_entra


def test_entra_needs_tenant_and_audience():
    with pytest.raises(ConfigurationError):
        load_settings({"M365_POC_AUTH_MODE": "entra"})


def test_local_dev_auth_refused_with_live_provider():
    with pytest.raises(ConfigurationError):
        load_settings(
            {
                "M365_POC_PROVIDER": "graph",
                "M365_POC_ENABLE_LIVE_GRAPH": "1",
                "M365_POC_TENANT_ID": GUID,
                "M365_POC_CLIENT_ID": GUID,
            }
        )


def test_graph_requires_explicit_opt_in_and_ids():
    with pytest.raises(ConfigurationError, match="ENABLE_LIVE_GRAPH"):
        load_settings(
            {
                "M365_POC_PROVIDER": "graph",
                "M365_POC_TENANT_ID": GUID,
                "M365_POC_CLIENT_ID": GUID,
                "M365_POC_AUTH_MODE": "entra",
                "M365_POC_ENTRA_TENANT_ID": GUID,
                "M365_POC_ENTRA_AUDIENCE": "a",
            }
        )


def test_azure_extractor_requires_opt_in_and_endpoint():
    with pytest.raises(ConfigurationError, match="LIVE_AZURE_DI"):
        load_settings({"M365_POC_EXTRACTOR": "azure-document-intelligence"})
    with pytest.raises(ConfigurationError):
        load_settings({"M365_POC_EXTRACTOR": "azure-document-intelligence", "M365_POC_ENABLE_LIVE_AZURE_DI": "1"})


def test_azure_openai_requires_opt_in():
    with pytest.raises(ConfigurationError, match="LIVE_AZURE_OPENAI"):
        load_settings({"M365_POC_ANSWER_PROVIDER": "azure-openai"})


def test_unknown_choices_rejected():
    for env in (
        {"M365_POC_EXTRACTOR": "tesseract"},
        {"M365_POC_ANSWER_PROVIDER": "gpt"},
        {"M365_POC_AUTH_MODE": "none"},
    ):
        with pytest.raises(ConfigurationError):
            load_settings(env)


def test_negative_price_rejected():
    with pytest.raises(ConfigurationError):
        load_settings({"M365_POC_LLM_PRICE_INPUT_PER_1K": "-1"})


def test_azure_endpoint_validation():
    base = {
        "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT": "https://example-docs.cognitiveservices.azure.com/",
        "AZURE_OPENAI_ENDPOINT": "https://example-openai.openai.azure.com/",
        "AZURE_OPENAI_DEPLOYMENT": "chat-deployment",
    }
    cfg = load_azure_config(base, require_document_intelligence=True, require_openai=True)
    assert cfg.openai_deployment == "chat-deployment"
    for bad in (
        "http://example-openai.openai.azure.com/",
        "https://attacker.example.com/",
        "https://example-openai.openai.azure.com/openai/v1/chat",
    ):
        with pytest.raises(ConfigurationError):
            load_azure_config({**base, "AZURE_OPENAI_ENDPOINT": bad})


def test_unauthenticated_docker_demo_only_allowed_for_fictional_local_mode():
    env = {"M365_POC_HOST": "0.0.0.0", "M365_POC_ALLOW_UNAUTHENTICATED_LOCAL_DOCKER": "1"}
    assert load_settings(env).host == "0.0.0.0"
    with pytest.raises(ConfigurationError):
        load_settings(
            {
                **env,
                "M365_POC_PROVIDER": "graph",
                "M365_POC_ENABLE_LIVE_GRAPH": "1",
                "M365_POC_TENANT_ID": GUID,
                "M365_POC_CLIENT_ID": GUID,
            }
        )
    with pytest.raises(ConfigurationError):
        load_settings(
            {
                **env,
                "M365_POC_EXTRACTOR": "azure-document-intelligence",
                "M365_POC_ENABLE_LIVE_AZURE_DI": "1",
                "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT": "https://x.cognitiveservices.azure.com/",
            }
        )


def test_tenant_identifiers_must_be_guids():
    with pytest.raises(ConfigurationError, match="GUID"):
        load_settings(
            {
                "M365_POC_AUTH_MODE": "entra",
                "M365_POC_ENTRA_TENANT_ID": "not a tenant!",
                "M365_POC_ENTRA_AUDIENCE": "api://x",
            }
        )
