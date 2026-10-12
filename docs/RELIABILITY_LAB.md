# Reliability & evidence lab

This is a **synthetic banking engineering simulation**, not a bank platform.
No real payment submission, bank connection, automatic credit decision or fraud verdict exists.
Existing payment screens remain local simulations; new specialists have read-only tools.

## Five new workspaces

| Workspace | Working flow |
| --- | --- |
| AI Studio | Case evidence → page/field/table chunks → quantized local MiniLM embeddings → tenant/case-filtered Qdrant → BM25 hybrid ranking → transparent feature reranking → Nova |
| Document pipeline | 202 upload → PostgreSQL durable queue → object volume → ClamAV + structural checks → Azure prebuilt-layout or explicitly configured local extraction → human review |
| Review & insights | Derived double-entry mock journal, salary-to-synthetic-movement amount checks, rule alerts, append-only reviewer notes, non-submittable ISO 20022 example |
| AI quality | 40 versioned labelled text references, field precision/recall/F1, type confusion matrix, five-query Recall@5, actual failed examples |
| Operations | Provider/scanner/storage/Redis configuration, persisted agent runs and citation checks, latency, admin-only Prometheus metrics |

### Important limits

- The reranker is a **BM25/cosine/query-coverage formula**, not a trained cross-encoder.
- MiniLM is small and runs locally; this variant is English-focused. Test German/VI separately before claiming multilingual quality.
- Citation checks validate IDs against supplied sources. Lexical overlap **does not prove factual groundedness**. Missing, invented or low-overlap citations require review.
- Regex injection checks plus tool isolation are defence layers, **not a guarantee that all prompt injection is blocked**.
- The 40-reference scores measure deterministic text rules, **not Azure OCR, scanned PDF accuracy or LLM factual accuracy**.
- Salary reconciliation is amount-only against fictional transactions. Period, holder identity and authenticity are not verified.
- The journal is derived from mock movements and balanced by construction, not a production accounting ledger.
- Supervisor routing invokes one specialist LLM per question, not five autonomous communicating agents.
- Azure Blob, Azure Application Insights and signed releases are configurable extensions, not automatically provisioned cloud resources.

## Start locally

Docker Desktop needs roughly 5–6 GB available memory. Official ClamAV uses amd64 emulation on Apple Silicon and needs virus definitions before becoming ready.

```bash
# Local extraction; no Azure credentials.
docker compose -f docker-compose.yml -f docker-compose.platform.yml up --build -d --wait --wait-timeout 600

# Existing Azure configuration; keyless short-lived CLI token, never an API key.
# Keep this helper running to renew the token.
node scripts/docker-azure.mjs up
```

Open http://localhost:3000/en, sign in with the **local-only** account
`advisor.demo / demo-password`, choose a case, then open AI Studio or Document pipeline.
The imported demo realm grants this demo user advisor and reviewer roles; do not copy that arrangement to production.

PDF/image input is limited to 3 MB and the configured provider page count.
TXT is available only with local extraction. Originals stay case-authorized.
The existing synchronous document-upload endpoint also uses the scanner, shared
upload limits and extracted-text injection checks; it cannot bypass these protections.
It remains synchronous for compatibility, so use the new pipeline for durable background processing.
Redis, Qdrant and ClamAV have no published host ports.

### Queue and retention

Flyway applies `V1__platform_lab.sql` on the existing case database, baselining legacy tables at 0 without deleting them.
Claims use PostgreSQL `FOR UPDATE SKIP LOCKED`, bounded retries and five-minute crash leases.
Extraction results are stored before attachment, preventing repeated paid extraction on a normal restart after the result is saved. A crash during the remote call itself can still lead to a repeated provider call on retry.
SHA-256 deduplication is tenant/case scoped and protected by a partial unique index.

New pipeline files expire after 30 days by default (1–365 configurable).
The worker removes their vector index scope, case evidence/original, object and saved extraction.
Cleanup failure is retried, not reported as successful. Legacy synchronous uploads are deliberately **not** silently purged.
Evaluation reports and review notes are retained for lab audit; purge policy for these records must be defined before real data use.

## Storage

Default: private Docker object volume `lab_documents`, PostgreSQL original copy for the existing authenticated PDF viewer.
Optional Azure Blob uses the same short-lived Entra credential:

```text
AZURE_BLOB_ENDPOINT=https://<existing-account>.blob.core.windows.net
AZURE_BLOB_CONTAINER=lab-documents
```

Create the private container and grant narrowly scoped Blob Data permissions separately.
No account/container or access grant is created by this implementation.
Do not enable public blob access. Blob expiry is handled by the app's retention worker.

## Verification

```bash
npm run verify
cd services/credit-api
mvn test package
cd ../..
TEST_PLATFORM=1 TEST_RESTART_QUEUE=1 TEST_CHAT=azure node scripts/test-oauth.mjs
```

The integration test creates a named synthetic case, checks real retrieval/Redis,
measures the dataset, stores a review note, uploads a generated payroll PDF, restarts
the API and verifies durable completion and byte-identical original retrieval.
It also uses the harmless EICAR antivirus test signature to verify rejection **before** extraction.
Azure mode uses the existing resource and may incur normal document/chat usage.
No real customer documents are used.

## Telemetry

```bash
# Add to the same compose files used for your stack:
docker compose -f docker-compose.yml -f docker-compose.platform.yml -f docker-compose.observability.yml up -d
docker compose -f docker-compose.yml -f docker-compose.platform.yml -f docker-compose.observability.yml logs --tail=30 otel-collector
```

OTel HTTP spans go to a local OTLP collector with a basic debug exporter.
Metrics: `/actuator/prometheus` requires an ADMIN JWT. No prompts, PDF text, access tokens or model responses are logged in agent-run records.
RAG/agent counters and timers have bounded labels, not customer IDs.

Azure Application Insights is **not connected by default**. Before adding an
approved Azure Monitor exporter/Java agent, define telemetry redaction, consent,
retention and region. Do not send document text to monitoring.

Suggested alerts: HTTP 5xx > 2% for 5 min, queue age > 5 min, any failed malware scan,
Redis unavailable, repeated extraction retry, token expiry, storage cleanup failure.
These are incident thresholds to configure in a real monitoring system, not active cloud alerts.

## Backup and recovery

```bash
node scripts/backup-lab.mjs
# Use paths printed by the backup script:
node scripts/restore-lab-test.mjs cases .local/backups/<date>/credit_cases.dump
node scripts/restore-lab-test.mjs identity .local/backups/<date>/keycloak.dump
```

Backups are private, ignored by Git, and include fictional evidence and Keycloak state.
Restore creates a separate test database. It never overwrites the live databases.
An application/realm recovery needs a maintenance window, tested backup,
compatible versions and explicit operator confirmation before switching connections.
Back up the object/vector volumes separately if preserving pipeline objects is required.

## Security and incident runbook

- **Azure failures:** inspect provider mode and safe error codes; refresh Entra login/helper. Never paste tokens or introduce an API key as a workaround.
- **Redis outage:** protected writes/chat fail closed. Restore Redis; do not disable shared limits to hide the failure.
- **Qdrant outage:** searches explicitly report local-vector fallback. Restore Qdrant and re-query to rebuild the case index.
- **Scanner failure:** queue retries then stops; do not bypass it for an untrusted file.
- **Wrong sources:** verify case/tenant, document version and supplied IDs. Correct evidence through reviewer UI; never auto-approve lending.
- **Migration failure:** preserve database; inspect Flyway history before any repair. Never run clean against the case database.
- **Credentials:** Azure uses short-lived Entra tokens/identity. Rotate local Keycloak/DB demo passwords only through a planned operator workflow; production needs secret management and separate accounts.
- **Build supply chain:** security workflow checks dependencies, image vulnerabilities and secrets; creates CycloneDX SBOM. Resolve findings instead of hiding failed checks.
- **Signing:** the separate manually dispatched workflow builds/publishes a GHCR image and signs its digest using GitHub OIDC. Configure a protected `container-release` environment and inspect the SBOM before triggering it. It has not been run automatically.

This lab demonstrates engineering controls; it is not a claim of regulatory compliance or production bank readiness.
