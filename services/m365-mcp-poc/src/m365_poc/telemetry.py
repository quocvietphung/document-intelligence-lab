"""OpenTelemetry metrics for the PoC. Low-cardinality attributes only, from a fixed allowlist.

Never recorded: question text, answers, prompts, evidence text, document names or IDs, tokens, personal data.
Estimated model cost is computed only when both price settings are configured; otherwise it is not recorded.
"""

from __future__ import annotations

from typing import Any

from opentelemetry.metrics import Counter, Histogram, Meter
from opentelemetry.sdk.metrics import MeterProvider

METER_NAME = "m365_poc"
ALLOWED_ATTRIBUTES = frozenset(
    {"route", "status_code", "provider", "operation", "outcome", "kind", "reason", "direction", "model", "status"}
)
ALLOWED_VALUES_MAX_LEN = 48


def _attrs(**values: Any) -> dict[str, str | int]:
    """Keep only allowlisted keys with short scalar values. Anything else is dropped, never recorded."""
    clean: dict[str, str | int] = {}
    for key, value in values.items():
        if key not in ALLOWED_ATTRIBUTES or value is None:
            continue
        if isinstance(value, bool):
            continue
        if isinstance(value, int) or (isinstance(value, str) and len(value) <= ALLOWED_VALUES_MAX_LEN):
            clean[key] = value
    return clean


class Telemetry:
    def __init__(
        self,
        meter_provider: MeterProvider | None = None,
        *,
        price_input_per_1k: float | None = None,
        price_output_per_1k: float | None = None,
    ) -> None:
        self._provider = meter_provider or MeterProvider()
        meter: Meter = self._provider.get_meter(METER_NAME)
        self._price_in = price_input_per_1k
        self._price_out = price_output_per_1k
        self.requests: Counter = meter.create_counter("m365poc.http.server.requests", unit="{request}")
        self.request_duration: Histogram = meter.create_histogram("m365poc.http.server.duration", unit="ms")
        self.provider_duration: Histogram = meter.create_histogram("m365poc.provider.duration", unit="ms")
        self.provider_errors: Counter = meter.create_counter("m365poc.provider.errors", unit="{error}")
        self.throttled: Counter = meter.create_counter("m365poc.provider.throttled", unit="{event}")
        self.extraction_errors: Counter = meter.create_counter("m365poc.extraction.errors", unit="{error}")
        self.answers: Counter = meter.create_counter("m365poc.answers", unit="{answer}")
        self.citation_failures: Counter = meter.create_counter("m365poc.citation.validation_failures", unit="{event}")
        self.unsupported: Counter = meter.create_counter("m365poc.unsupported_answers", unit="{answer}")
        self.tokens: Counter = meter.create_counter("m365poc.llm.tokens", unit="{token}")
        self.cost: Counter = meter.create_counter("m365poc.llm.estimated_cost_usd", unit="USD")
        self.pipeline_jobs: Counter = meter.create_counter("m365poc.pipeline.jobs", unit="{job}")

    def shutdown(self) -> None:
        self._provider.shutdown()

    def record_request(self, route: str, status_code: int, duration_ms: float) -> None:
        attrs = _attrs(route=route, status_code=status_code)
        self.requests.add(1, attrs)
        self.request_duration.record(duration_ms, attrs)

    def record_provider(self, provider: str, operation: str, outcome: str, duration_ms: float) -> None:
        attrs = _attrs(provider=provider, operation=operation, outcome=outcome)
        self.provider_duration.record(duration_ms, attrs)

    def record_provider_error(self, provider: str, code: str) -> None:
        self.provider_errors.add(1, _attrs(provider=provider, kind=code))
        if code == "provider_rate_limited":
            self.throttled.add(1, _attrs(provider=provider))

    def record_extraction_error(self, kind: str) -> None:
        self.extraction_errors.add(1, _attrs(kind=kind))

    def record_answer(self, outcome: str, reason: str | None = None) -> None:
        self.answers.add(1, _attrs(outcome=outcome, reason=reason))

    def record_citation_failure(self, reason: str) -> None:
        self.citation_failures.add(1, _attrs(reason=reason))

    def record_unsupported(self) -> None:
        self.unsupported.add(1)

    def record_usage(self, model: str, usage: dict[str, int] | None) -> None:
        if not usage:
            return
        prompt = usage.get("prompt_tokens", 0)
        completion = usage.get("completion_tokens", 0)
        self.tokens.add(prompt, _attrs(direction="input", model=model))
        self.tokens.add(completion, _attrs(direction="output", model=model))
        if self._price_in is not None and self._price_out is not None:
            estimate = prompt / 1000 * self._price_in + completion / 1000 * self._price_out
            self.cost.add(estimate, _attrs(model=model))

    def record_pipeline(self, status: str) -> None:
        self.pipeline_jobs.add(1, _attrs(status=status))
