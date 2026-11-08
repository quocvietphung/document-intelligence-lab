"""Job and evidence stores. In-memory for tests; JSON file-backed for local runs (atomic writes, 0600)."""

from __future__ import annotations

import json
import os
import re
import uuid
from collections.abc import Iterable
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Protocol

from ..auth import AuthContext, can_read
from .models import Job, JobStatus


class StoreUnavailable(Exception):
    """Raised by a store to signal a transient failure."""


@dataclass
class EvidenceRecord:
    tenant_id: str
    document_id: str
    version: str
    content_hash: str
    page: int
    block_index: int
    text: str
    polygon: list[float] | None
    table_id: str | None
    extractor: str
    rotation: int
    needs_ocr: bool
    acl_source: str
    allowed_principals: list[str] | None
    name: str

    @property
    def key(self) -> tuple[str, str, str, str, int, int]:
        return (self.tenant_id, self.document_id, self.version, self.content_hash, self.page, self.block_index)


class JobStore(Protocol):
    def find_by_key(self, key: str) -> Job | None: ...
    def find_succeeded_by_hash(self, tenant_id: str, content_hash: str, document_id: str) -> Job | None: ...
    def latest(self, tenant_id: str, document_id: str, version: str) -> Job | None: ...
    def get(self, job_id: str) -> Job | None: ...
    def put(self, job: Job) -> None: ...


class EvidenceStore(Protocol):
    def upsert_many(self, records: Iterable[EvidenceRecord]) -> int: ...
    def search(self, ctx: AuthContext, query: str, limit: int) -> list[dict[str, Any]]: ...


class InMemoryJobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}

    def find_by_key(self, key: str) -> Job | None:
        return next((j for j in self._jobs.values() if j.idempotency_key == key), None)

    def find_succeeded_by_hash(self, tenant_id: str, content_hash: str, document_id: str) -> Job | None:
        return next(
            (
                j
                for j in self._jobs.values()
                if j.tenant_id == tenant_id
                and j.content_hash == content_hash
                and j.document_id != document_id
                and j.status == JobStatus.SUCCEEDED
            ),
            None,
        )

    def latest(self, tenant_id: str, document_id: str, version: str) -> Job | None:
        matches = [
            j
            for j in self._jobs.values()
            if (j.tenant_id, j.document_id, j.version) == (tenant_id, document_id, version)
        ]
        return matches[-1] if matches else None

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def put(self, job: Job) -> None:
        self._jobs[job.job_id] = job


class FileJobStore(InMemoryJobStore):
    """Persists the job table as JSON with an atomic replace. Suitable for a local demo, not for concurrency."""

    def __init__(self, path: Path) -> None:
        super().__init__()
        self._path = path
        if path.exists():
            for raw in json.loads(path.read_text(encoding="utf-8")):
                raw["status"] = JobStatus(raw["status"])
                self._jobs[raw["job_id"]] = Job(**raw)

    def put(self, job: Job) -> None:
        super().put(job)
        self._flush()

    def _flush(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(f".{uuid.uuid4().hex}.tmp")
        data = [{**asdict(j), "status": j.status.value} for j in self._jobs.values()]
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False)
        os.replace(tmp, self._path)


class InMemoryEvidenceStore:
    _TOKEN = re.compile(r"[a-zäöüß0-9][a-zäöüß0-9\-]*", re.IGNORECASE)

    def __init__(self) -> None:
        self._records: dict[tuple[str, str, str, str, int, int], EvidenceRecord] = {}

    def upsert_many(self, records: Iterable[EvidenceRecord]) -> int:
        count = 0
        for record in records:
            self._records[record.key] = record  # idempotent: the same key overwrites itself
            count += 1
        return count

    def __len__(self) -> int:
        return len(self._records)

    def search(self, ctx: AuthContext, query: str, limit: int) -> list[dict[str, Any]]:
        terms = [t.lower() for t in self._TOKEN.findall(query) if len(t) >= 3]
        hits: list[dict[str, Any]] = []
        for record in self._records.values():
            if not can_read(
                ctx,
                tenant_id=record.tenant_id,
                allowed_principals=frozenset(record.allowed_principals)
                if record.allowed_principals is not None
                else None,
                acl_source=record.acl_source,
            ):
                continue
            text = record.text.lower()
            score = sum(text.count(t) for t in terms)
            if score:
                hits.append(
                    {
                        "document_id": record.document_id,
                        "name": record.name,
                        "page": record.page,
                        "text": record.text[:300],
                        "score": score,
                    }
                )
        hits.sort(key=lambda h: (-h["score"], h["name"], h["page"]))
        return hits[:limit]
