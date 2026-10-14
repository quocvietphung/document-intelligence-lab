# Credit Intelligence Lab

An independent banking-AI engineering lab: **inspect the evidence, explain uncertainty, keep a human in control**.

[Open the authenticated cloud lab](https://credit-intelligence-lab.vercel.app/en) · [Latest release checks](docs/RELEASE_2026-10-14.md) · [Cloud verification](docs/AZURE_VM_LAB.md) · [Local verification](docs/PLATFORM_VERIFICATION.md) · [Reliability runbook](docs/RELIABILITY_LAB.md)

> AI bank-document analysis using synthetic data only. Not affiliated with apoBank, Microsoft or a lender. No financial advice, automated credit decisions, real bank connections or payment functionality — including mock payments.

**Stack:** Next.js / TypeScript · Java 21 / Spring Boot 4.1 / LangChain4j · Keycloak OIDC + PKCE · PostgreSQL · Azure OpenAI & Document Intelligence · Qdrant / ONNX / BM25 · Docker Compose · Terraform.

## Latest production release — 14 October 2026

The `master` release runs Next.js on **Vercel** and the authenticated Java/Keycloak/data stack on **Azure**. Business data and AI calls require a verified Bearer token; public sign-in pages and health checks are intentional exceptions. Azure AI uses the VM's Managed Identity, not an API key stored on Vercel.

Verification: **191 frontend tests**, **175 Java tests (174 passed, one opt-in live test skipped)**, **113 local full-stack checks** and **61 Azure-backed Vercel checks**. CI separately checks dependencies, secrets and both application images at HIGH/CRITICAL severity. These checks are engineering evidence, not calibrated OCR accuracy or banking-production certification.

### Nova with live DATEV evidence

Real production response in Vietnamese, including separate net/payout amounts and links back to the private uploaded original. Structured field context supplements ranked passages so the model need not infer missing numbers from a truncated page excerpt. Azure safety refusals are labelled separately from connectivity failures; filters are not disabled and requests are not retried automatically.

![Nova on production, with DATEV amounts and evidence links](docs/screenshots/production-nova-2026-10-14.jpg)

### Azure extraction results and page-specific guidance

These production captures show app results and controls, not a redistribution of the publisher's PDF. The originals remain private and outside Git.

![Azure DATEV results above the sample library](docs/screenshots/production-results-2026-10-14.jpg)

![AI Studio production tour highlights the real question field](docs/screenshots/production-tour-2026-10-14.jpg)

## What the AI actually does

| Capability | Implementation | Where to try it / important boundary |
| --- | --- | --- |
| **Nova case copilot** | Azure OpenAI `gpt-4.1-mini`, Java/LangChain4j, streamed responses and read-only case tools | Floating bottom-right chat. Explains evidence and missing documents; cannot approve credit or execute payments. |
| **Document AI** | Azure Document Intelligence `prebuilt-layout`, with a separate local PDFBox/Tesseract mode | Documents & review / Document pipeline. Extracts text, tables, page regions and supported fields. Azure confidence is not validated field accuracy. |
| **German payslip inspection** | Layout-aware Java rules over extracted evidence | Distinguishes `Netto-Verdienst` from `Auszahlungsbetrag`; validates money/date values. Two official fictional DATEV references are private, not redistributed. |
| **Hybrid RAG** | Local ONNX MiniLM embeddings + tenant/case-filtered Qdrant + BM25 + feature reranking | AI Studio. Returns source passages and ranking scores, not an accuracy percentage. No paid Azure embedding deployment required. |
| **Specialist routing** | Rule-based supervisor chooses one read-only LLM specialist | Document, Banking, Compliance, Risk or Explanation. This is not five autonomous agents running in parallel. |
| **Evidence safeguards** | Instruction-override checks, passage quarantine, source-ID validation and lexical-overlap heuristic | AI Studio / Nova runs. These are transparent checks, not proof that every generated claim is true. |
| **App navigation help** | Versioned EN/DE/VI feature catalog and allowlisted UI actions | Ask Nova where a feature is. Opens the section or reads permitted data in chat; app-guide replies are **not LLM generations**. |
| **Document research** | Fields, tables and review state from uploaded originals | Open PDF evidence; no synthetic benchmark percentage is substituted for document accuracy. |

The overview offers three direct entry points: **Analyze a payslip**, **Search the evidence**, and **Ask Nova**. Responses distinguish Azure AI, app-guide and blocked-request modes. Human confirmation, permissions, malware scanning, persistence and audit logging are application controls, not AI predictions.

## Five-minute walkthrough

### Research the uploaded PDFs

Only original documents from the selected case are shown: provider, fields, tables and human-review status. Open a result to compare it with the PDF or ask Nova about that document. Statement/invoice evidence stays empty until an original is analyzed. No seeded balances or mock reconciliation.

Fixed-reference experiments remain regression-test assets only, disabled in normal Docker. Previously stored records and originals are retained, not erased. See [document-only boundaries](docs/DOCUMENT_ONLY.md).

![Uploaded DATEV result: extracted values, source evidence and original-PDF inspection](docs/screenshots/document-only-2026-10-14.jpg)

### Dashboard AI directory

The overview now lists **15 capabilities**: **11 AI-assisted workflows** and **4 rule/human-review controls**, with an accent-insensitive search, category filters, provider/model labels and direct tool links. Entries open documents, AI Studio, Nova, controlled task drafts, quality evaluation or the corresponding review-center tab. Navigation never uploads files or starts inference.

Dashboard counts distinguish catalogue entries from configured engines. Azure-analyzed originals and originals awaiting human review are derived from the **selected case**, excluding reference-only/missing files. Configuration is not proof of live availability; authentication is required and missing services fail explicitly. English, German and Vietnamese have matching catalogue content.

New Azure OpenAI task templates provide **evidence-review checklists**, **German payroll-label explanations** and **German–Vietnamese summaries**. They use the existing keyless deployment; prepare a draft first, then press Send. Missing evidence must remain unknown; bilingual output is not a certified translation. No extra Azure resource is provisioned. See [the dashboard walkthrough and verified boundaries](docs/AI_DASHBOARD.md).

![AI dashboard directory — local preview, 14 October 2026](docs/screenshots/ai-directory-desktop-2026-10-14.png)

### Nova trust and evidence review

Open **AI transparency & review** above the workspace, or use the shield in Nova's header. The case-scoped center provides privacy information, seven controlled task drafts, stored answer/feedback history, reviewer tasks, governance records and measured activity. Nova now separates **App guidance** (local feature catalog, no LLM call) from **Evidence analysis** (Azure model with permitted case evidence).

- Expand an answer's **Evidence for each statement**. Citations can open the corresponding original PDF page. A linked source is not proof that the statement is correct or that a human approved it. Exact, unique horizontal PDF text can be highlighted when selecting a field; ambiguous/scanned text falls back to the page, without invented coordinates.
- **Report an issue** saves the amount/person/source feedback. **Prepare correction** fills an editable draft; sending produces a separate answer linked to the original. Clearing the visible chat does not erase the authorized case history.
- **Create reviewer task** requires confirmation. Reviewers can claim, return, resolve with a note and reopen tasks; version checks prevent stale updates. Resolving a task never approves credit or confirms every AI claim.
- Controlled tasks prepare summaries, payroll/statement comparison, inconsistency explanations or document-request email drafts. Nothing is sent automatically, and there are no payment tools.
- Admin-only controls can stop Nova or one task **for the selected case**. The catalog records owner role, prompt/deployment version, boundaries and test suite; these are lab governance records, not compliance certification.
- Metrics use the latest 60 stored records per category: answer duration, feedback, review tasks, missing citations and field edits. They are not hallucination accuracy, savings or billed costs. PDF retention follows the configured pipeline; answer/feedback history currently has **no automatic purge**.

See [implementation and verification boundaries](docs/NOVA_TRUST.md) and [current release status](docs/RELEASE_2026-10-14.md). Earlier screenshots below show local acceptance; cloud validation is recorded separately.

![Nova transparency and review — authenticated Docker local](docs/screenshots/nova-trust-center-desktop-2026-10-13.png)

1. Open the local Docker app and sign in with the local-only advisor below.
2. Create a **fictional** case. Use the overview's AI tools to open the right workflow.
3. Preview a prepared DATEV reference and explicitly confirm analysis. Stay on **Documents & review**: processing status and results appear above the library. **Document pipeline** remains available for technical details.
4. Click **View result & PDF** to compare the original with fields/tables. Already processed samples offer **View existing result**, without another Azure upload. OCR scores are in explained detail sections; only confirm after checking the evidence.
5. Ask Nova a complete case-specific question, inspect its sources, then inspect the **document research** source inventory.

English, German and Vietnamese are supported. Changing language keeps the selected section and case; refreshing a `?case=…#documents` link still requires tenant-authorized access.

### Page walkthroughs and Nova chat shortcuts

Each of the nine workspace pages has a **Guide this page** button: it spotlights the actual control and shows a nearby instruction card. The compass beside Nova starts the current page's walkthrough, not a menu inside chat. AI Studio has seven steps: menu, question, suggestions, retrieval, passages/sources, Ask Nova and recorded runs.

Back/Next scroll to the target; Skip, Close or Escape exits. You can operate the highlighted control yourself. The guide never executes uploads, AI requests, reviews or payments. Starting it minimizes Nova while preserving chat and the unsent draft. Changing pages exits the guide. English, German and Vietnamese instructions use static selectors and viewport-clamped coachmarks; on mobile, the hidden menu target uses the visible guide button.

**Enter sends** a message; **Shift+Enter inserts a new line**. Empty input, busy chat, held Enter and input-method composition do not trigger an extra submission. Private evidence requires authentication.

Nova uses a bottom-right reading window with an optional **Expand reading area** control. Answers have their own scroller; case/model details and suggestions no longer squeeze them out. The composer stays visible, and reading older messages does not force a jump to the latest reply. See [the layout changes, design references and test boundaries](docs/NOVA_READABILITY.md).

### DATEV-only payroll sample library

The [document-results walkthrough](docs/DOCUMENT_RESULTS_UX.md) shows the same-page import/results workflow, duplicate handling, preserved history and clarified recognition signals.

Every offered payroll sample comes from the official **DATEV LODAS 2025** fictional Robert/Melanie references. The original PDFs remain private, outside Git and public assets, with authenticated preview/import and an explicit processing confirmation. Filename matching is not an authenticity guarantee. The library requires authenticated preview and an explicit import confirmation; reference amounts are not extraction results.

Four old homemade PDFs were moved from `public/demo/` into `services/credit-api/src/test/resources/legacy-payroll/` for regression tests only; their former public URLs return 404. Existing uploaded evidence and audit history are **not deleted or relabelled**: non-library payroll is grouped separately under older evidence. When no case is explicitly selected, the UI prefers a case containing only prepared DATEV payroll references. Generic synthetic-text benchmark/test fixtures remain test data, not DATEV documents or representative payroll-OCR validation.

## Azure backend deployment (low-cost lab)

Terraform and a dedicated cloud Compose stack are available in `infra/azure/vm-lab/`. Next.js runs on Vercel; Java, Keycloak, PostgreSQL, Qdrant, Redis, ClamAV and the document worker run on one Azure Linux VM, with HTTPS and Managed Identity for shared Azure AI. The production domain was connected and tested on 12 October 2026, including browser login and real Azure document/chat calls. Follow [the deployment, verification and cost-control guide](docs/AZURE_VM_LAB.md). Local databases and private PDF references are never migrated automatically.

**Stopping the VM stops the API, login and databases, not the Vercel frontend.** Deallocation preserves the disk and its data; disk and static-IP charges can remain. Local Docker is independent of the cloud VM.

## Three ways to explore

The current production URL is the **authenticated Azure-backed lab**, not the standalone browser demo. Use the operator's private cloud credentials; `demo-password` is local-only. The VM has a daily cost-control shutdown; after it is deallocated, frontend pages can load but cloud login/API/AI are unavailable until it is started again.

| Authenticated cloud lab | Implementation |
| --- | --- |
| Sign-in | Keycloak on Azure, Authorization Code + PKCE, tenant/role claims |
| Cases / documents | Persistent PostgreSQL and private VM disk; uploads, extraction and review |
| Nova / Document AI | Existing shared Azure resources through VM Managed Identity; no API key on Vercel |
| Retrieval / jobs | Qdrant + local ONNX, Redis limits, ClamAV and durable Java worker |
| Operator access | Private SSH key, no public database/vector/scanner ports |
| Lab boundary | Fresh synthetic cloud records; no local users or private DATEV PDFs migrated |

The two alternatives below remain available for local exploration:

| | Standalone browser demo (optional mode) | Full local Docker platform |
| --- | --- | --- |
| Access | No login or external API required | Keycloak Authorization Code + PKCE |
| Cases and documents | Read-only DATEV reference values and publisher links; no republished payroll PDF | PostgreSQL intake, private DATEV PDF preview/import, extraction and evidence review |
| Nova | Deterministic browser replies, **not an LLM** | Java/LangChain4j; optional real Azure OpenAI |
| AI Studio | Local keyword lookup over bundled evidence | ONNX embeddings + Qdrant + BM25 + feature reranking |
| Pipeline and controls | Illustrative snapshots; no background processing | Durable queue, ClamAV, retention, human review and audit |
| Quality | Dataset explanation; no fabricated accuracy scores | Runnable benchmark with 40 labelled synthetic text references |
| Banking evidence | Read-only account context, statement filters, CSV and invoice inspection | Persistent read-only fixtures for document reconciliation; no payment actions |
| Azure | Not called; no API keys needed | Entra short-lived tokens; no Azure API-key code path |

Languages: **English, Deutsch, Tiếng Việt**. All sample names and amounts are fictional. The standalone browser demo cannot create cases, upload files or confirm reviews; authorized cloud/local lab accounts can edit synthetic document records. Neither mode can create, confirm or simulate payments.

## Screenshots

Captured from the **authenticated Docker local app on 12–13 October 2026**, after the UI audit and follow-up. The Azure-backed local profile uses short-lived Entra tokens; the cloud VM does not need to be running. These are real app captures, not mockups or general accuracy claims. The DATEV image shows library controls and reference values, not a republished publisher-owned PDF; the originals remain private.

### AI Studio — walkthrough on the actual question field

![AI Studio with the question field spotlighted and a nearby instruction card](docs/screenshots/local-page-tour-studio-2026-10-13.jpg)

### Workspace and clear AI entry points

![Local workspace with direct document analysis, evidence search and Nova entry points](docs/screenshots/local-audit-overview-2026-10-12.jpg)

### Document AI — official DATEV sample library

![Official DATEV sample cards with authenticated private preview and explicit analysis actions](docs/screenshots/local-datev-library-2026-10-13.jpg)

### Document pipeline — verified Azure recovery

![Robert DATEV reference successfully extracted on the first new attempt; previous failure retained as history](docs/screenshots/local-datev-recovery-2026-10-13.jpg)

The local renewal helper now runs in the Mac user's background session. Retrying an approved reference creates a new, scanned job with an explicit confirmation, without erasing the earlier failure. See [recovery and verification](docs/DATEV_RECOVERY.md).

### Nova — real Azure response in the floating widget

![Local Nova streaming an Azure answer with source references](docs/screenshots/local-audit-nova-2026-10-12.jpg)

### AI Studio — case-scoped hybrid evidence retrieval

![Local hybrid RAG with source passages and specialist routing](docs/screenshots/local-audit-studio-2026-10-12.jpg)

### Quality — measured results, visible limitations

![Actual 40-reference synthetic-text evaluation dashboard](docs/screenshots/local-audit-quality-2026-10-12.jpg)

The separately verified cloud screenshots remain in the [Azure deployment guide](docs/AZURE_VM_LAB.md#production-screenshots); they describe the earlier cloud release, not this uncommitted local UI update.

## Workspaces

### Visible AI, clear responsibility

The redesigned overview puts **document analysis, evidence retrieval and Nova** up front. AI-capable menu entries and each page identify their engine; source rows identify the provider/model that processed that specific document. **Rules, fixtures and manual review are not labelled as generated AI.**

| Where | What runs |
| --- | --- |
| Documents / pipeline | Azure Document Intelligence (configured model) or local PDFBox/Tesseract; field rules still require source checks |
| AI Studio | Configured local embedding + vector store + BM25/feature ranking; the result reports its actual backend/fallback |
| Nova | Configured Azure OpenAI deployment; unavailable services fail explicitly. App-guide replies are explicitly “no LLM call” |
| Review / quality | Deterministic evidence checks and source-PDF inspection, not an AI verdict |

**Explain this field with Nova** opens a page-referenced editable question; it never sends automatically. Switching sections minimizes the floating chat without clearing the draft/history. Model names come from authenticated configuration metadata; this is not a live health probe and does not trigger inference.

See [the AI experience report and next upgrade priorities](docs/AI_EXPERIENCE.md) for verification, multilingual retrieval limits, source provenance and the separate OCR/LLM evaluation roadmap.

![AI workspace and model identities — local Docker](docs/screenshots/ai-workspace-overview-2026-10-13.jpg)

- **Overview:** selected-case context, missing evidence and contradictions.
- **AI Studio:** evidence retrieval, transparent routing, allowed read-only tools and source inspection.
- **Documents & review:** PDF/image viewer, extracted text/tables, net income versus payout, source-linked fields.
- **Document pipeline:** bounded asynchronous upload, scanning, retries, duplicate rejection and expiry.
- **Review & insights:** balanced teaching journal, amount-only payroll matching and review notes.
- **Banking evidence:** statement/invoice originals, extracted fields and source inspection; no seeded account context.
- **AI quality:** field precision/recall/F1, document-type confusion and retrieval Recall@5.
- **Operations:** configured infrastructure, tracing hooks, shared quotas, migrations and backup/restore.
- **Activity log:** case edits, extraction and manual-review events.

No payment functionality exists, including simulations. Legacy payment APIs and payment-order XML exports have been removed. Old fixture history is retained without actionable controls or database deletion. Nova explains evidence; it cannot modify balances, create transactions or approve credit. See [analysis-only verification](docs/ANALYSIS_ONLY.md).

## Architecture

```text
STANDALONE BROWSER DEMO (optional local mode)
Browser → Next.js → labelled DATEV reference values + publisher links
         No Java API, Keycloak login, Azure calls or database writes

AUTHENTICATED PLATFORM (Azure VM or local Docker)
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

## Frontend development

Requirements: Node.js 22 or 24 and npm.

```bash
git clone https://github.com/quocvietphung/credit-intelligence-lab.git
cd credit-intelligence-lab
npm ci
npm run dev
```

Open [localhost:3000/en](http://localhost:3000/en). Configure Keycloak and the Java backend to use document features; unconfigured authentication does not grant a demo session. Use Docker below for the complete platform. If port 3000 is occupied, append `-- --port 3100`.

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
6. Run evidence retrieval and inspect each result against its original PDF.

Public third-party DATEV PDFs are **not redistributed**. The library contains two official fictional LODAS 2025 references, served only after Java verifies the local session. Prepare them in ignored `.local/reference-pdfs/` using the documented splitter; Compose mounts this folder read-only. Historical source/consent details: [Public payroll tests](docs/PUBLIC_PAYROLL_TESTS.md). The self-made PDFs remain legacy synthetic regression/demo fixtures, clearly separate from DATEV; existing case evidence is never silently replaced.

### Nova workspace guide

Ask “What does AI Studio do?”, “AI Studio có những gì?” or “Was kann AI Studio?”. Nova offers steps and real links for all nine sections, with English/German/Vietnamese text from a shared versioned catalog. Use **Explore app features** to list everything.

- Click **Open section** to navigate without leaving the widget. Links such as `/en#studio` can be bookmarked; back/forward restores the section.
- **Show current data here** reads selected-case data inside chat; **Search evidence here** runs the existing authorized evidence-search endpoint. Results use originals from the authorized selected case.
- The Java LLM has read-only `appFeatures`/`appFeature` tools using the same catalog. App-guide replies from the browser are explicitly not Azure generations.
- Only allowlisted navigation is executable. Model/document text cannot trigger arbitrary URLs, uploads, writes, deletions, credit decisions or payments. Official reference imports require an explicit processing confirmation.

See [Nova guide implementation and checks](docs/NOVA_WORKSPACE_GUIDE.md).

### Nova local chat allowance

The Azure **local Compose profile** permits 12 chat requests/minute/account, 150,000 daily reservation units/account and 300,000/day/tenant. Plain deployments retain conservative defaults (6/minute, 30,000/account/day, 100,000/tenant/day). Configure these in the Java service using `AI_REQUESTS_PER_MINUTE`, `AI_TENANT_REQUESTS_PER_MINUTE`, `AI_DAILY_ACCOUNT_BUDGET` and `AI_DAILY_TENANT_BUDGET`; do not publish secrets to browser variables.

Reservations count Unicode characters plus overhead, not UTF-8 bytes, so accented Vietnamese is not charged multiple bytes per character. These estimates are **not actual model-token metering, a monetary spending cap, or a guarantee of a fixed number of conversations**. Model responses are capped at 1,500 output tokens per model call and tool loops remain bounded. Azure usage is still chargeable under the resource's plan.

PostgreSQL retains existing counters across restarts; raising a configured ceiling does not reset history. Failed SQL reservations roll back atomically. Account/tenant daily limits reset at 00:00 UTC; short-window limits reset at the next UTC minute. Nova distinguishes those limits and shows the reset in the user's local timezone. Failed questions remain editable; there is no automatic retry. Payroll-AI location questions use the local app guide without consuming Azure generation budget.

## Verification and honest limits

Visible-AI interface follow-up (13 October 2026): **132 frontend tests**, lint/typecheck, Docker web build, **140 Java passes plus one opt-in live-test skip**, **33 local OAuth/API checks** and a **24-check final-image read-only rerun** passed. Browser checks covered provider/model identities, opt-in field explanation, draft-preserving chat minimization, real local Qdrant retrieval and responsive layout. No new Azure inference, commit/push or cloud deployment was performed. [Report and screenshots](docs/AI_EXPERIENCE.md).

Analysis-only scope follow-up (13 October 2026): removed mock payment creation/confirmation and payment-order XML from UI/API. Read-only fixtures, document analysis/review and existing history are retained. **119 frontend tests**, lint/typecheck, Docker web production build, **135 Java passes plus one live-test skip**, and **31 local OAuth/API checks** passed. Browser checks verified invoice-to-statement inspection, EN/DE/VI labels and Nova’s read-only app guide. No new Azure inference or cloud deployment was performed. See [analysis-only verification](docs/ANALYSIS_ONLY.md).

Latest customer-style local audit (13 October 2026): all nine workspaces were walked through with fictional records, actual DATEV Azure extraction and Nova replies. Improvements include compact case switching, mobile transaction cards, filtered totals/export, transaction detail-to-Nova drafts, localized review alerts, automatic queue-review refresh and shared Nova suggestions/copy/scroll controls. **119 frontend tests**, lint/typecheck, Docker production build, **134 Java passes plus one opt-in skip**, and **40 OAuth/reference/banking checks** passed; the final-image read-only OAuth/reference check passed 29 boundaries. See [the complete walkthrough, public-source comparison, screenshots and limits](docs/CUSTOMER_UX_AUDIT.md). These changes are local, not a new cloud deployment.

```bash
npm run verify
cd services/credit-api
mvn --batch-mode verify
```

Local UI audit and Nova follow-up (12 October 2026): **91 frontend tests**, lint/typecheck and Docker production build passed; **22 OAuth/API checks passed** on the final web image. The preceding full audit passed **77 live integration checks**, including Azure. Java: **126 passed, 1 opt-in test skipped**. See the [current Docker audit report](docs/LOCAL_UI_AUDIT.md) for the browser walkthrough, actual Azure calls and screenshot provenance. The changes are local; this audit does **not** claim a new cloud release.

DATEV / native-page-tour follow-up (13 October 2026): **100 frontend tests**, lint/typecheck, Docker web production build and **29 read-only OAuth/reference checks passed**. Nova's old guide selector was replaced by spotlight walkthroughs on the actual page controls. The preceding Java verification remains 126 passed, 1 opt-in skip. See [what changed, preservation boundaries and verification](docs/DATEV_AND_FEATURE_TOURS.md). This follow-up made no new Azure inference calls and is not a production release.

DATEV queue recovery (13 October 2026): **106 frontend tests**, lint/typecheck, Docker web production build and **29 read-only OAuth/reference checks passed**. Java: **134 passed, 1 opt-in test skipped**. A separately authorized browser retry of the official fictional Robert page passed actual ClamAV scanning and Azure `prebuilt-layout` extraction on the first new attempt; its original PDF rendered and net/payout values remained distinct. The old failed job was retained. This is a local recovery test, not a new cloud release or a general AI accuracy measurement. See [the recovery report](docs/DATEV_RECOVERY.md).

Earlier cloud release checks: **70 frontend tests passed**, lint/TypeScript and Vercel production build passed. Java: **126 passed**, one opt-in live test skipped. Separate Azure backend and Vercel-proxy checks each passed 26 boundaries, including PKCE, tenant-scoped SQL, PDF extraction/review, actual antivirus scanning, Qdrant, real Azure Nova, token refresh and logout. See [cloud results](docs/AZURE_VM_LAB.md).

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
- Completed feature upgrades are integrated into master; existing history and real commit timestamps are preserved. After the October 2026 consolidation, only `master` and `develop` remain, synchronized at the release commit.
- Vercel project/domain: **credit-intelligence-lab** / [credit-intelligence-lab.vercel.app](https://credit-intelligence-lab.vercel.app/en).
- The retired Vercel `credit-intelligence-auth` and `credit-intelligence-api` projects and their remaining deployments were removed. Keycloak and Java run on Azure; only the Next.js project remains on Vercel for this app.
- Production Vercel uses `NEXT_PUBLIC_DEMO_MODE=false`, the Azure Keycloak URL and `CREDIT_API_URL`. Anonymous case access is rejected; Java validates every user token.
- Java, databases, Keycloak and workers run on the dedicated Azure VM, not in Vercel Functions. Local Docker remains a separate environment.
- Nova workspace/DATEV improvements, chat limits and Azure Terraform deployment are now included in the release source, not left as uncommitted feature-branch changes. Vercel is redeployed from `master`.
- Retired work is recoverable from `archive/finance-refactor-2026-10-12` and `archive/apobank-platform-2026-10-12` tags. The old Finance prototype is archived, not merged back into the banking lab. No cloud/database resources are deleted by branch cleanup.

## Repository map

```text
app/                     Next.js pages and authenticated transport routes
components/workspace/    workspace, Nova and document viewers
lib/                     schemas, helpers, language tables and public fixtures
services/credit-api/     Java/Spring Boot, LangChain4j, extraction and tests
infra/                   Keycloak, Azure templates and observability
services/credit-api/src/test/resources/   offline regression fixtures
scripts/                 OAuth checks, Azure token helper, backups and PDF assets
docs/                    runbooks, verification and screenshots
```

## References and license

Inspired by the [Microsoft Java Banking Assistant sample](https://github.com/Azure-Samples/agent-openai-java-banking-assistant); not a copy of a production bank platform.

[MIT license](LICENSE). Third-party components retain their own licenses.
