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

| Status | Meaning |
| --- | --- |
| `verified-local` | Ran locally and passed with a real fixture. The entry carries the date, the command, the expected and the actual result. |
| `verified-azure` | Called Azure and stored a redacted result. No capability has this status: nothing was called. |
| `configured` | Adapter and configuration exist, but there was no live call. |
| `mock` | Uses a fixture or a stub response only. |
| `azure-not-run` | An Azure exercise exists but was not allowed to run. |
| `blocked` | Missing permission, resource, dependency or hardware. |
| `not-supported` | Deliberately not supported; the entry says why. |

The four numbers at the top count capabilities, not live services or model calls. Each capability is counted once, under its strongest evidence: Azure verified, then local verified, then blocked or unsupported locally, otherwise configured or mocked. The manifest validator (`manifestProblems`) refuses a status that claims evidence it does not carry, for example `verified-local` without a date and command, or `azure-not-run` with a test date.

OCR confidence, citation matches and hit@K are never called accuracy.

## Capabilities

| # | Capability | Local | Azure | Fixture | Last tested | In-app check |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Foundry tools / MCP | `verified-local` | `azure-not-run` | `precheck-sample.json` (+1) | 2026-11-14 | command only |
| 2 | Security | `verified-local` | `azure-not-run` | `manifest.json` | 2026-11-14 | command only |
| 3 | Computer Vision generation | `mock` | `not-supported` | `images.json` (+2) | 2026-11-14 | `image-request-contract` |
| 4 | AI Search | `verified-local` | `azure-not-run` | `dossier-pages.json` (+4) | 2026-11-14 | `search-pages` |
| 5 | Observability | `verified-local` | `azure-not-run` | `precheck-sample.json` (+2) | 2026-11-14 | `trace-steps` |
| 6 | Foundry Agents | `verified-local` | `azure-not-run` | `precheck-sample.json` (+1) | 2026-11-14 | command only |
| 7 | Speech | `mock` | `azure-not-run` | `site-note-invoice.wav` (+2) | 2026-11-14 | `speech-transcript` |
| 8 | RAG | `verified-local` | `azure-not-run` | `rag-pdf-sources.json` (+1) | 2026-11-13 | command only |
| 9 | Azure services selection | `verified-local` | not applicable | `AI103_CAPABILITY_LAB.md` (+1) | 2026-11-14 | `decision-matrix` |
| 10 | Content Understanding | `mock` | `azure-not-run` | `analyze-document.request.json` | 2026-11-14 | `cu-request-shape` |
| 11 | Deployment | `verified-local` | `azure-not-run` | `docker-compose.yml` (+2) | 2026-11-14 | command only |
| 12 | GenAI application | `verified-local` | `azure-not-run` | `precheck-sample.json` (+1) | 2026-11-13 | command only |
| 13 | Vision understanding | `verified-local` | `azure-not-run` | `images.json` (+3) | 2026-11-14 | `photo-metadata` |
| 14 | Language and PII | `verified-local` | `azure-not-run` | `emails.json` | 2026-11-14 | `pii-masking` |
| 15 | Translator | `mock` | `azure-not-run` | `contractor-email.json` (+1) | 2026-11-14 | `translator-preservation` |
| 16 | Document Intelligence | `verified-local` | `azure-not-run` | `ocr-misread.sample.json` (+3) | 2026-11-14 | `ocr-cross-check` |
| 17 | Vision and content safety | `verified-local` | `azure-not-run` | `baurechnung-rg-2026-0457-mit-anweisung.pdf` (+1) | 2026-11-14 | `injection-guard` |
| 18 | Evaluation | `verified-local` | `azure-not-run` | `precheck-sample.json` (+2) | 2026-11-14 | `evaluation-deterministic` |

Counts: 14 verified locally, 0 verified on Azure, 4 configured or mocked (Computer Vision generation, Speech, Content Understanding, Translator), 0 blocked or unsupported. A test (`lib/ai103/docs.test.ts`) keeps this table in line with the manifest.

"Verified locally" is scoped to what the entry's expected result says. Each entry lists what is not verified; the most important gaps are in [Limits](#limits).

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

Resources with the default stack idle (`docker stats --no-stream`, 14 November 2026): about 2.7 GiB in total, including Docling 1.31 GiB, the credit API 490 MiB, Keycloak 488 MiB, ClamAV 146 MiB, Qdrant 106 MiB and Ollama 40 MiB with no model loaded. Nothing was optimised in this pass, so the figure after the change is the same.

## Azure tests

Azure tests are off. The page shows no Azure button while nothing is configured and opted in. The web API answers 403 without `AI103_AZURE_OPT_IN=billable-calls-approved` and 501 with it, because no live adapter is wired into the web app; in both cases no request leaves the server and no resource is created. Live calls run only from the lab CLI behind `require_live` (`labs/ai103/contractor_lab/cloud.py`), after `python3 -m contractor_lab cloud-plan` has shown the services, region and cost plan. CI never calls Azure.

## Limits

- No capability is verified on Azure; every Azure side is `azure-not-run` or `not-supported`.
- Nova's claim-level amount check in the lab passes 2 of 3 criteria (one source label per segment).
- No single trace yet from upload through ClamAV, OCR, indexing, retrieval and Nova; the page shows step latency from a recorded pre-check run.
- Speech is tested in German only; the transcript is a fixture. English and Vietnamese audio are not tested.
- Translation is checked against a human reference only; German to Vietnamese and transliteration are not covered.
- The e-mail fixtures have no complaint or missing-documents category yet.
- Field, table-cell and bounding-box match are not measured.
- Foundry tools have no timeout or retry test.
- The deployment profiles are mapped, not restructured; no image-generation profile exists.
