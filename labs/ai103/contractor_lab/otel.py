"""Minimal OpenTelemetry tracer: W3C trace context, per-step spans and OTLP/HTTP JSON export.

Spans carry only names, counts and outcomes (never document text, amounts, prompts or tokens). The
same trace id is sent to the Java API in the `traceparent` header, so Java's Micrometer/OTel spans
(precheck.extract/search/reconcile/draft) join the agent's trace in the collector.
"""
from __future__ import annotations

import json
import secrets
import time
import urllib.request
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse


@dataclass
class Span:
    name: str
    trace_id: str
    span_id: str
    parent_id: str | None
    start_ns: int
    end_ns: int = 0
    attributes: dict = field(default_factory=dict)
    events: list = field(default_factory=list)
    status: str = "OK"

    @property
    def duration_ms(self) -> float:
        return round((self.end_ns - self.start_ns) / 1_000_000, 2)

    def set(self, key: str, value) -> None:
        if not isinstance(value, (str, int, float, bool)):
            raise TypeError("span attributes must be scalar")
        self.attributes[key] = value

    def event(self, name: str, **attributes) -> None:
        self.events.append({"name": name, "timeUnixNano": str(time.time_ns()), "attributes": attributes})


class Tracer:
    def __init__(self, service: str = "ai103-contractor-agent", trace_id: str | None = None):
        self.service = service
        self.trace_id = trace_id or secrets.token_hex(16)
        self.spans: list[Span] = []
        self._stack: list[Span] = []

    @contextmanager
    def span(self, name: str, **attributes):
        parent = self._stack[-1].span_id if self._stack else None
        span = Span(name, self.trace_id, secrets.token_hex(8), parent, time.time_ns())
        for key, value in attributes.items():
            span.set(key, value)
        self._stack.append(span)
        try:
            yield span
        except BaseException as error:
            span.status = "ERROR"
            span.set("error.type", type(error).__name__)
            raise
        finally:
            span.end_ns = time.time_ns()
            self._stack.pop()
            self.spans.append(span)

    def traceparent(self) -> str:
        parent = self._stack[-1].span_id if self._stack else secrets.token_hex(8)
        return f"00-{self.trace_id}-{parent}-01"

    def durations(self) -> dict[str, float]:
        return {span.name: span.duration_ms for span in self.spans}

    def otlp(self) -> dict:
        def value(item):
            if isinstance(item, bool):
                return {"boolValue": item}
            if isinstance(item, int):
                return {"intValue": str(item)}
            if isinstance(item, float):
                return {"doubleValue": item}
            return {"stringValue": str(item)}

        def attrs(mapping):
            return [{"key": key, "value": value(item)} for key, item in mapping.items()]

        spans = [{"traceId": s.trace_id, "spanId": s.span_id, **({"parentSpanId": s.parent_id} if s.parent_id else {}),
                  "name": s.name, "kind": 1, "startTimeUnixNano": str(s.start_ns), "endTimeUnixNano": str(s.end_ns),
                  "attributes": attrs(s.attributes),
                  "events": [{"name": e["name"], "timeUnixNano": e["timeUnixNano"], "attributes": attrs(e["attributes"])} for e in s.events],
                  "status": {"code": 2 if s.status == "ERROR" else 1}} for s in self.spans]
        return {"resourceSpans": [{"resource": {"attributes": attrs({"service.name": self.service})},
                                   "scopeSpans": [{"scope": {"name": "ai103-lab", "version": "1"}, "spans": spans}]}]}

    def export(self, endpoint: str) -> int:
        """POST OTLP/JSON to a collector. Only loopback or in-network collectors are accepted."""
        host = urlparse(endpoint).hostname or ""
        if host not in {"127.0.0.1", "localhost", "otel-collector"}:
            raise ValueError("Export only to the local collector; Application Insights goes through the collector config")
        request = urllib.request.Request(endpoint, data=json.dumps(self.otlp()).encode(), method="POST",
                                         headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status

    def write(self, path: Path) -> Path:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.otlp(), indent=1), encoding="utf-8")
        return path


def summarize_collector_file(path: Path, trace_id: str) -> list[dict]:
    """Read the collector's file exporter output (JSON lines) and list every span of one trace with its duration."""
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        for resource in json.loads(line).get("resourceSpans", []):
            service = next((a["value"].get("stringValue") for a in resource.get("resource", {}).get("attributes", [])
                            if a["key"] == "service.name"), "?")
            for scope in resource.get("scopeSpans", []):
                for span in scope.get("spans", []):
                    if span.get("traceId") != trace_id:
                        continue
                    rows.append({"service": service, "name": span["name"], "spanId": span["spanId"],
                                 "parentSpanId": span.get("parentSpanId", ""),
                                 "durationMs": round((int(span["endTimeUnixNano"]) - int(span["startTimeUnixNano"])) / 1e6, 2)})
    return sorted(rows, key=lambda row: row["name"])
