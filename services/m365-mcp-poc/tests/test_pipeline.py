"""Asynchronous pipeline: idempotency, retry policy, dead-letter, cancellation, partial failure, redacted audit."""

import hashlib
import json

import pytest

from m365_poc.auth import AuthContext
from m365_poc.errors import ProviderTimeout, ProviderUnavailable
from m365_poc.extraction import extract_pages
from m365_poc.pipeline.audit import InMemoryAudit
from m365_poc.pipeline.models import DocumentEvent, JobStatus
from m365_poc.pipeline.queue import InMemoryQueue
from m365_poc.pipeline.store import InMemoryEvidenceStore, InMemoryJobStore, StoreUnavailable
from m365_poc.pipeline.worker import DocumentPipeline
from m365_poc.providers.base import FetchedDocument

TENANT = "fictional-tenant-001"
PRINCIPAL = "local-dev-user"


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


class Harness:
    def __init__(self, service, telemetry, *, max_attempts=3, store=None):
        self.clock = Clock()
        self.jobs = InMemoryJobStore()
        self.evidence = store if store is not None else InMemoryEvidenceStore()
        self.queue = InMemoryQueue(clock=self.clock)
        self.audit = InMemoryAudit()
        self.pipeline = DocumentPipeline(
            service=service,
            jobs=self.jobs,
            evidence=self.evidence,
            queue=self.queue,
            audit=self.audit,
            telemetry=telemetry,
            auth_mode="local-dev",
            clock=self.clock,
            max_attempts=max_attempts,
        )

    def event(self, document_id, version="v1", correlation="corr-0000000001"):
        return DocumentEvent(
            tenant_id=TENANT,
            document_id=document_id,
            version=version,
            principal_id=PRINCIPAL,
            correlation_id=correlation,
        )


@pytest.fixture
def harness(mock_service, telemetry):
    return Harness(mock_service, telemetry)


def test_happy_path_writes_evidence_and_succeeds(harness):
    job = harness.pipeline.submit(harness.event("project-status-001"))
    harness.pipeline.run_until_idle()
    done = harness.jobs.get(job.job_id)
    assert done.status == JobStatus.SUCCEEDED and done.records_written > 0 and done.attempts == 1
    assert done.content_hash and done.idempotency_key


def test_same_event_submitted_twice_is_queued_once(harness):
    first = harness.pipeline.submit(harness.event("project-status-001"))
    second = harness.pipeline.submit(harness.event("project-status-001"))
    assert first.job_id == second.job_id
    assert len(harness.queue) == 1


def test_identical_content_under_another_document_is_a_duplicate(harness, settings):
    harness.pipeline.submit(harness.event("project-status-001"))
    harness.pipeline.run_until_idle()
    # Another document ID whose bytes are identical to an already-indexed file.
    same_bytes = (settings.fixtures_dir / "projektstatus-berlin-living.pdf").read_bytes()
    original_fetch = harness.pipeline._service.fetch_authorised

    def fake_fetch(ctx, document_id):
        ref = original_fetch(ctx, "project-status-001").ref
        from dataclasses import replace

        return FetchedDocument(ref=replace(ref, document_id=document_id), data=same_bytes)

    harness.pipeline._service.fetch_authorised = fake_fetch
    dup = harness.pipeline.submit(harness.event("copy-of-status-999"))
    harness.pipeline.run_until_idle()
    done = harness.jobs.get(dup.job_id)
    assert done.status == JobStatus.DUPLICATE and done.duplicate_of


def test_transient_failure_retries_then_succeeds(harness, monkeypatch):
    service = harness.pipeline._service
    original = service.fetch_authorised
    calls = {"n": 0}

    def flaky(ctx, document_id):
        calls["n"] += 1
        if calls["n"] == 1:
            raise ProviderTimeout("simulated")
        return original(ctx, document_id)

    monkeypatch.setattr(service, "fetch_authorised", flaky)
    job = harness.pipeline.submit(harness.event("project-status-001"))
    harness.pipeline.run_until_idle()
    assert harness.jobs.get(job.job_id).status == JobStatus.RETRY_SCHEDULED
    harness.clock.now += 10  # the retry becomes visible after the backoff
    harness.pipeline.run_until_idle()
    done = harness.jobs.get(job.job_id)
    assert done.status == JobStatus.SUCCEEDED and done.attempts == 2


def test_transient_failures_exhaust_retries_into_dead_letter(harness, monkeypatch):
    service = harness.pipeline._service

    def always_down(ctx, document_id):
        raise ProviderUnavailable("simulated")

    monkeypatch.setattr(service, "fetch_authorised", always_down)
    job = harness.pipeline.submit(harness.event("project-status-001"))
    for _ in range(10):
        harness.clock.now += 100
        harness.pipeline.run_until_idle()
    done = harness.jobs.get(job.job_id)
    assert done.status == JobStatus.DEAD_LETTER and done.attempts == 3
    assert harness.queue.dead_letters and harness.queue.dead_letters[0][1] == "provider_unavailable"


def test_permanent_failure_is_not_retried(harness):
    job = harness.pipeline.submit(harness.event("no-such-document"))
    harness.pipeline.run_until_idle()
    done = harness.jobs.get(job.job_id)
    assert done.status == JobStatus.FAILED and done.attempts == 1
    assert done.error_code == "not_found_or_unauthorised"


def test_unauthorised_document_looks_identical_to_missing(harness):
    job = harness.pipeline.submit(
        DocumentEvent(
            tenant_id=TENANT,
            document_id="restricted-exec-001",
            version="v1",
            principal_id="someone-else",
            correlation_id="corr-0000000002",
        )
    )
    harness.pipeline.run_until_idle()
    assert harness.jobs.get(job.job_id).error_code == "not_found_or_unauthorised"
    assert len(harness.evidence) == 0


def test_cancel_before_processing_writes_nothing(harness):
    job = harness.pipeline.submit(harness.event("project-status-001"))
    harness.pipeline.cancel(job.job_id)
    harness.pipeline.run_until_idle()
    assert harness.jobs.get(job.job_id).status == JobStatus.CANCELLED
    assert len(harness.evidence) == 0


def test_cancel_during_extraction_stops_before_storing(harness, monkeypatch):
    service = harness.pipeline._service
    job = harness.pipeline.submit(harness.event("project-status-001"))

    def extract_then_cancel(data):
        harness.pipeline.cancel(job.job_id)
        return extract_pages(data)

    monkeypatch.setattr(service, "extract_bytes", extract_then_cancel)
    harness.pipeline.run_until_idle()
    assert harness.jobs.get(job.job_id).status == JobStatus.CANCELLED
    assert len(harness.evidence) == 0


class FlakyStore(InMemoryEvidenceStore):
    """Fails once after writing part of a batch, like a dropped connection mid-write."""

    def __init__(self):
        super().__init__()
        self.failed = False

    def upsert_many(self, records):
        records = list(records)
        if not self.failed and len(records) > 2:
            self.failed = True
            super().upsert_many(records[:2])
            raise StoreUnavailable("connection dropped")
        return super().upsert_many(records)


def test_partial_store_failure_is_retried_without_duplicates_or_gaps(mock_service, telemetry, settings):
    store = FlakyStore()
    h = Harness(mock_service, telemetry, store=store)
    job = h.pipeline.submit(h.event("project-status-001"))
    h.pipeline.run_until_idle()
    assert h.jobs.get(job.job_id).status == JobStatus.RETRY_SCHEDULED
    h.clock.now += 10
    h.pipeline.run_until_idle()
    done = h.jobs.get(job.job_id)
    assert done.status == JobStatus.SUCCEEDED
    total_pages = sum(
        len(p.blocks) for p in extract_pages((settings.fixtures_dir / "projektstatus-berlin-living.pdf").read_bytes())
    )
    assert len(store) == total_pages  # keyed upserts: no duplicate rows, no missing rows


def test_evidence_search_respects_tenant_and_acl(harness, local_ctx, other_ctx):
    harness.pipeline.submit(harness.event("project-status-001"))
    harness.pipeline.submit(harness.event("restricted-exec-001"))
    harness.pipeline.run_until_idle()
    assert any(
        h["name"] == "projektstatus-berlin-living.pdf" for h in harness.evidence.search(local_ctx, "Berlin Living", 10)
    )
    assert not any("vorstand" in h["name"] for h in harness.evidence.search(local_ctx, "Berlin Living", 10))
    assert harness.evidence.search(other_ctx, "Berlin Living", 10) == []
    foreign = AuthContext(tenant_id="other-tenant", principal_id="local-dev-user", mode="local-dev")
    assert harness.evidence.search(foreign, "Berlin Living", 10) == []


def test_unsupported_type_is_a_permanent_failure(harness, monkeypatch):
    service = harness.pipeline._service
    original = service.fetch_authorised

    def not_a_pdf(ctx, document_id):
        fetched = original(ctx, document_id)
        return FetchedDocument(ref=fetched.ref, data=b"<html>not pdf</html>")

    monkeypatch.setattr(service, "fetch_authorised", not_a_pdf)
    job = harness.pipeline.submit(harness.event("project-status-001"))
    harness.pipeline.run_until_idle()
    assert harness.jobs.get(job.job_id).error_code == "unsupported_type"


def test_audit_events_are_redacted(harness):
    harness.pipeline.submit(harness.event("project-status-001"))
    harness.pipeline.run_until_idle()
    blob = json.dumps(harness.audit.events, ensure_ascii=False)
    for forbidden in ("Berlin", "projektstatus", "project-status-001", TENANT, "Projektname", "20.11.2026", PRINCIPAL):
        assert forbidden not in blob, forbidden
    allowed = {
        "event",
        "job_status",
        "error_code",
        "attempt",
        "tenant_fp",
        "document_fp",
        "correlation_id",
        "records",
        "duplicate_of_fp",
        "at",
    }
    assert all(set(e) <= allowed for e in harness.audit.events)
    assert hashlib.sha256(TENANT.encode()).hexdigest()[:16] in blob  # fingerprint, not the raw tenant
