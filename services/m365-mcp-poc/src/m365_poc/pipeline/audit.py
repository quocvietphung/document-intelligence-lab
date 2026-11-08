"""Redacted audit events. Fields are a fixed allowlist; tenant and document identifiers are fingerprinted."""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol

ALLOWED_FIELDS = frozenset(
    {
        "event",
        "job_status",
        "error_code",
        "attempt",
        "tenant_fp",
        "document_fp",
        "correlation_id",
        "records",
        "duplicate_of_fp",
    }
)


class AuditSink(Protocol):
    def emit(self, event: dict[str, object]) -> None: ...


def redact(event: dict[str, object]) -> dict[str, object]:
    clean: dict[str, object] = {
        k: v for k, v in event.items() if k in ALLOWED_FIELDS and isinstance(v, (str, int, type(None)))
    }
    clean["at"] = datetime.now(UTC).isoformat()
    return clean


class InMemoryAudit:
    def __init__(self) -> None:
        self.events: list[dict[str, object]] = []

    def emit(self, event: dict[str, object]) -> None:
        self.events.append(redact(event))


class JsonlAudit:
    def __init__(self, path: Path) -> None:
        self._path = path

    def emit(self, event: dict[str, object]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(self._path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        with os.fdopen(fd, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(redact(event), ensure_ascii=False) + "\n")
