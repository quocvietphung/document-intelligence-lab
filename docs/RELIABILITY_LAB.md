# Local operations, security and recovery

The primary runtime is [Docker local](DOCKER_LOCAL.md). The previous Azure VM backend has been removed; the app's local volumes and shared Azure AI resources are independent.

## Service health

```bash
docker compose -f docker-compose.yml -f docker-compose.platform.yml ps --all
curl --fail http://localhost:8081/actuator/health
docker compose -f docker-compose.yml -f docker-compose.platform.yml logs --tail=60 credit-api web keycloak
```

Expected: API, databases, Keycloak, Redis and ClamAV healthy; web/Qdrant running; `storage-init` exited 0. Do not restart a successful initializer just to make every row look green.

Never share raw tokens, passwords, source text or provider responses from diagnostics.

## Persistence and document processing

- PostgreSQL stores dossiers, compatible original copies, audit and research records.
- The private `lab_documents` volume holds queued document objects.
- Qdrant vectors, Redis state, antivirus signatures and identity state use separate named volumes.
- The durable worker verifies source SHA-256, scans before analysis, records attempts, recovers leases and retains failure history. Flyway V2 adds `lab_job_events`; a PostgreSQL trigger records stage/state changes in the same transaction as each job update. Historical stages are not backfilled.
- Processing control room shows the latest submission per file within the latest 30 loaded jobs; prior submissions remain available through its history toggle. Results, human confirmation and on-demand RAG indexing are separate states.
- Transient service/429 failures wait 30 then 60 seconds, with at most three attempts. Authentication/permission/security/content failures stop automatically. Manual retry accepts only pinned DATEV/Kaggle references, preserves the failed job and links its replacement.
- Waiting-job cancellation is authorized and atomic; a running provider request cannot be cancelled. It does not delete the private original or reverse charges. Retention still applies to cancelled jobs.
- Saved extraction checkpoints can avoid repeat OCR after a later-stage failure. Provider response loss before checkpointing can still lead to repeat inference; there is no exactly-once billing guarantee.
- Processing manifests exclude PDF/text/credentials/object paths but contain filenames and dossier IDs. Keep them private. The separate data-asset exports can contain source text.
- Document retention is configured to 30 days in the local platform profile. Chat/review/reference history has no new automatic purge; browser downloads have their own operator-managed retention.
- Changing the Compose project name creates different volumes. It does not migrate data.

```bash
# Stop without erasing data.
docker compose -f docker-compose.yml -f docker-compose.platform.yml stop

# Remove containers/network but retain named volumes.
docker compose -f docker-compose.yml -f docker-compose.platform.yml down
```

Do not add `-v` / `--volumes` or run volume pruning as a troubleshooting shortcut.

## Backup and restore checks

With the stack running and host Node.js installed:

```bash
node scripts/backup-lab.mjs
node scripts/restore-lab-test.mjs cases .local/backups/YOUR-BACKUP/credit_cases.dump
node scripts/restore-lab-test.mjs identity .local/backups/YOUR-BACKUP/keycloak.dump
```

Use the paths printed by the backup script. Dumps are private and Git-ignored. The restore checker creates separate test databases; it does not overwrite the live app or realm. Those test databases remain for inspection.

The database backup helper does **not** back up every object/vector volume. Preserve private document objects, approved reference files and vector state separately when a complete environment recovery is required. Test compatibility and ownership before switching the application to restored data.

## Security boundaries

- Keycloak authorization-code + PKCE; Java validates JWT issuer, API audience, tenant and roles.
- Dossier lookup and source access are authorized server-side; a guessed ID is not permission.
- ClamAV precedes extraction. Do not disable it when a file is rejected or the scanner is unavailable.
- Shared Redis quotas fail closed when unavailable.
- Upload/file/page bounds, explicit Azure processing consent and private original endpoints remain active.
- AI answers, source links, field edits and human verification are separate states.
- Local published passwords are development examples only; production requires a separate secret-management and identity plan.

## Optional telemetry

```bash
docker compose -f docker-compose.yml -f docker-compose.platform.yml -f docker-compose.observability.yml up -d
docker compose -f docker-compose.yml -f docker-compose.platform.yml -f docker-compose.observability.yml logs --tail=30 otel-collector
```

The optional collector receives local OTLP traces. Application Insights is not connected automatically. `/actuator/prometheus` requires an ADMIN JWT. Keep prompts, PDFs, access tokens and customer identifiers out of telemetry.

Suggested operational signals include queue age, repeated retries, API errors, scanner/Redis failures, token expiry and retention failures. These are signals to implement in your monitoring environment, not active cloud alerts.

## Incident checklist

| Failure | Response |
| --- | --- |
| Azure unavailable | Inspect Processing details and the newest attempt. Check provider, Entra helper and resource roles; no API-key workaround. Auth/permission failures stop instead of repeatedly calling Azure. |
| Redis unavailable | Restore the dependency; do not disable limits |
| Qdrant unavailable | Inspect the explicitly reported fallback and restore/rebuild the dossier index |
| Scanner unavailable | Restore signature/health state; never bypass scanning |
| Wrong evidence | Verify tenant/dossier, source version and page; correct through reviewer workflow |
| Flyway migration error | Preserve data and inspect history; never run clean against the live database |
| Suspected credential exposure | Stop the affected workflow, restrict access and rotate through authorized administration |

CI includes dependency/image/secret checks and SBOM generation. A signing workflow is present but its presence is not proof that an image has already been signed or independently audited. This is research software, not production/compliance certification.
