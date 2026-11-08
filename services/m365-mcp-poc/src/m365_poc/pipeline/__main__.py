"""Local pipeline runner. Uses the configured provider (mock by default) and prints statuses only, never content.

python -m m365_poc.pipeline run [--principal local-dev-user] [--state-dir DIR] [--search "Berlin Living"]
"""

from __future__ import annotations

import argparse
import json
import time
import uuid
from pathlib import Path

from ..api import build_service
from ..auth import LOCAL_PRINCIPAL, AuthContext
from ..config import load_settings
from ..telemetry import Telemetry
from .audit import AuditSink, InMemoryAudit, JsonlAudit
from .models import DocumentEvent
from .queue import InMemoryQueue
from .store import FileJobStore, InMemoryEvidenceStore, InMemoryJobStore, JobStore
from .worker import DocumentPipeline


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the bounded read-only document pipeline locally.")
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run")
    run.add_argument("--principal", default=LOCAL_PRINCIPAL)
    run.add_argument(
        "--state-dir", type=Path, default=None, help="Directory for job state and audit log (created 0600)."
    )
    run.add_argument("--search", default=None, help="Optional query against the stored evidence records.")
    args = parser.parse_args(argv)

    settings = load_settings()
    service = build_service(settings, telemetry=Telemetry())
    jobs: JobStore
    audit: AuditSink
    if args.state_dir:
        jobs = FileJobStore(args.state_dir / "jobs.json")
        audit = JsonlAudit(args.state_dir / "audit.jsonl")
    else:
        jobs, audit = InMemoryJobStore(), InMemoryAudit()
    evidence = InMemoryEvidenceStore()
    queue = InMemoryQueue(clock=time.monotonic)
    pipeline = DocumentPipeline(
        service=service,
        jobs=jobs,
        evidence=evidence,
        queue=queue,
        audit=audit,
        telemetry=service.telemetry,
        auth_mode=settings.auth_mode,
        clock=time.monotonic,
    )

    ctx = AuthContext(tenant_id=settings.local_tenant_id, principal_id=args.principal, mode=settings.auth_mode)
    correlation = uuid.uuid4().hex
    refs = service.list_documents(ctx, 20)
    for hit in refs:
        pipeline.submit(
            DocumentEvent(
                tenant_id=ctx.tenant_id,
                document_id=hit.document_id,
                version="v1",
                principal_id=ctx.principal_id,
                correlation_id=correlation,
            )
        )
    processed = pipeline.run_until_idle()
    summary = {
        "processed_messages": processed,
        "jobs": [
            {
                "document_id_fp": None,
                "status": j.status.value,
                "attempts": j.attempts,
                "records": j.records_written,
                "error_code": j.error_code,
            }
            for j in (jobs.latest(ctx.tenant_id, h.document_id, "v1") for h in refs)
            if j
        ],
        "evidence_records": len(evidence),
    }
    if args.search:
        summary["search"] = evidence.search(ctx, args.search, 5)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
