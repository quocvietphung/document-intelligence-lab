import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from opentelemetry.sdk.metrics import MeterProvider  # noqa: E402
from opentelemetry.sdk.metrics.export import InMemoryMetricReader  # noqa: E402

from m365_poc.api import build_service  # noqa: E402
from m365_poc.auth import AuthContext  # noqa: E402
from m365_poc.config import Settings  # noqa: E402
from m365_poc.telemetry import Telemetry  # noqa: E402

FIXTURES = ROOT / "fixtures"
RECORDED = Path(__file__).resolve().parent / "recorded"
TENANT = "fictional-tenant-001"


@pytest.fixture
def settings() -> Settings:
    return Settings(fixtures_dir=FIXTURES / "pdfs", manifest_path=FIXTURES / "manifest.json")


@pytest.fixture
def local_ctx() -> AuthContext:
    return AuthContext(tenant_id=TENANT, principal_id="local-dev-user", mode="local-dev")


@pytest.fixture
def other_ctx() -> AuthContext:
    return AuthContext(tenant_id=TENANT, principal_id="someone-else", mode="local-dev")


@pytest.fixture
def metrics() -> InMemoryMetricReader:
    return InMemoryMetricReader()


@pytest.fixture
def telemetry(metrics: InMemoryMetricReader) -> Telemetry:
    return Telemetry(MeterProvider(metric_readers=[metrics]))


@pytest.fixture
def mock_service(settings: Settings, telemetry: Telemetry):
    return build_service(settings, telemetry=telemetry)


@pytest.fixture
def recorded_di() -> dict:
    return json.loads((RECORDED / "di_layout_success.json").read_text(encoding="utf-8"))
