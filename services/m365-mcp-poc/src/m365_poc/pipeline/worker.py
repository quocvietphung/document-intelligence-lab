"""Asynchronous, read-only document pipeline.

Steps: discover (event) → read (authorised fetch) → validate (MIME, magic bytes, size) → hash →
idempotency and duplicate checks → extract (configured extractor) → store evidence records → audit.

Retry policy: only PipelineTransientError is retried, with backoff, up to max_attempts; then DEAD_LETTER.
PipelinePermanentError marks FAILED without retry. Cancellation is checked between stages.
Nothing here writes back to SharePoint, Dynamics or any source system.
"""

from __future__ import annotations

import hashlib
import logging
import uuid
from collections.abc import Callable

from ..auth import AuthContext
from ..errors import ExtractionError, ProviderError, ProviderNotFound
from ..extraction import MAX_PDF_BYTES, PageText
from ..service import EvidenceService
from ..telemetry import Telemetry
from .audit import AuditSink
from .models import (
    TERMINAL,
    DocumentEvent,
    Job,
    JobStatus,
    PipelinePermanentError,
    PipelineTransientError,
    fingerprint,
    idempotency_key,
)
from .queue import MessageQueue, QueuedMessage
from .store import EvidenceRecord, EvidenceStore, JobStore, StoreUnavailable

logger = logging.getLogger("m365_poc.pipeline")
PDF_MIME = "application/pdf"


class _Cancelled(Exception):
    pass


class DocumentPipeline:
    def __init__(
        self,
        *,
        service: EvidenceService,
        jobs: JobStore,
        evidence: EvidenceStore,
        queue: MessageQueue,
        audit: AuditSink,
        telemetry: Telemetry,
        auth_mode: str,
        clock: Callable[[], float],
        max_attempts: int = 3,
        backoff_seconds: Callable[[int], float] = lambda attempt: float(2**attempt),
    ) -> None:
        self._service = service
        self._jobs = jobs
        self._evidence = evidence
        self._queue = queue
        self._audit = audit
        self._telemetry = telemetry
        self._auth_mode = auth_mode
        self._clock = clock
        self._max_attempts = max_attempts
        self._backoff = backoff_seconds

    # -- submission and control --------------------------------------------------
    def submit(self, event: DocumentEvent) -> Job:
        existing = self._jobs.latest(event.tenant_id, event.document_id, event.version)
        if existing is not None:
            return existing  # idempotent: the same tenant, document and version is never queued twice
        job = Job(
            job_id=uuid.uuid4().hex,
            tenant_id=event.tenant_id,
            document_id=event.document_id,
            version=event.version,
            principal_id=event.principal_id,
            correlation_id=event.correlation_id,
            max_attempts=self._max_attempts,
        )
        self._jobs.put(job)
        self._queue.send(event)
        self._emit(job, "submitted")
        return job

    def cancel(self, job_id: str) -> Job:
        job = self._jobs.get(job_id)
        if job is None:
            raise KeyError("unknown job")
        if job.status not in TERMINAL:
            job.cancel_requested = True
            job.touch()
            self._jobs.put(job)
        return job

    def status(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def run_until_idle(self, max_messages: int = 1000) -> int:
        processed = 0
        while processed < max_messages:
            message = self._queue.receive()
            if message is None:
                break
            self._process(message)
            processed += 1
        return processed

    # -- processing ----------------------------------------------------------------
    def _process(self, message: QueuedMessage) -> None:
        event = message.event
        job = self._jobs.latest(event.tenant_id, event.document_id, event.version)
        if job is None or job.status in TERMINAL:
            return  # duplicate delivery of a finished job
        job.status = JobStatus.RUNNING
        job.attempts += 1
        job.touch()
        self._jobs.put(job)
        try:
            self._run(job, event)
        except _Cancelled:
            job.status = JobStatus.CANCELLED
        except PipelinePermanentError as exc:
            job.status = JobStatus.FAILED
            job.error_code = exc.code
        except PipelineTransientError as exc:
            job.error_code = exc.code
            if job.attempts < job.max_attempts:
                job.status = JobStatus.RETRY_SCHEDULED
                delay = max(self._backoff(job.attempts), exc.retry_after or 0.0)
                self._queue.requeue(message, delay)
            else:
                job.status = JobStatus.DEAD_LETTER
                self._queue.dead_letter(message, exc.code)
        job.touch()
        self._jobs.put(job)
        self._emit(job, "transition")
        self._telemetry.record_pipeline(job.status.value)

    def _check_cancel(self, job: Job) -> None:
        current = self._jobs.get(job.job_id)
        if job.cancel_requested or (current is not None and current.cancel_requested):
            raise _Cancelled()

    def _run(self, job: Job, event: DocumentEvent) -> None:
        self._check_cancel(job)
        ctx = AuthContext(tenant_id=event.tenant_id, principal_id=event.principal_id, mode=self._auth_mode)
        try:
            fetched = self._service.fetch_authorised(ctx, event.document_id)
        except ProviderNotFound as exc:
            raise PipelinePermanentError("not_found_or_unauthorised") from exc
        except ProviderError as exc:
            raise self._classify(exc) from exc

        ref = fetched.ref
        data = fetched.data
        if ref.mime_type not in (None, PDF_MIME) or not data.startswith(b"%PDF-"):
            raise PipelinePermanentError("unsupported_type")
        if len(data) > MAX_PDF_BYTES:
            raise PipelinePermanentError("size_limit")

        content_hash = hashlib.sha256(data).hexdigest()
        job.content_hash = content_hash
        key = idempotency_key(event.tenant_id, event.document_id, event.version, content_hash)
        job.idempotency_key = key
        same_key = self._jobs.find_by_key(key)
        if same_key is not None and same_key.job_id != job.job_id and same_key.status == JobStatus.SUCCEEDED:
            self._mark_duplicate(job, same_key.job_id)
            return
        other = self._jobs.find_succeeded_by_hash(event.tenant_id, content_hash, event.document_id)
        if other is not None:
            self._mark_duplicate(job, other.job_id)
            return

        self._check_cancel(job)
        try:
            pages = self._service.extract_bytes(data)
        except ExtractionError as exc:
            raise PipelinePermanentError(f"extraction_{exc.reason}") from exc
        except ProviderError as exc:
            raise self._classify(exc) from exc

        self._check_cancel(job)
        records = list(self._records(event, ref, content_hash, pages))
        try:
            written = self._evidence.upsert_many(records)
        except StoreUnavailable as exc:
            # Records are keyed, so a retry overwrites what was already written: no duplicates, no gaps.
            raise PipelineTransientError("store_unavailable") from exc
        job.records_written = written
        job.status = JobStatus.SUCCEEDED
        job.error_code = None

    def _mark_duplicate(self, job: Job, original_id: str) -> None:
        job.status = JobStatus.DUPLICATE
        job.duplicate_of = original_id

    @staticmethod
    def _classify(exc: ProviderError) -> Exception:
        if getattr(exc, "transient", False):
            return PipelineTransientError(exc.code, getattr(exc, "retry_after", None))
        return PipelinePermanentError(exc.code)

    @staticmethod
    def _records(event: DocumentEvent, ref, content_hash: str, pages: list[PageText]):  # type: ignore[no-untyped-def]
        allowed = sorted(ref.allowed_principals) if ref.allowed_principals is not None else None
        for page in pages:
            for index, block in enumerate(page.blocks):
                yield EvidenceRecord(
                    tenant_id=event.tenant_id,
                    document_id=event.document_id,
                    version=event.version,
                    content_hash=content_hash,
                    page=page.page,
                    block_index=index,
                    text=block.text,
                    polygon=list(block.polygon) if block.polygon else None,
                    table_id=block.table_id,
                    extractor=page.extractor,
                    rotation=page.rotation,
                    needs_ocr=page.needs_ocr,
                    acl_source=ref.acl_source,
                    allowed_principals=allowed,
                    name=ref.name,
                )

    def _emit(self, job: Job, event_name: str) -> None:
        self._audit.emit(
            {
                "event": f"pipeline.{event_name}",
                "job_status": job.status.value,
                "error_code": job.error_code,
                "attempt": job.attempts,
                "tenant_fp": fingerprint(job.tenant_id),
                "document_fp": fingerprint(job.document_id),
                "correlation_id": job.correlation_id,
                "records": job.records_written,
                "duplicate_of_fp": fingerprint(job.duplicate_of) if job.duplicate_of else None,
            }
        )
        logger.info("pipeline status=%s cid=%s", job.status.value, job.correlation_id)
