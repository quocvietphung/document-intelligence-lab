"""OpenTelemetry instrumentation: metrics exist, attributes are allowlisted, no content is exported."""

from m365_poc.telemetry import ALLOWED_ATTRIBUTES, _attrs


def _data_points(reader):
    data = reader.get_metrics_data()
    points = []
    for rm in data.resource_metrics:
        for sm in rm.scope_metrics:
            for metric in sm.metrics:
                for point in metric.data.data_points:
                    points.append((metric.name, dict(point.attributes or {})))
    return points


def test_request_and_answer_metrics_are_recorded(local_ctx, mock_service, metrics):
    mock_service.ask(local_ctx, "Wie ist der aktuelle Status des Projekts Berlin Living?")
    mock_service.telemetry.record_request("/ask", 200, 12.5)
    names = {name for name, _ in _data_points(metrics)}
    assert {"m365poc.answers", "m365poc.http.server.requests", "m365poc.provider.duration"} <= names


def test_exported_attributes_never_contain_question_or_answer_text(local_ctx, mock_service, metrics):
    question = "Wie ist der aktuelle Status des Projekts Berlin Living und wann ist der nächste Termin?"
    response = mock_service.ask(local_ctx, question)
    mock_service.telemetry.record_request("/ask", 200, 3.0)
    blob = repr(_data_points(metrics))
    assert question not in blob
    assert response.answer not in blob
    assert "Berlin" not in blob and "projektstatus" not in blob and "local-dev-user" not in blob


def test_attribute_filter_drops_unknown_keys_and_long_values():
    clean = _attrs(route="/ask", tenant="fictional-tenant-001", question="secret text", outcome="x" * 200)
    assert set(clean) <= ALLOWED_ATTRIBUTES
    assert "tenant" not in clean and "question" not in clean and "outcome" not in clean


def test_cost_is_estimated_only_when_prices_are_configured(metrics):
    from opentelemetry.sdk.metrics import MeterProvider

    from m365_poc.telemetry import Telemetry

    unpriced = Telemetry(MeterProvider(metric_readers=[metrics]))
    unpriced.record_usage("model-x", {"prompt_tokens": 1000, "completion_tokens": 500})
    assert "m365poc.llm.estimated_cost_usd" not in {n for n, _ in _data_points(metrics)}
    priced_metrics = __import__(
        "opentelemetry.sdk.metrics.export", fromlist=["InMemoryMetricReader"]
    ).InMemoryMetricReader()
    priced = Telemetry(
        MeterProvider(metric_readers=[priced_metrics]), price_input_per_1k=0.002, price_output_per_1k=0.008
    )
    priced.record_usage("model-x", {"prompt_tokens": 1000, "completion_tokens": 500})
    costs = [p for n, p in _data_points(priced_metrics) if n == "m365poc.llm.estimated_cost_usd"]
    assert costs
