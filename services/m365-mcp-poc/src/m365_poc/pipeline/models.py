"""Pipeline data model. Job records hold identifiers and hashes, never document text."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    RETRY_SCHEDULED = "retry_scheduled"
    SUCCEEDED = "succeeded"
    DUPLICATE = "duplicate"
    FAILED = "failed"  # permanent: not retried
    DEAD_LETTER = "dead_letter"  # transient failures exhausted the retry limit
    CANCELLED = "cancelled"


TERMINAL = frozenset(
    {JobStatus.SUCCEEDED, JobStatus.DUPLICATE, JobStatus.FAILED, JobStatus.DEAD_LETTER, JobStatus.CANCELLED}
)


class PipelinePermanentError(Exception):
    """Do not retry: unsupported type, too large, encrypted, not found, not authorised, bad document."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class PipelineTransientError(Exception):
    """May succeed later: throttling, timeouts, network, store unavailable."""

    def __init__(self, code: str, retry_after: float | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.retry_after = retry_after


@dataclass(frozen=True)
class DocumentEvent:
    """A discovery or change notification. It names what to process, not what to write back."""

    tenant_id: str
    document_id: str
    version: str
    principal_id: str
    correlation_id: str
    kind: str = "discovered"  # discovered | modified


@dataclass
class Job:
    job_id: str
    tenant_id: str
    document_id: str
    version: str
    principal_id: str
    correlation_id: str
    status: JobStatus = JobStatus.QUEUED
    attempts: int = 0
    max_attempts: int = 3
    content_hash: str | None = None
    idempotency_key: str | None = None
    duplicate_of: str | None = None
    error_code: str | None = None
    cancel_requested: bool = False
    records_written: int = 0
    updated_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def touch(self) -> None:
        self.updated_at = datetime.now(UTC).isoformat()


def idempotency_key(tenant_id: str, document_id: str, version: str, content_hash: str) -> str:
    return hashlib.sha256(f"{tenant_id}|{document_id}|{version}|{content_hash}".encode()).hexdigest()


def fingerprint(value: str) -> str:
    """Short, non-reversible identifier for audit records (never the raw tenant or document ID)."""
    return hashlib.sha256(value.encode()).hexdigest()[:16]
