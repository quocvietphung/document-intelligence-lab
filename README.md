# Credit Intelligence Lab

An independent banking-AI engineering lab: **inspect the evidence, explain uncertainty, keep a human in control**.

[Open the public demo](https://credit-intelligence-lab.vercel.app/en) · [Local verification](docs/PLATFORM_VERIFICATION.md) · [Azure setup](docs/AZURE_AI.md) · [Reliability runbook](docs/RELIABILITY_LAB.md)

> Synthetic data only. Not affiliated with apoBank, Microsoft or a lender. No financial advice, automated credit decisions, real bank connections or real payments.

## Two ways to explore

| | Public Vercel demo | Full local Docker platform |
| --- | --- | --- |
| Access | No login or external API required | Keycloak Authorization Code + PKCE |
| Cases and documents | Read-only synthetic fixtures; real sample PDF viewer | PostgreSQL intake, upload, extraction and evidence review |
| Nova | Deterministic browser replies, **not an LLM** | Java/LangChain4j; optional real Azure OpenAI |
| AI Studio | Local keyword lookup over bundled evidence | ONNX embeddings + Qdrant + BM25 + feature reranking |
| Pipeline and controls | Illustrative snapshots; no background processing | Durable queue, ClamAV, retention, human review and audit |
| Quality | Dataset explanation; no fabricated accuracy scores | Runnable benchmark with 40 labelled synthetic text references |
| Banking lab | Account cards, filters, CSV and invoice inspection | Persistent mock workflow with explicit human confirmation |
| Azure | Not called; no API keys needed | Entra short-lived tokens; no Azure API-key code path |

Languages: **English, Deutsch, Tiếng Việt**. All sample names and amounts are fictional. The public demo cannot create cases, upload files, confirm reviews or prepare payments.

## Screenshots

### Public workspace — no API required

![Public read-only Credit Intelligence workspace](docs/screenshots/public-workspace.jpg)

### Document evidence — synthetic German payroll

![Synthetic PDF and hand-labelled fields in the public demo](docs/screenshots/public-document.jpg)

### Nova — full local Azure integration

The screenshot below is from the **authenticated local Docker platform**, not the public Vercel demo. It shows an Entra-authenticated Azure answer with named source links; it is not an accuracy benchmark.

![Local Azure Nova answer with source citations](docs/screenshots/audit-nova-2026-10-12.jpg)

### Measured local quality

![Local 40-reference synthetic text benchmark](docs/screenshots/reliability-quality.jpg)

## Workspaces

- **Overview:** selected-case context, missing evidence and contradictions.
- **AI Studio:** evidence retrieval, transparent routing, allowed read-only tools and source inspection.
- **Documents & review:** PDF/image viewer, extracted text/tables, net income versus payout, source-linked fields.
- **Document pipeline:** bounded asynchronous upload, scanning, retries, duplicate rejection and expiry.
- **Review & insights:** balanced teaching journal, amount-only payroll matching and review notes.
- **Banking lab:** synthetic accounts, transactions, filters, CSV, invoice evidence and duplicate checks.
- **AI quality:** field precision/recall/F1, document-type confusion and retrieval Recall@5.
- **Operations:** configured infrastructure, tracing hooks, shared quotas, migrations and backup/restore.
- **Activity log:** case edits, extraction and manual-review events.

No real payment integration exists. ISO 20022 examples are deliberately non-submittable, with invalid demo identifiers. Nova cannot approve credit or execute a payment.

## Architecture

```text
PUBLIC DEMO
Browser → Next.js on Vercel → bundled fixtures + sample PDFs
         No Java API, Keycloak login, Azure calls or database writes

FULL LOCAL PLATFORM
Browser → Keycloak OIDC/PKCE → Next.js authenticated transport
                                      ↓
                              Java 21 / Spring Boot
                               ├─ verified JWT → tenant + roles
                               ├─ PostgreSQL cases, jobs and audit
                               ├─ PDFBox / Tesseract, or Azure Document Intelligence
                               ├─ ONNX + Qdrant + BM25 retrieval
                               ├─ LangChain4j → Azure OpenAI via Entra
                               ├─ Redis quotas + ClamAV + private document volume
                               └─ Flyway + Prometheus + OpenTelemetry
```

Business tenant isolation (`tenant_id` in a verified Keycloak JWT) is separate from the Microsoft Entra tenant used to authenticate to Azure.

## Quick start: standalone browser demo

Requirements: Node.js 22 or 24 and npm.

```bash
git clone https://github.com/quocvietphung/credit-intelligence-lab.git
cd credit-intelligence-lab
npm ci
NEXT_PUBLIC_DEMO_MODE=true npm run dev
```

Open [localhost:3000/en](http://localhost:3000/en). No Azure subscription, API key, Docker or login is required. If port 3000 is occupied, append `-- --port 3100`.

## Full local platform with Docker

Requirements: Docker Desktop, Compose and enough available memory. The optional ClamAV service is heavier on Apple Silicon because its image is emulated.

```bash
docker compose up --build -d --wait --wait-timeout 300
```

| Service | Local address |
| --- | --- |
| Workspace | http://localhost:3000/en |
| Keycloak | http://localhost:8080 |
| Java health | http://localhost:8081/actuator/health |

Local-only advisor: `advisor.demo` / `demo-password`, roles `ADVISOR` and `REVIEWER`. Local-only Keycloak admin: `admin` / `local-admin-only`. Never use these lab credentials or Compose example passwords outside the isolated local environment.

### Include the reliability services

```bash
docker compose -f docker-compose.yml \
  -f docker-compose.platform.yml \
  -f docker-compose.observability.yml \
  up --build -d --wait --wait-timeout 600
```

This adds Qdrant, Redis, ClamAV, private document storage and the OTLP collector. `storage-init` is a one-shot permissions initializer: **exit code 0 is success**, not a service failure. Named database/document volumes survive ordinary container restarts. Do not use `down -v` unless you intentionally want to erase lab data.

### Connect existing Azure AI without an API key

Configure the resource endpoints in the Azure override for your own tenant. The bundled endpoint names refer to the owner's shared lab resources; they do not grant access.

```bash
az login
node scripts/docker-azure.mjs up
```

Keep the helper running so its short-lived Entra token can be refreshed. The verified local implementation uses a restricted token-file mount; it is **not cloud Managed Identity**. Supported Azure compute can use `DefaultAzureCredential`/Managed Identity. See the [Azure runbook](docs/AZURE_AI.md) for role scopes, F0 two-page limits and failure handling. No Azure resources are created by these commands.

### Try a complete local evidence flow

1. Sign in and create a fictional case.
2. Preview an official fictional DATEV page in the private local library, then explicitly confirm import/processing.
3. Compare the extracted fields and tables with the original PDF.
4. Correct/confirm fields as a reviewer; inspect the updated activity log.
5. Ask Nova a complete question about the selected case.
6. Run evidence retrieval and the synthetic benchmark; inspect failures, not just aggregate scores.

Public third-party DATEV PDFs are **not redistributed**. The library contains two official fictional LODAS 2025 references, served only after Java verifies the local session. Prepare them in ignored `.local/reference-pdfs/` using the documented splitter; Compose mounts this folder read-only. Historical source/consent details: [Public payroll tests](docs/PUBLIC_PAYROLL_TESTS.md). The self-made PDFs remain legacy synthetic regression/demo fixtures, clearly separate from DATEV; existing case evidence is never silently replaced.

### Nova workspace guide

Ask “What does AI Studio do?”, “AI Studio có những gì?” or “Was kann AI Studio?”. Nova offers steps and real links for all nine sections, with English/German/Vietnamese text from a shared versioned catalog. Use **Explore app features** to list everything.

- Click **Open section** to navigate without leaving the widget. Links such as `/en#studio` can be bookmarked; back/forward restores the section.
- **Show current data here** reads selected-case data inside chat; **Search evidence here** runs the existing authorized evidence-search endpoint. Results distinguish browser fixtures from live local service data.
- The Java LLM has read-only `appFeatures`/`appFeature` tools using the same catalog. App-guide replies from the browser are explicitly not Azure generations.
- Only allowlisted navigation is executable. Model/document text cannot trigger arbitrary URLs, uploads, writes, deletions, credit decisions or payments. Official reference imports require an explicit processing confirmation.

See [Nova guide implementation and checks](docs/NOVA_WORKSPACE_GUIDE.md).

## Verification and honest limits

```bash
npm run verify
cd services/credit-api
mvn --batch-mode verify
```

Local release checks: **40 frontend tests passed**; lint, TypeScript and production build were checked. Java: **115 passed**, one opt-in live test skipped. The separately verified Docker integration exercised real Azure extraction/chat, authorization, uploads, scanner rejection, review refresh and optimistic concurrency. Full evidence and dated results are in [PLATFORM_VERIFICATION.md](docs/PLATFORM_VERIFICATION.md).

The measured 40-reference **synthetic text** run reported precision 100%, recall 90.5%, field F1 95.0% and retrieval Recall@5 54.7%. These numbers are **not** image-OCR accuracy, Azure LLM accuracy, credit suitability or general banking correctness. Retrieval still needs improvement.

Other limits:

- Feature reranking and lexical source support are heuristics, not a trained cross-encoder or calibrated groundedness score.
- Payroll reconciliation matches amounts only; it does not verify identity, period or document authenticity.
- Cloud Blob Storage/Application Insights are optional configurations, not provisioned production services.
- Security/signing workflows and SBOM are included; their presence alone does not prove a released image is signed.
- No real customer data, financial advice or automated lending decision is permitted.

## Deployment and branches

- **master:** reviewed releases.
- **develop:** development baseline.
- Feature upgrades are squash-merged into master. Existing history and real commit timestamps are preserved.
- Vercel project/domain: **credit-intelligence-lab** / [credit-intelligence-lab.vercel.app](https://credit-intelligence-lab.vercel.app/en).
- Vercel is configured with `NEXT_PUBLIC_DEMO_MODE=true`; server proxies fail closed in this mode, even if an old API URL remains configured.
- Java, databases, Keycloak and workers remain a separate local platform. They are not deployed by this public frontend release.

## Repository map

```text
app/                     Next.js pages and authenticated transport routes
components/workspace/    workspace, Nova and document viewers
lib/                     schemas, helpers, language tables and public fixtures
services/credit-api/     Java/Spring Boot, LangChain4j, extraction and tests
infra/                   Keycloak, Azure templates and observability
public/demo/             generated synthetic payroll PDFs
scripts/                 OAuth checks, Azure token helper, backups and PDF assets
docs/                    runbooks, verification and screenshots
```

## References and license

Inspired by the [Microsoft Java Banking Assistant sample](https://github.com/Azure-Samples/agent-openai-java-banking-assistant); not a copy of a production bank platform.

[MIT license](LICENSE). Third-party components retain their own licenses.
