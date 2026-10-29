# Source-bound research workspaces

Use the current document evidence to build reproducible references and comparisons. No experiment automatically deploys cloud infrastructure. For a clean clone, start with [Docker local setup](DOCKER_LOCAL.md).

## Start from an original

1. Sign in at `http://localhost:3000/en` (or `/de`, `/vi`). Local credentials: `advisor.demo` / `demo-password`.
2. Choose a domain and dossier. Open **Documents & review**; preview and explicitly analyze an approved fictional PDF. Private official DATEV samples remain in the banking domain and are never put into Git/public assets.
3. Open **AI Experiments**. Select the original document/page and open its PDF. Read the expected values yourself; do not copy model predictions and call them ground truth.
4. Add fields using their extraction key (e.g. `netIncome`, `payoutAmount`, `premium`, `invoiceTotal`). Missing field keys are permitted. Add retrieval questions with all independently checked relevant pages. Mark a question unanswerable when no source supplies the requested value, and keep related questions in one tuning/held-out group.
5. Name the reference version, acknowledge the independent source check and save. This creates an immutable `document-reference` record in `lab_records`, scoped to the verified tenant and dossier.
6. Explicitly run extraction or retrieval. The API immediately returns a queued job (HTTP 202); the results tab polls its durable status and shows timestamps, source version, labelled sample count, method, metrics and failed examples with source links. No new Azure call is made by these experiments. Cold ONNX startup does not hold the browser request open.

## What is measured

- Extraction compares saved fields against human labels. Correct predictions count TP; missing references count FN; wrong/ambiguous predictions count FP and FN. Unlabelled fields are not evaluated. No claim of global OCR accuracy or fully independent ground truth validation is made.
- Exact matching ignores Unicode width, case and repeated whitespace. Amount formatting, sign and currency are preserved. Different locale representations can therefore count as a mismatch; the results let you inspect them.
- Retrieval compares term-frequency BM25, vector cosine, current Hybrid, RRF and the preserved legacy Hybrid baseline over original page/field/table chunks, without policy/summary fixtures. Hit rate@5 is the share of answerable questions with at least one labelled page in the first five chunks. MRR@5 uses the first relevant rank. Multi-source Recall@5 measures unique relevant document/pages found; unique-source Precision@5 divides unique relevant pages by returned chunk slots. nDCG@5 gives each relevant page credit once, so duplicate chunks do not inflate it. These are explicitly page-label metrics, not exact-occurrence or answer factuality scores.
- Runs use local isolated ranking and the configured embedding implementation. They do not overwrite Qdrant's live case index or claim to benchmark the Qdrant service. The ranking comparison uses no LLM judge. RRF is rank fusion, not a learned reranker. The optional learned reranker is not enabled by this reference pack.
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
mvn -f services/credit-api/pom.xml verify
TEST_SHOWCASE=1 node scripts/test-oauth.mjs
```

The no-Azure showcase acceptance creates labelled fictional records and checks the complete local workflow. For an existing independently approved DATEV original, `TEST_RESEARCH=1 node scripts/test-oauth.mjs` additionally checks source-bound datasets, durable jobs, private exports and fresh PostgreSQL reads. It does not make new Azure calls or replace the live Qdrant index.

UI language follows the selected English/German/Vietnamese locale. Original document text, extraction keys, user-entered labels/questions and technical model/method identifiers are preserved instead of silently translated.

## Reproducible multi-domain PDF RAG benchmark

The [source registry](../lib/rag-pdf-sources.json) pins nine private prepared PDFs: CMS completed coverage summary, IRS blank W-2/instructions, two fictional DATEV payroll pages, two synthetic Kaggle invoices, Principal definitions and Shelter conditions. Original publisher pages are mapped separately from excerpt pages. Public links do not imply that third-party PDFs may be redistributed; originals/excerpts remain outside Git. CMS/IRS forms are historical/reference material, not advice or a filing. Excerpts can lose native PDF tags and are not accessibility-certified originals.

The [authored question pack](../lib/rag-pdf-questions.json) has 77 questions: 69 answerable and eight unanswerable, across English, German and Vietnamese. Multiple relevant pages, same-template documents, identifiers and absent values are included. Four original PDFs belong to tuning and three to the held-out group. Both CMS excerpts, both DATEV excerpts and translations stay with their original PDF; the source hash contract prevents splitting them across groups. The two invoice originals still share a template. Labels were prepared from PDF text and rendered pages by the development agent, not independently human-approved ground truth. The small corpus and shared templates do not establish general business accuracy. No expected answer or relevance label is sent to the embedding model or retriever.

Prepare the existing [DATEV](PUBLIC_PAYROLL_TESTS.md) and [Kaggle](../README.md#pdf-examples) references first, using `pypdf==6.10.0`. Then explicitly fetch only the two additional reviewed official PDFs:

```bash
python scripts/prepare-rag-benchmark.py --download
```

Subsequent runs omit `--download`. Changed source hashes, incorrect prepared excerpts, missing quote anchors and crossed groups stop preparation. No PDF is silently replaced. The registry also records CFPB sample links that returned HTTP 403 to this client; they are not downloaded or counted as measured. DocLayNet is listed for later review, not downloaded as a multi-GB dependency.

With the full local Docker profile running, use the existing authenticated test helper:

```bash
TEST_RAG_PDFS=prepare node scripts/test-oauth.mjs
TEST_RAG_PDFS=measure node scripts/test-oauth.mjs
```

Preparation creates a separate research dossier, uploads the pinned PDFs through the existing ClamAV/Docling queue and checks that all originals were saved. It never disables scanning or uploads to Azure. Measurement verifies each authorized stored original's SHA-256, saves source-bound labels and queues the actual Java ranking experiments. Results persist in PostgreSQL and appear in **Research lab → Experiments**. The helper prints the case-specific preview link. Private row-level results are in `.local/rag-benchmark/docling-results.json`.

Unanswerable references are retained separately and excluded from positive retrieval metrics. Candidate passages for them do not establish an answer or a correct model refusal; that needs a separate generation/answerability test. Empty denominators remain unmeasured. Ranking p50/p95 includes local embedding/ranking and warm caches; it does not measure Qdrant service latency or end-to-end Nova generation. Keep cold-start and concurrent-load measurements separate.

For a faster parser-isolated comparison, preparation also writes native `pypdf` text from the same original bytes. An explicit Java test measures local MiniLM/BM25 ranking without Docker, Docling, Qdrant or an LLM:

```bash
RAG_REPOSITORY_ROOT="$PWD" RAG_PDF_CORPUS="$PWD/.local/rag-benchmark/native-corpus.json" \
  mvn -f services/credit-api/pom.xml -Dtest=RagPdfBenchmarkTest test
```

The private result is `native-results.json`. Do not combine native and Docling scores as if they used the same extracted corpus. The five strategy configurations are fixed comparisons; inspect tuning failures before making changes, freeze those changes, then check held-out results. This development corpus is not an external blind benchmark. Preserve the legacy baseline, report regressions and refuse to label retrieval hit rate as overall RAG accuracy.

The [published aggregate report](benchmarks/rag-pdf-retrieval.json) contains both extraction paths and all five methods. On the actual Docling corpus, current Hybrid scored 100% Hit@5, 99.28% multi-source Recall@5 and 93.53% MRR@5; the preserved previous Hybrid scored 95.65%, 94.93% and 87.44%. On the separate native-text corpus, BM25 had higher MRR than current Hybrid (94.93% versus 93.96%); RRF was not consistently better. The 24 answerable held-out questions are a small development check, not independent external validation.

Intake uncovered two parser edge cases. Shelter text crossing pages is split only with exact, non-overlapping Unicode character spans; omitted source characters are rejected. CMS's four-page excerpt exceeded the existing conversion deadline, so its original pages are preserved as two two-page excerpts. One CMS table has overlapping predicted cells: its text and source boxes are retained, but the ambiguous table is excluded from structured table/field use and `TABLE_STRUCTURE_OVERLAP` is shown in the evidence viewer. Other valid tables remain available. Failed historical attempts are retained; successful retry is not retroactive proof that the earlier attempt succeeded.
