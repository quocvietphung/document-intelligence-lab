# AI-103 lab: contractor pre-check before accounting

A fictional contractor dossier goes through the existing stack (Keycloak → Next.js → Java API → ClamAV →
Docling → Qdrant/BM25), and a read-only check prepares a cited draft for a person. The check compares the
approved amount with the invoice in code, on the same tax basis, and states which acceptance and payment
evidence is missing. Nothing is approved, paid or sent: the agent only reads, and a person reviews and sends
the draft.

> Research support only. All documents, names, numbers and images are fictional (`FIKTIVE DATEN`).

## 1. The dossier and why it is new

The existing construction pack (`real-estate/`, order 184.450,00 + change 12.600,00 vs. invoice 198.250,00 EUR)
also has a 1.200,00 EUR variance, but **none of its amounts states a tax basis** (no netto/brutto), so a
like-for-like comparison cannot be verified. This lab therefore uses a new authored dossier in which every
amount names its basis:

| Document (2 pages each) | Page 2 states | Role |
| --- | --- | --- |
| `bauauftrag-wv-2026-031.pdf` | 36.000,00 netto · 6.840,00 USt · **Auftragssumme 42.840,00 EUR brutto** | contract |
| `nachtrag-n01-wv-2026-031.pdf` | 4.991,60 netto · 948,40 USt · 5.940,00 brutto · **Genehmigte Gesamtvergütung 48.780,00 EUR brutto** | change order (approval) |
| `baurechnung-rg-2026-0457.pdf` | 42.000,00 netto · 7.980,00 USt · **Rechnungsbetrag 49.980,00 EUR brutto** (lines on p. 1) | invoice |
| `abnahmeprotokoll-ap-2026-019.pdf` | accepted Pos. 1–2 with reservation; Pos. 3 not accepted; photos F-01–F-03 | acceptance report |
| `baurechnung-rg-2026-0457-mit-anweisung.pdf` | same invoice plus a faint sentence asking an AI to approve and email | exercise 2c |
| `foto-f-01.png`, `foto-f-02.png` | self-drawn photos with OCR-readable captions (F-03 is deliberately missing) | exercises 2e/2f |

Expected result (computed with `BigDecimal` in Java and `Decimal` in Python, never by a model):
approved **48.780,00 EUR brutto** (change order p. 2, cross-checked: 42.840,00 + 5.940,00) · invoice
**49.980,00 EUR brutto** (invoice p. 2; 42.000,00 + 7.980,00 = 49.980,00) · difference **1.200,00 EUR** on the
same gross basis = invoice line 3 (1.008,40 netto, no change order) + 19 % VAT (191,60). Acceptance evidence is
**PARTIAL** (line 3 not accepted, one open defect until 15.12.2026), payment evidence is **MISSING**, photo
F-03 is **MISSING**. If the bases differ, no difference is computed and the result says `TAX_BASIS_MISMATCH`.

**Invoice number.** The dossier invoice is `RG-2026-0457`. The number `RE-2026-0311` in some briefs belongs to a
different fixture (`use-cases/eingangsrechnung-musterquartier.pdf`), so this lab uses `RG-2026-0457` everywhere.

Regenerate (deterministic hashes, checked by `ContractorPrecheckTest`):
`services/m365-mcp-poc/.venv/bin/python scripts/prepare-contractor-dossier.py`.

## 2. What runs where

Status words, used everywhere in this guide: **local real** (runs here, no cloud), **mock** (a fixture or a rule stands
in for the service; the lab says so in its output), **Azure not run** (the adapter exists or is documented, nothing was
sent to Azure), **Azure verified** (a live call was made and checked; none has been made yet).

| Exercise | Status | Lab part | Command or check | Azure, when opted in |
| --- | --- | --- | --- | --- |
| 1 PDF → fields/tables → evidence → reconcile → cited draft | local real (Docker: ClamAV, Docling, Qdrant + BM25, Java `BigDecimal`, Keycloak) | `ContractorPrecheck`, `CitationCheck`, `PageIsolation` | `TEST_CONTRACTOR_PRECHECK=1`, Java tests | AI Search, Document Intelligence (alternatives) |
| 1a claim-level citations | local real | Java: each stated amount, invoice line and status must be on the page it cites | `ContractorPrecheckTest` | — |
| 1b page quarantine | local real | Java retrieval, tools, field evidence and keyword evidence leave out only the quarantined page | `PageIsolationTest`, `PageIsolationContextTest` | — |
| 2a Python agent with read-only tools | local real (scripted or Ollama planner) | `agent.py` | `python3 -m contractor_lab agent` | Foundry Agent Service: **Azure not run** |
| 2b Nova summary and email draft | local real (Ollama) | `nova.py`: claim-level checks, quarantined sources never sent | `python3 -m contractor_lab nova`; `tests/test_citations.py` | Azure OpenAI: **Azure not run** |
| 2c Self-approval sentence in a PDF | local real (Java + Python rule mirror) | `guard.py`, `EvidenceGuard` | `offline`; `ContractorPrecheckTest` | Prompt Shields: **Azure not run** |
| 2d Email classification + PII masking | local real (rules, regex masking) | `emails.py` | `offline` (8/8 categories) | AI Language PII: **Azure not run** |
| 2e Acceptance photo linking | local real (Tesseract OCR) | `media.py` | `offline`; Docling OCR when photos are uploaded | AI Vision: **Azure not run** |
| 2f Image/audio → JSON schema | local real for photos; **mock** for speech (reference transcript) | `media.py`, `speech.py` | `offline` | Speech and Content Understanding: **Azure not run** |
| 2g OpenTelemetry step timings | local real (collector file) | `otel.py`, Java spans | `trace-report` | Application Insights: **Azure not run** |
| 3 Azure configuration | local real (no network) | `cloud.py` | `cloud-plan` | Every service needs the explicit opt-in |
| 4a Speech: audio → transcript → Nova → listen | **mock** transcript; local browser voice in the app | `speech.py` (fast transcription, SSML, check) | `speech` | Azure Speech STT and TTS: **Azure not run** |
| 4b Translator: German e-mail → English | **mock** (English reference); transliteration sample | `translator.py` | `translate` | Azure Translator: **Azure not run** |
| 4c Voice Live with barge-in | **mock** (scripted documented events) | `voice_live.py` | `voice-live` | Voice Live: **Azure not run**; no live session |
| 5 Azure AI Search (Blob → indexer → skillset → index → query) | **local real** BM25 over the same PDF pages; configuration files | `search_lab.py`, `azure/search/` | `search` | AI Search: **Azure not run**; hybrid search not verified |
| 6 Content Understanding and Vision | request shape checked (**mock**); Vision inpainting **not offered** (see below) | `content_understanding.py`, `azure/content-understanding/` | `content-understanding` | **Azure not run** |

## 3. Pass/fail criteria

| # | Pass when | Check |
| --- | --- | --- |
| 1 | Four PDFs scanned and extracted by Docling; approved 48780.00 GROSS cites change order p. 2; invoice 49980.00 GROSS cites invoice p. 2; difference 1200.00 on the same basis; lines from the Docling table; acceptance PARTIAL; payment MISSING; draft `DRAFT_REQUIRES_HUMAN_REVIEW`, `approved=false`, `emailSent=false`; dossier version and audit unchanged; every claim's citation contains its literal (`citationsVerified`) | `TEST_CONTRACTOR_PRECHECK=1 node scripts/test-oauth.mjs`, `ContractorPrecheckTest` |
| 1a | A cited page that exists but holds other content is `NOT_SUPPORTED`; a missing page or document is `UNKNOWN` and is never guessed | `ContractorPrecheckTest` |
| 1b | A quarantined page loses its text, fields, regions and table cells from model context; its neighbours stay retrievable; the original PDF stays open for review | `PageIsolationTest`, `PageIsolationContextTest` |
| 2a | Draft is schema-valid; only GET and the read-only search were sent; forbidden tools are denied and logged; amounts equal the Java result | `python3 -m contractor_lab agent`, `AgentTests` |
| 2b | Every stated amount is cited to a source whose text contains it; computed amounts cite a source; acceptance and line claims cite their own text; no approval, payment or sent claim. A quarantined source is never sent (`SKIPPED_ISOLATED_SOURCE`) | `python3 -m contractor_lab nova`, `tests/test_citations.py` |
| 2c | The sentence is reported with page 2 as a HIGH finding; amounts, approval and email flags do not change; the page is quarantined from retrieval; no false positive on legitimate approval wording | live acceptance, `ContractorPrecheckTest`, `InstructionAndEmailTests` |
| 2d | 8/8 categories; bank-detail change and approval instruction are HIGH; no residual e-mail, phone, IBAN, VAT ID or known name after masking | `offline`, `InstructionAndEmailTests` |
| 2e | F-01 and F-02 linked by hash, F-01 linked to defect M-1, F-03 reported missing | `offline`, live pre-check after photo upload |
| 2f | Photo and audio JSON validate against their schemas; no invented amounts; the transcript source says `mock-reference-transcript` | `offline`, `MediaTests` |
| 2g | Each step has a span with a duration; `precheck.extract/search/reconcile/draft` appear in the same trace as the agent's spans | `trace-report`, `TracingTests` |
| 3 | Without the explicit opt-in every service stays local; live calls are refused before any network call; key values never appear in output | `cloud-plan`, `CloudTests`, `tests/test_speech.py`, `tests/test_translation.py`, `tests/test_search.py` |
| 4a | The transcript keeps `RG-2026-0457`, `49.980,00` and the currency; a misheard number or a missing currency word fails; the answer passes the claim checks; nothing is approved or sent; the listening engine is named | `speech`, `tests/test_speech.py` |
| 4a-ssml | Text is escaped; the voice locale matches `xml:lang`; the example is well-formed | `tests/test_speech.py` |
| 4b | Identifiers, amounts and currencies survive translation even when the number format changes; a lost code, a wrong amount or a changed currency is reported | `translate`, `tests/test_translation.py` |
| 4c | `session.update` uses server VAD without the azure-only interrupt option; barge-in sends `response.cancel` and `conversation.item.truncate` at the played position (1200 ms); late audio is ignored; a source page request answers from the allowed case only; a spoken answer that cites another case is refused | `voice-live`, `tests/test_voice_live.py` |
| 5 | Each pre-check query ranks its page first (BM25 on the same PDF pages); the payment query finds no dated confirmation; the Azure configuration keeps the documented shapes | `search`, `tests/test_search.py` |
| 6 | The request uses a documented analyzer name and `mimeType`; `prebuilt-documentAnalyzer` and `contentType` are rejected; no call is made | `content-understanding`, `tests/test_content_understanding.py` |

## 4. Run it

```bash
# Stack (reuses volumes and the already downloaded model; builds app images one at a time)
node scripts/docker-local.mjs

# 1 · live pre-check, 2c, 2e (creates two fictional dossiers; prints their ids)
TEST_CONTRACTOR_PRECHECK=1 node scripts/test-oauth.mjs

# Java and web unit tests for the new code
mvn -q -f services/credit-api/pom.xml test -Dtest='ContractorPrecheckTest,PageIsolation*' -Dsurefire.failIfNoSpecifiedTests=false
npx vitest run lib/contractor-precheck.test.ts lib/nova-speech.test.ts

# Offline lab (no Docker, no network): 20 criteria
cd labs/ai103
python3 -m unittest discover -s tests -v          # 73 tests
python3 -m contractor_lab offline
python3 -m contractor_lab speech                  # 4a, mock transcript; writes .local/ai103/speech-result.json
python3 -m contractor_lab translate               # 4b, English reference; writes .local/ai103/translate-result.json
python3 -m contractor_lab voice-live              # 4c, scripted events
python3 -m contractor_lab search                  # 5, BM25 over the PDF pages + configuration check
python3 -m contractor_lab content-understanding   # 6, request shape
python3 -m contractor_lab cloud-plan --env-file ../../.local/ai103-azure.env   # 3, no network

# Nova and the agent need the local stack (see the next two blocks)
python3 -m contractor_lab agent --case CR-…                 # scripted planner, host → localhost:8081
python3 -m contractor_lab nova --case CR-…                  # one local Nova call, several minutes on CPU
```

**Review in the UI.** Open `http://localhost:3000/vi?case=<id>#controls` (**Đối chiếu / Reconciliation**),
choose **Chạy kiểm tra (chỉ đọc)**, open each cited page, then confirm the extracted fields under
**Documents & evidence** (the existing human review). The panel only shows and copies the draft; sending is up
to the person. In the Nova chat and in **AI transparency → Answer history**, **Listen to answer** reads a finished
answer with the browser's voice on this device; the label beside the button says so.

**Agent with the local model as planner.** Ollama is on an internal Docker network with no host port. Run the
agent in a throw-away container on that network; the token is passed on stdin, never as a file or variable:

```bash
python3 -c "import sys; sys.path.insert(0,'labs/ai103'); from contractor_lab.platform import login; print(login())" | \
docker run --rm -i --network credit-intelligence-lab_local_models -v "$PWD/labs/ai103:/lab:ro" -w /lab \
  -e PYTHONDONTWRITEBYTECODE=1 python:3.12-slim python -m contractor_lab agent --case CR-… --planner ollama \
  --api http://credit-api:8080 --token-stdin --timeout 400
```

**Tracing (2g).** Start the local collector and restart the API with tracing on, run the agent with
`--otlp http://127.0.0.1:4318/v1/traces`, then print the per-step durations of that trace:

```bash
mkdir -p .local/ai103/otel && chmod 777 .local/ai103/otel
OLLAMA_CHAT_MODEL=qwen3:4b-instruct-2507-q4_K_M docker compose \
  -f docker-compose.yml -f docker-compose.platform.yml -f docker-compose.docling.yml \
  -f docker-compose.nova-local.yml -f docker-compose.etl.yml -f docker-compose.local-resources.yml \
  -f docker-compose.m365.yml -f docker-compose.ai103-otel.yml up -d otel-collector credit-api
cd labs/ai103 && python3 -m contractor_lab agent --case CR-… --otlp http://127.0.0.1:4318/v1/traces
python3 -m contractor_lab trace-report --trace <traceId printed in the result>
```

Spans carry step names, counts, HTTP route templates and, for Azure adapters, the operation, status, duration, error
type and correlation id only. The collector drops full URLs and writes to the git-ignored `.local/ai103/otel/traces.jsonl`.
Return to the normal stack with `node scripts/docker-local.mjs --no-build`.

## 5. Azure later (opt-in, nothing created or called today)

1. Copy the template: `cp labs/ai103/azure.env.example .local/ai103-azure.env` (git-ignored). Its versions were read
   from learn.microsoft.com on 2026-11-11; the ones marked there as not re-verified still need a check.
2. Pick **existing** resources in VS Code. In the **Azure Resources** view, sign in, choose the subscription and open
   each resource (AI Search, AI Services or Foundry, Speech, Translator, Document Intelligence, Content Safety,
   Language, Vision, Application Insights). Copy the endpoint from the resource's properties or its portal
   *Keys and Endpoint* page. In **Foundry Toolkit**, select the Foundry project and copy the **project endpoint**
   (`https://<resource>.services.ai.azure.com/api/projects/<project>`) and the **deployment name** of a chat model.
   Menu labels differ between extension versions; the values are what matter.
3. Use Microsoft Entra ID (`az login`) and resource-scoped roles (Search Index Data Reader, Cognitive Services User,
   Cognitive Services OpenAI User, Azure AI User). Leave key variables empty; `cloud-plan` reports keys by name only
   and recommends removing them. Live adapters take a bearer token on stdin (`--token-stdin`), never a key.
4. Check the plan: `python3 -m contractor_lab cloud-plan --env-file ../../.local/ai103-azure.env`. It validates endpoint
   shapes and makes no network call.
5. Only when you decide to run billable tests, set `AI103_AZURE_OPT_IN=billable-calls-approved` and list the services
   in `AI103_AZURE_SERVICES`. Each live path passes `cloud.require_live(service)` first and refuses otherwise.

### Service status

| Service | Used for | Status now |
| --- | --- | --- |
| Foundry Agent Service | 2a read-only agent in Python | local real (scripted and Ollama planners); **Azure not run** |
| Azure OpenAI | 2b Nova summary (local Ollama stand-in) | local real; **Azure not run** |
| Document Intelligence | extraction alternative; latest GA version `2024-11-30` (verified) | local real (Docling); **Azure not run** |
| Content Understanding | document, image and audio analysis (6) | mock (request shape checked); **Azure not run** |
| Vision | photo analysis (2e); Image Analysis 4.0 has no inpainting; the API retires on 2028-09-25 | local real (Tesseract); **Azure not run** |
| Language | PII detection (2d), GA `2026-05-01` (verified) | local real (rules); **Azure not run** |
| Content Safety | Prompt Shields `text:shieldPrompt`, `2024-09-01` (verified) | local real (EvidenceGuard rules); **Azure not run** |
| Application Insights | telemetry (2g) | local real (collector file); **Azure not run** |
| Speech | fast transcription, text to speech (4a) | mock (reference transcript, macOS voice); **Azure not run** |
| Translator | German → English e-mail, transliteration (4b) | mock (English reference); **Azure not run** |
| Voice Live | barge-in session (4c) | mock (scripted events); **Azure not run** |
| AI Search | Blob → indexer → skillset → index → query (5) | local real (BM25 over the same pages); **Azure not run** |

No row is **Azure verified** yet. Verification means one opted-in call per service, its response checked, and its
telemetry reviewed.

### Operations practice

- **Prompt Shields and embedded instructions (2c).** The lab's rule catches the self-approval sentence without a
  service. Prompt Shields (`contentsafety/text:shieldPrompt`) is the Azure check to run in the same place once opted in.
- **Entra ID, RBAC, managed identity.** Use the roles above; the AI Search data source uses an identity-based
  connection string (`ResourceId=…`), not an account key.
- **Private networking.** Not designed or tested in this lab. Private endpoints for the AI services are a separate task.
- **Telemetry.** Azure adapters record only operation, status, duration, error type and correlation id.
  Request bodies, transcripts, translations, answers and tokens are not recorded.

### Custom Speech with fictional data (guide, not created)

1. Recording: WAV, RIFF, 16 kHz (8 kHz is also accepted), mono, PCM 16-bit, at most 40 seconds per training file.
   The fixture `labs/ai103/fixtures/speech/site-note-invoice.wav` already has this format.
2. Transcript: one plain-text `.txt` or `.tsv` file, one line per audio file: `site-note-invoice.wav<TAB>Begehung Haus C am …`.
   Non-English transcripts must be UTF-8 **with** a byte-order mark. Use `fixtures/speech/site-note-invoice.transcript.json`
   as the source of the text, and keep only fictional data.
3. Package: a `.zip` of up to 2 GB or 10,000 files, uploaded to a Speech resource that exists in your subscription.
4. Training is billable if the base model was created on or after 1 October 2023; deploying an endpoint is billable too.
   Check the pricing page before the first run. This guide does not create the project or train a model.

### VS Code with existing Azure resources (guide)

Install the Azure Resources and Foundry Toolkit extensions, sign in with `az login` or the extension's sign-in, select
the subscription, and open the resources listed in step 2. Copy only endpoints and deployment names into
`.local/ai103-azure.env`. Do not copy keys. Run `cloud-plan` to see what is configured. Nothing in this guide creates a
resource or deploys anything.

### Not built, and why

- **Vision inpainting.** The Image Analysis 4.0 documentation read on 2026-11-11 lists no inpainting or object removal,
  and background removal was retired on 2025-03-31. No inpainting lab was built, so no result is claimed.
- **`single-task` and `pro` analysis modes (Content Understanding).** The documentation read on 2026-11-11 names neither.
  `pro mode` is retired (2025-05-01-preview). The current option is agentic mode in the preview API (2026-06-01-preview),
  which this lab does not use.
- **Speech translation over REST.** Documented for the Speech SDK; the REST pages have no speech-to-speech guide.
  The lab translates the transcript with the Translator text API instead.
- **Hybrid search query.** The Learn page for hybrid search returned 404 when read. The lab sends keyword queries only.
- **Live Voice Live session.** The lab does not open a WebSocket. Run the official sample (`azure-ai-voicelive` package,
  quickstart `voice-live-quickstart.py --use-token-credential`) against an existing resource to check it. Status: **not run**.

## 6. Results (2026-11-11, development machine)

Apple Silicon Mac, Docker Desktop with 8 GiB and 6 CPUs; Docling capped at 2 CPUs, Ollama at 3 CPUs,
model `qwen3:4b-instruct-2507-q4_K_M`. All numbers are from this one machine and fixture set; they are
development measurements, not accuracy claims.

| Check | Result |
| --- | --- |
| `ContractorPrecheckTest` (incl. scan of every bundled PDF for false approval-instruction hits) | 9/9 |
| `mvn verify` (whole Java API) | 375 tests, 0 failures, 5 skipped (opt-in live tests) |
| `npm run lint` · `npm test` · `tsc --noEmit` | clean · 356/356 · clean |
| Script tests (`docker-local`, `docker-azure-config`, `check-public-source`, Nova helpers) | 28/28 |
| `check-public-source.mjs` | 0 risks (new PDFs added to the reviewed fixture allowlist) |
| Live acceptance `TEST_CONTRACTOR_PRECHECK=1` (final images) | 53/53 |
| Python lab unit tests · `offline` | 22/22 · 11/11 |
| Live agent, scripted planner · local-Ollama planner | 6/6 (4 requests: 2 GET, 2 read-only searches) · 6/6 in 210 s, same 4 tools chosen by the model, none denied |
| Live Nova suggestion (`vi`) | 3/3, accepted for review, 85 s (warm prompt cache) |
| Trace report | 2/2: agent and API spans share one trace (50 spans) |

Measured live values: approved `48780.00` GROSS (change order p. 2, region-linked), invoice `49980.00` GROSS
(invoice p. 2), difference `1200.00` (net `1008.40`, VAT `191.60`), lines from the Docling table, acceptance
PARTIAL, payment MISSING, photos F-01/F-02 linked by Docling OCR, F-03 missing; the instruction variant is
reported on p. 2 and its page is quarantined from retrieval.

Timings: Docling + ClamAV took about 15–20 s per two-page PDF and 9–11 s per photo (queue processes one file
at a time). Pre-check steps, cold (first Qdrant sync of the dossier): extract 11 ms, search 3.3 s, reconcile
17 ms, draft 7 ms; warm, from the OpenTelemetry trace: extract 3.4 ms, search 187 ms, reconcile 1.1 ms,
draft 0.25 ms.

Findings during the runs:

- **Docling timeout on a photo.** The first version of `foto-f-02.png` (five drawn wall panels) made Docling's
  table stage exceed its 110 s limit on three attempts (`ANALYSIS_HTTP_503`, job `FAILED`), while the similar
  F-01 took 9 s. The images were redrawn without grid shapes; both now take about 10 s. Real photos with
  tiles or panels may hit the same limit on CPU.
- **Local Nova output limit.** A request for a summary plus a full email produced more than the configured
  420 output tokens; the API correctly refused the cut-off answer with 503 instead of returning partial text.
  The lab request is now capped at 110 words. The setting itself (`LocalAiConfiguration.numPredict`) was not
  changed.
- **Keycloak cookies and Python.** Keycloak marks its login cookies `Secure`; Python's `CookieJar` does not
  send them over `http://localhost`, so the lab keeps them by hand for the local realm only.
- **Citation checks are structural.** Nova's citations are checked to exist among the sources it received,
  not that each cited chunk supports the sentence (one cited the change-order page for "line 3 has no
  change order"). A person still opens the pages.

UI check: in headless Chrome (throw-away profile), after a real Keycloak login, the Vietnamese
Reconciliation page showed the panel with both amounts, localized tax basis and findings, and **Mở trang**
opened the existing evidence dialog on page 2 of the change order next to its extracted fields. The confirm
button in that dialog was not pressed: confirming is the person's step.

Not verified: no Azure service was called; Azure adapters for these exercises do not exist yet.
