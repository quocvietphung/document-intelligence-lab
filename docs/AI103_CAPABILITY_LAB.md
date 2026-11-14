# AI-103 Capability Lab

The AI-103 Capability Lab is one page in the workspace (`/en/ai103`, `/de/ai103`, `/vi/ai103`; menu item **AI-103 Lab**). It lists eighteen capability groups, and each group is tied to a fictional document from the contractor dossier. It is not a quiz and does not contain exam questions.

Everything the page shows comes from one manifest, [`lib/ai103/capabilities.json`](../lib/ai103/capabilities.json), or from a check that the server runs. The browser never marks a result as passed by itself. Opening the page sends no request to Azure.

| Part | File |
| --- | --- |
| Manifest (statuses, dates, commands, fixtures, results) | `lib/ai103/capabilities.json` |
| Schema, rules and counts | `lib/ai103/model.ts` |
| In-app checks (deterministic, bundled fixtures, no network) | `lib/ai103/checks.ts` |
| Page texts in English, German and Vietnamese, and the decision matrix | `lib/ai103/language.ts` |
| Page | `app/[locale]/ai103/page.tsx`, `components/workspace/Ai103Lab.tsx` |
| API | `GET /api/ai103/capabilities`, `POST /api/ai103/capabilities/{id}/run-local`, `POST /api/ai103/capabilities/{id}/run-azure` |
| Tests | `lib/ai103/*.test.ts` |

## Status words

| Side | Status | Meaning |
| --- | --- | --- |
| Local | `local-real` | A real local engine or service ran on the fixture (Docling, Qdrant and BM25, Ollama, Keycloak, Docker). |
| Local | `local-deterministic` | A fixed rule or check ran on fixtures; no model is involved. |
| Local | `local-mock` | Only a fixture or a stub exists; nothing was generated or recognised. |
| Local | `not-supported-locally` | The hardware cannot run it (video generation, the optional image engine). |
| Azure | `azure-ready` | The adapter compiles and passed tests at a mocked HTTP boundary. **Not live-tested.** |
| Azure | `azure-live-verified` | Azure was called and a redacted result is stored. No capability has this status. |
| Azure | no adapter | No Azure adapter exists in this repository. |

The header shows four counts: local real or deterministic, local mock or configured, Azure ready and Azure verified. Local and Azure counts overlap, because a capability can run locally and also have an Azure adapter. Mock capabilities are never counted as local real. The validator (`manifestProblems`) refuses a status that claims evidence it does not carry, for example `azure-ready` with a live test date or without its adapter test.

OCR confidence, citation matches and hit@K are never called accuracy.

## Capabilities

The page groups the eighteen capabilities into five groups (Ingest & Understand, Search & Reason, Agents & Generative AI, Safety & Governance, Operate & Evaluate), shows one group at a time as a compact grid, and opens each capability in a drawer with its business problem, input, fixtures, expected result, local and Azure implementation, status, run button, result, limits and a Microsoft Learn link. `?capability=<id>` opens the drawer directly.

| # | Capability | Group | Local | Azure | Fixture | Last tested | In-app check |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Foundry tools / MCP | Agents & Generative AI | `local-deterministic` | no adapter | `precheck-sample.json (+1)` | 2026-11-14 | command only |
| 2 | Security | Safety & Governance | `local-real` | no adapter | `manifest.json` | 2026-11-14 | command only |
| 3 | Computer Vision generation | Agents & Generative AI | `local-mock` | no adapter | `images.json (+2)` | 2026-11-14 | `image-request-contract` |
| 4 | AI Search | Search & Reason | `local-real` | `azure-ready` | `dossier-pages.json (+4)` | 2026-11-14 | `search-pages` |
| 5 | Observability | Operate & Evaluate | `local-real` | no adapter | `precheck-sample.json (+2)` | 2026-11-14 | `trace-steps` |
| 6 | Foundry Agents | Agents & Generative AI | `local-deterministic` | no adapter | `precheck-sample.json (+1)` | 2026-11-14 | command only |
| 7 | Speech | Ingest & Understand | `local-mock` | `azure-ready` | `site-note-invoice.wav (+2)` | 2026-11-14 | `speech-transcript` |
| 8 | RAG | Search & Reason | `local-real` | `azure-ready` | `rag-pdf-sources.json (+1)` | 2026-11-13 | command only |
| 9 | Azure services selection | Search & Reason | `local-deterministic` | no adapter | `AI103_CAPABILITY_LAB.md (+1)` | 2026-11-14 | `decision-matrix` |
| 10 | Content Understanding | Ingest & Understand | `local-mock` | `azure-ready` | `analyze-document.request.json` | 2026-11-14 | `cu-request-shape` |
| 11 | Deployment | Operate & Evaluate | `local-real` | no adapter | `docker-compose.yml (+2)` | 2026-11-14 | command only |
| 12 | GenAI application | Agents & Generative AI | `local-real` | `azure-ready` | `precheck-sample.json (+1)` | 2026-11-13 | command only |
| 13 | Vision understanding | Ingest & Understand | `local-deterministic` | no adapter | `images.json (+3)` | 2026-11-14 | `photo-metadata` |
| 14 | Language and PII | Ingest & Understand | `local-deterministic` | no adapter | `emails.json` | 2026-11-14 | `pii-masking` |
| 15 | Translator | Ingest & Understand | `local-deterministic` | `azure-ready` | `contractor-email.json (+1)` | 2026-11-14 | `translator-preservation` |
| 16 | Document Intelligence | Ingest & Understand | `local-real` | `azure-ready` | `ocr-misread.sample.json (+3)` | 2026-11-14 | `ocr-cross-check` |
| 17 | Vision and content safety | Safety & Governance | `local-deterministic` | no adapter | `baurechnung-rg-2026-0457-mit-anweisung.pdf (+1)` | 2026-11-14 | `injection-guard` |
| 18 | Evaluation | Operate & Evaluate | `local-deterministic` | no adapter | `precheck-sample.json (+2)` | 2026-11-14 | `evaluation-deterministic` |

Counts: 15 local real or deterministic (7 real, 8 deterministic), 3 local mock, 7 Azure ready, 0 Azure verified. A test (`lib/ai103/docs.test.ts`) keeps this table in line with the manifest.

## Azure adapters

`lib/ai103/azure-adapters.ts` holds the Azure side of the shared execution contract. Each adapter uses the same environment variables and opt-in as the lab CLI (`AI103_AZURE_OPT_IN=billable-calls-approved`, `AI103_AZURE_SERVICES`), takes a short-lived bearer token from the caller, accepts only an https endpoint on an Azure host, and maps the answer to the local contract. There is no fallback between local and Azure. `lib/ai103/azure-adapters.test.ts` tests them at a mocked HTTP boundary; none was called live, and the page shows the Azure button disabled.

| Local | Azure adapter | Shared contract |
| --- | --- | --- |
| Qdrant + BM25 + reranker (credit API) | `searchQuery` (Azure AI Search) | hit list: document, page, score, source id |
| Docling | `documentIntelligenceSubmit`, `parseLayoutResult` (Document Intelligence prebuilt-layout) | page text and word confidence on the same labelled pages |
| Ollama (Nova) | `openAiStructuredChat` (Azure OpenAI) | the same JSON-schema answer with source labels |
| Content Understanding request check | `contentUnderstandingSubmit` | analyzer id in the URL, inputs in the body |
| Translation preservation check | `translateAndCheck` (Azure AI Translator) | identifier, amount and currency rule |
| Lab speech adapter | `labs/ai103/contractor_lab/speech.py` | transcript check of invoice code, amount and currency |
| Local OpenTelemetry collector | Application Insights exporter (configured only) | spans with the redaction allowlist |
| Control Tower marts | Power BI semantic model (documented only) | `services/document-etl/powerbi/` relationships and measures |

## Fixtures

The central scenario is the fictional contractor dossier in `services/credit-api/src/main/resources/contractor-dossier/` (MIT, authored for this repository; see its `manifest.json`):

- approved contract value 48.780,00 EUR: `nachtrag-n01-wv-2026-031.pdf`, page 2;
- invoice value 49.980,00 EUR: `baurechnung-rg-2026-0457.pdf`, page 2;
- expected variance 1.200,00 EUR on the same gross basis;
- no dated payment confirmation, so payment evidence is `MISSING` and the result goes to review.

| Required fixture | Where |
| --- | --- |
| Scanned PDF | `services/credit-api/src/test/resources/evidence/scanned-skew-regression.pdf` |
| Rotated page | `labs/ai103/fixtures/capability/rotated-repeated-value.pdf`, page 2 at 90 degrees |
| One value four times on one page | the same file, page 1 (48.780,00 EUR four times) |
| OCR that misreads a digit | `labs/ai103/fixtures/capability/ocr-misread.sample.json` (48.730,00 for 48.780,00) |
| PDF with a prompt injection | `contractor-dossier/baurechnung-rg-2026-0457-mit-anweisung.pdf`, page 2 |
| E-mail with personal data | `labs/ai103/fixtures/emails.json` (eight e-mails, invented names, `.example` domains, invalid IBANs) |
| Short audio | `labs/ai103/fixtures/speech/site-note-invoice.wav` (synthetic speech, with a reference transcript) |
| Photo as evidence | `contractor-dossier/foto-f-01.png`, `foto-f-02.png` (F-03 is referenced but missing, on purpose) |
| Question without an answer | payment question of the pre-check; three unanswerable questions in `lib/rag-pdf-questions.json` |

The files in `labs/ai103/fixtures/capability/` are generated by `scripts/prepare-ai103-capability-fixtures.py` (deterministic). Their checksums are in that folder's `manifest.json`, and a test fails if a file changes without the manifest. The RAG benchmark PDFs are prepared from public sources listed in `lib/rag-pdf-sources.json`; the PDFs themselves stay in `.local/` and are not in Git.

## Image generation

Text to image, image to image and inpainting are checked as requests only: mode, MIME type, size, the mask size against the source, and a 4 MiB limit. A deterministic stub answers with a fixed record and never returns an image. The check uses the real header data of `foto-f-01.png`.

- No image model is installed. A local engine (for example a diffusion model) would download several GB and share the 5 GiB memory limit with Ollama, so it needs your consent first and would run as its own Compose profile, never next to Ollama and Docling by default.
- Video generation is `not-supported` on this hardware (CPU only, no GPU memory for video models).
- No Azure request shape for image generation is built in this pass.

## Vision understanding

The check reads only metadata: MIME type, size and orientation from the PNG header, the caption text, and the pages of the acceptance report that name each photo. It finds that F-03 is referenced but not provided. It does not detect objects or analyse image content, and each photo still needs human review.

## Document Intelligence

Docling is the local provider (live test 1/1 on 13 November 2026). The in-app check compares OCR text with the source page and flags a misread digit for review, counts a value that appears four times on one page, and confirms the rotated page. Field, table-cell, page and bounding-box match against labelled ground truth are not measured yet, and a comparison with Azure Document Intelligence did not run. OCR confidence is never shown as accuracy.

## Evaluation

| Metric | Kind | Status in this pass |
| --- | --- | --- |
| Field match (approved, invoice, variance) | deterministic | 3 of 3 |
| Citation page match (quote found on the cited page) | deterministic | 4 of 4 |
| Retrieval rank of the recorded Qdrant run | deterministic | hit@1 3/3, hit@5 3/3, MRR 1.00 |
| Retrieval on the nine-PDF benchmark | deterministic | see RAG (hit@5 and MRR@5 per method) |
| Abstention on missing payment evidence | deterministic | passed |
| Latency of the recorded pre-check run | measured | 4 steps, 2,980 ms |
| Cost | stated | 0 EUR, no paid service |
| Classification precision, recall and F1 | deterministic | not run in this pass |
| Groundedness judged by a model | model-based | not run |
| Human correction rate | measured | no review data |

## Decision matrix

The page shows six choices with the same five criteria (data, latency, cost, governance, local capability) and when to use each: Document Intelligence or Content Understanding; Azure AI Search or Qdrant and BM25; Azure OpenAI or Ollama; Foundry Agent or local workflow; Azure Speech or browser voice; Application Insights or local OpenTelemetry. The text is in `lib/ai103/language.ts`, and the `decision-matrix` check confirms that every cell is filled in all three languages. Prices change, so the cost column states relative order, not a quote.

## Deployment profiles

The stack keeps its Compose file groups (`scripts/compose-files.mjs`). They map to the profiles of the brief as follows; no Compose file was restructured in this pass.

| Profile | Compose files | Default |
| --- | --- | --- |
| core | `docker-compose.yml`, `docker-compose.platform.yml`, `docker-compose.etl.yml`, `docker-compose.local-resources.yml`, `docker-compose.m365.yml` | yes |
| local-ai | `docker-compose.docling.yml`, `docker-compose.nova-local.yml` | yes |
| observability | `docker-compose.monitoring.yml`, `docker-compose.observability.yml`, `docker-compose.ai103-otel.yml` | no |
| ai103 | the lab runs on the host (`labs/ai103`) and on the `/ai103` page; no extra container | — |
| azure-adapters | `docker-compose.azure.yml`, `docker-compose.azure-host.yml` | no, opt-in |
| image-generation | not created; needs your consent to download a model | no |

Resources (`docker stats --no-stream`, 14 November 2026), eleven backend containers, no model loaded in Ollama:

| Moment | Total | Largest containers |
| --- | --- | --- |
| Before the work, idle | about 2.7 GiB | Docling 1.31 GiB, credit API 490 MiB, Keycloak 488 MiB, ClamAV 146 MiB, Qdrant 106 MiB |
| After the acceptance run (plus `web` 57 MiB) | about 4.0 GiB | Docling 1.62 GiB, ClamAV 1.0 GiB, Keycloak 490 MiB, credit API 479 MiB, Qdrant 193 MiB |

Nothing was optimised in this pass. The difference comes from state, not from the change: ClamAV reloads its signature database after a restart, and Docling keeps memory after parsing the dossier. CPU was below 5 % per container in both samples.

## Azure tests

Azure tests are off. The page shows no Azure button while nothing is configured and opted in. The web API answers 403 without `AI103_AZURE_OPT_IN=billable-calls-approved` and 501 with it, because no live adapter is wired into the web app; in both cases no request leaves the server and no resource is created. Live calls run only from the lab CLI behind `require_live` (`labs/ai103/contractor_lab/cloud.py`), after `python3 -m contractor_lab cloud-plan` has shown the services, region and cost plan. CI never calls Azure.

## Verification record

One local pass on 14 November 2026, branch `feature/evidence-control-tower`, Apple Silicon Mac with Docker Desktop, Node 20, Java 21, Python 3.12 for the lab tools. Commands ran from the repository root unless stated otherwise. No Azure call, no cloud resource and no deployment.

| Area | Command | Result |
| --- | --- | --- |
| Web lint | `npm run lint` | 0 warnings |
| Web types | `npx tsc --noEmit` | clean |
| Web unit tests | `npx vitest run` | 404 of 404 in 60 files (includes the Azure adapters at a mocked HTTP boundary and the Control Tower data) |
| Web build | `npm run build` | passed; `/en|de|vi/ai103` and `/en|de|vi/control-tower` prerendered |
| Java API | `mvn -B clean test` in `services/credit-api` | 398 run, 0 failures, 0 errors, 5 skipped (live or opt-in tests) |
| Lab tests | `python -B -m unittest discover -s tests` in `labs/ai103` | 87 of 87 |
| Lab lint and types | `ruff check .`, `mypy contractor_lab` (2.4.1) | clean; no issues in 17 files |
| ETL tests | `python -B -m unittest test_worker test_analytics test_control_tower test_evidence_worker test_production_flow` in `services/document-etl` | 33 run, 3 skipped on the host (no dbt); 2 of these 3 passed inside the ETL container, the third needs a repository PDF that the container does not mount |
| ML tests | `python -B -m unittest test_classification test_engine` in `services/document-ml` | 14 of 14 (scratch venv with `requirements.txt` plus `pytz`) |
| Docker helper | `node --test scripts/docker-local.test.mjs` | 10 of 10 |
| Compose | `config --quiet` on the default files; `node scripts/check-production-compose.mjs`; `node scripts/check-public-source.mjs` | valid; no Spark; 0 filename risks |
| Secrets | `gitleaks` on the changed and new files | no leaks |
| Stack | `credit-api` and `etl` rebuilt for `document-medallion-v4`, `web` rebuilt and published on 127.0.0.1:3001 only | twelve containers healthy; no new container |
| Lab API | `GET /api/ai103/capabilities`; `POST …/run-local` for all 18; `POST …/run-azure` | counts 15 / 3 / 7 / 0; 12 of 12 server checks passed (0.4 to 36 ms), six answer with their command; run-azure 403 `opt-in-off`, `requestSent: false` |
| Control Tower acceptance | `TEST_CONTROL_TOWER=1 TEST_WEB_URL=http://localhost:3001 node scripts/test-oauth.mjs` | 29 checks passed: Bronze 6, Silver 17, reviewed Gold 3; 7 data-quality checks; retrieval rank 1 for the three labelled pages; payment question abstained; citations 48.780,00 and 49.980,00 on page 2; 19 tables as CSV and Parquet (41 files); instruction page blocked (rate 1); simulated OCR row raw 48.730,00, reviewed 48.780,00, written as an evaluation case |
| Contractor acceptance | `TEST_CONTRACTOR_PRECHECK=1 TEST_WEB_URL=http://localhost:3001 node scripts/test-oauth.mjs` | 53 checks passed, exit 0; creates two fictional dossiers in the local database |
| Browser | built-in browser pane, port 3001 | English, German and Vietnamese lab pages fit 1024 × 768 without scrolling; group tabs, search ("ocr": 1 of 18), status filter (Local mock: 3 of 18); deep link `?capability=…` opens the drawer; "Run local test" passed from the server; Azure button disabled; 375 px phone width without horizontal page scroll; Control Tower four areas and drill-through from KPI to reviewed value in all three languages; no console errors; 257 requests, all to localhost:3001 and the local Keycloak |
| Keycloak | the client allowed `http://localhost:3001` during the run, through the admin API | restored afterwards: only `http://localhost:3000` |

## Limits

- No capability is verified on Azure: seven have an adapter tested at a mocked HTTP boundary (`azure-ready`), the others have no adapter.
- Nova's claim-level amount check in the lab passes 2 of 3 criteria (one source label per segment).
- No single trace yet from upload through ClamAV, OCR, indexing, retrieval and Nova; the page shows step latency from a recorded pre-check run.
- Speech is tested in German only; the transcript is a fixture. English and Vietnamese audio are not tested.
- Translation is checked against a human reference only; German to Vietnamese and transliteration are not covered.
- The e-mail fixtures have no complaint or missing-documents category yet.
- Citation bounding boxes are located by matching the value in the provider's regions (Control Tower); table-cell match is not measured.
- Foundry tools have no timeout or retry test.
- The deployment profiles are mapped, not restructured; no image-generation profile exists.
