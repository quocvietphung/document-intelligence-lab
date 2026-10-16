# Source-bound research workspaces

Implemented on `feature/document-intelligence-lab` and included in the source showcase release. Publishing the code does not deploy production or create paid Azure resources. For a clean clone, start with [Docker local setup](DOCKER_LOCAL.md).

## Start from an original

1. Sign in at `http://localhost:3000/vi` (or `/en`, `/de`). Local credentials: `advisor.demo` / `demo-password`.
2. Choose a domain and dossier. Open **Documents & review**; preview and explicitly analyze an approved fictional PDF. Private official DATEV samples remain in the banking domain and are never put into Git/public assets.
3. Open **AI Experiments**. Select the original document/page and open its PDF. Read the expected values yourself; do not copy model predictions and call them ground truth.
4. Add fields using their extraction key (e.g. `netIncome`, `payoutAmount`, `premium`, `invoiceTotal`). Missing field keys are permitted. Add retrieval questions with one target document/page if desired.
5. Name the reference version, acknowledge the independent source check and save. This creates an immutable `document-reference` record in `lab_records`, scoped to the verified tenant and dossier.
6. Explicitly run extraction or retrieval. The API immediately returns a queued job (HTTP 202); the results tab polls its durable status and shows timestamps, source version, labelled sample count, method, metrics and failed examples with source links. No new Azure call is made by these experiments. Cold ONNX startup does not hold the browser request open.

## What is measured

- Extraction compares saved fields against human labels. Correct predictions count TP; missing references count FN; wrong/ambiguous predictions count FP and FN. Unlabelled fields are not evaluated. No claim of global OCR accuracy or fully independent ground truth validation is made.
- Exact matching ignores Unicode width, case and repeated whitespace. Amount formatting, sign and currency are preserved. Different locale representations can therefore count as a mismatch; the results let you inspect them.
- Retrieval compares BM25, vector cosine and the existing hybrid scoring implementation over original page/field/table chunks, without policy/summary fixtures. Hit rate@5 is the share of questions with their labelled document/page in the first five chunks. MRR@5 measures its reciprocal rank. This is one labelled target per question, **not multi-relevant-document Recall@5**.
- Runs use local isolated ranking and the configured embedding implementation. They do not overwrite Qdrant's live case index or claim to benchmark the Qdrant service. No calibrated neural reranker, LLM judge, prompt A/B or model A/B test is implied.
- A SHA-256 fingerprint binds labels/results to the source records (pages, fields, tables and provenance). This is an extraction-record fingerprint, not a cryptographic attestation of the original PDF bytes. Changed sources require a new independently checked reference version. Stale dossier versions return HTTP 409.

## Data Pipelines

The processing tab retains the actual persistent upload queue, malware scanning, extraction, retry history and retention behavior. The **Data assets & Azure** tab provides logical export layers:

| Layer | Contents | Location |
| --- | --- | --- |
| Bronze | Private original references, without original file bytes | Existing private document store |
| Silver | Saved text pages, fields, tables and extraction provenance | Current dossier |
| Gold | Current source-bound manual reference versions and experiment results | PostgreSQL `lab_records` |

The JSON/JSONL download contains document text and requires explicit acknowledgment. It does not send data to Azure Storage/Foundry/ADF. Treat it as private. Audit entries record the export ID, actor, time, source fingerprint and count, not duplicated document text. The browser download cannot be recalled; the operator controls its retention after download. Existing source-file retention is unchanged; these labels and reports follow dossier history retention and have no new automatic purge.

JSONL contains `query`, `context`, `documentId`, `page` inputs. A Foundry evaluation still needs an approved project, model/target, evaluator choice and explicit data mapping. Do not report exported inputs as a completed Foundry run.

### Azure integration boundaries

- Azure Document Intelligence is the configured OCR/layout provider; each document records the provider actually used.
- Azure OpenAI remains Nova's existing Java/LangChain4j integration.
- Foundry, Data Factory and Blob have no enabled connectors in this feature. The UI says so.
- Before connecting them: agree on region/cost/retention, private storage and scoped Managed Identity roles. Do not assume an ADF Managed Identity can call the Keycloak JWT-protected API: an explicit authentication adapter must be designed and tested first.

## API and security

All routes require a valid API-audience Bearer token and ADVISOR, REVIEWER or ADMIN role. Tenant is derived only from verified JWT claims; case lookup authorizes the dossier before any data or action. Persistence writes must be enabled. Reference/run/export IDs cannot read another tenant or dossier.

```
GET  /api/cases/{caseId}/platform/research
POST /api/cases/{caseId}/platform/research/datasets
POST /api/cases/{caseId}/platform/research/runs
POST /api/cases/{caseId}/platform/research/export
```

Requests validate body bounds, available original pages, duplicate labels, safe questions and current dossier version. Experiments are limited to six runs/minute/account using the existing distributed limiter. No payment, credit approval, claim settlement, secret or cloud provisioning tool is exposed.

Experiment jobs are persisted as `document-experiment-job`. A compare-and-swap lease claims a job; it can be reclaimed after 15 minutes if the process dies (maximum three attempts). Result IDs equal job IDs so recovery cannot create duplicate result records. Failed experiments retain a bounded error code, not source text or stack traces. `DOCUMENT_WORKER_ENABLED=false` disables both document and experiment processing. The scheduler pool has three threads so model warmup does not monopolize the document queue.

## Verification

```bash
npm run verify
mvn -f services/credit-api/pom.xml test
TEST_RESEARCH=1 node scripts/test-oauth.mjs
```

The live acceptance script signs in through Keycloak authorization-code + PKCE, tests the Next.js proxy/Java API, persists reference versions and runs on an existing approved original, and checks fresh reads plus private export. It does not upload real documents or create cloud resources. Test records remain labelled in the local research history; no production deployment is performed.

### Local verification — 16 October 2026

- Frontend: 203 tests passed; lint and TypeScript checks passed.
- Java: 197 tests discovered, 196 passed, one skipped, no failures or errors.
- Live research acceptance: 33 checks passed, including authenticated proxy/API requests, validation, durable jobs, tenant/dossier isolation, private export and independent PostgreSQL readback.
- Both application Docker images built successfully. Existing authentication, databases, vector search and malware scanning remain enabled.
- Browser verification used the private approved Robert-Muster DATEV PDF: two expected amounts were read from the original, saved as a new reference, and evaluated. Both labelled fields matched (2/2); this is a two-label check, **not a general accuracy claim**. Retrieval runs use the same source-bound reference and local ranking methods.
- A private JSON download was verified to contain the original references, saved extraction, manual labels and evaluation inputs, with `cloudUploaded=false` and `destination=browser-download-only`.
- Browser layouts were checked at 1280px and 390px; the mobile document had no horizontal overflow. The experiments tour targets the always-visible reference/results tabs, so it can start from either tab without pointing at a hidden form. No browser console errors were observed during these checks.
- No new Azure AI calls were required by these research experiments. Foundry, Data Factory and Blob connectors remain unconfigured; production deployments and Git main branches are unchanged.
