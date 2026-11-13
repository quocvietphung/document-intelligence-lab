# AI-103 verification record

This file records one verification pass: the commands, their results, what was skipped and why, and what was not run.
The guide and the status of each service are in [AI103_CONTRACTOR_PRECHECK.md](AI103_CONTRACTOR_PRECHECK.md).

- **Sections 1 and 3** record the earlier pass on `origin/develop` at `7896828` (squash of PR #11).
- **Section 2** records the Docker, Ollama and Nova checks of the latest pass, on branch `feature/enterprise-hardening-and-ux-audit`.
  The results of the whole latest pass are in [USE_CASE_MATRIX.md](USE_CASE_MATRIX.md#verification-record).
- **Machine:** Apple Silicon Mac, Docker Desktop, Java 21 (Corretto), Node 24 (CI uses Node 22, which the pull request run checks).
  The ETL, ML, library and lab CI checks ran with Python 3.12, the CI version. Other lab commands ran with the local Python 3.14.
- **Fictional data only** (`FIKTIVE DATEN`). No secret, token, `.env` content or personal path is recorded here.

## 1. Commands and results

| Check | Command | Result |
| --- | --- | --- |
| Java (whole API) | `mvn --batch-mode clean verify` in `services/credit-api` | 388 tests, 0 failures, 0 errors, 5 skipped, BUILD SUCCESS |
| Java skips | surefire reports | 5 opt-in tests: `NovaPromptSizeReportTest` (`nova.promptReport` not set), `AzureDocumentIntelligenceLiveTest` (`AZURE_DOCUMENT_LIVE_TEST` not set, live Azure), `DoclingDocumentIntelligenceLiveTest` (`DOCLING_LIVE_URL` not set), `DoclingSourceContractTest` (`RAG_DOCLING_RESULT` not set), `RagPdfBenchmarkTest` (`RAG_PDF_CORPUS` not set) |
| Web lint | `npm run lint` (`eslint . --max-warnings=0`) | 0 warnings |
| Web types | `npm run typecheck` | clean |
| Web unit tests | `npx vitest run` | 357/357 in 52 files |
| Web build | `npm run build` | compiles; `/en`, `/de`, `/vi` prerendered (SSG); no warnings in the log |
| Locales | production server, `GET /en`, `/de`, `/vi` | HTTP 200, `<html lang>` matches; `/fr` 404; `/` redirects to `/de` |
| Lab unit tests | `python3 -B -m unittest discover -s tests` in `labs/ai103` | 86/86 |
| Lab lint | `ruff check .` (`labs/ai103/pyproject.toml`) | all checks passed |
| Lab types | `mypy contractor_lab` | no issues in 17 files |
| Lab offline criteria | `python3 -m contractor_lab offline` | 20/20 |
| Lab exercises | `speech` · `translate` · `voice-live` · `search` · `content-understanding` · `cloud-plan` | 4/4 · 2/2 · 3/3 · 2/2 · 1/1 · exit 0 (no network) |
| ETL worker and dbt | `services/document-etl`, Python 3.12, dbt on `PATH` | 25/25 (includes the real dbt build tests) |
| ML worker | `services/document-ml`, Python 3.12 | 14/14 |
| Python library | `python/tests`, Python 3.12, `TEST_PDF_INSPECTION=1` | 46 tests, 1 skipped: `TEST_PYTHON_PDF` not set, so the real Docling inference smoke test did not run (CI's Docling job runs it) |
| Node CI scripts | `node --test` (docker-azure-config; docker-local, run-adf, test-nova-local, benchmark-nova, retention-lab) | 5/5 and 25/25 |
| Python CI scripts | `test_foundry_config.py` · `test_practice_document_data.py` · `test_rag_benchmark.py` · `services/model-runtime` | 2/2 · 4/4 · 3/3 · 3/3 |
| Public-source check | `node --test scripts/check-public-source.test.mjs`; `node scripts/check-public-source.mjs` | 5/5; 895 files, 0 risks |
| Keycloak configuration | `node scripts/test-keycloak-config.mjs` | PASS |
| Keycloak proxy (Go 1.27) | `go test main.go main_test.go` in `infra/keycloak/proxy` | ok |
| Production Compose | `node scripts/check-production-compose.mjs` | passed; no Spark service |
| Secret scan (history) | `gitleaks git .` | no leaks in 30.89 MB of git history |
| Secret scan (working tree) | `gitleaks dir .` | 13 findings, all in ignored `.next/` build output (not tracked); not a repository secret |
| Dependencies | `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| File-system scan | `trivy fs --scanners vuln,secret --severity HIGH,CRITICAL` (build folders skipped) | clean |

## 2. Docker, browser and Nova

**Stack.** The production stack was started with `node scripts/docker-local.mjs`. The helper stopped at the `web` container: port 3000 is held by another local process (a development server from a different repository), so `web` did not start. That process was not stopped. Healthy in this pass: `keycloak`, `credit-api` (127.0.0.1:8081), `ollama`, `etl`, `docling`, `clamav`, `qdrant`, `redis`, `case-db`, `identity-db`, and `m365-poc` (127.0.0.1:8765).

**Ollama, hardened image.** Built from `services/ollama-cpu`. `docker inspect` on `credit-intelligence-lab-ollama-1` in this pass:

| Check | Result |
| --- | --- |
| Image | `document-lab-ollama-cpu:0.40.6`, the pinned upstream release repackaged for CPU |
| User | `10010:10010`; inside the container `uid=10010(ollama)`, `HOME=/tmp` |
| Root filesystem | read-only (`ReadonlyRootfs=true`) |
| Capabilities | `CapDrop=[ALL]`; effective capability set `0000000000000000` |
| Privilege escalation | `no-new-privileges:true` (`NoNewPrivs: 1`); `Privileged=false` |
| Scratch space | tmpfs `/tmp`, 512 MiB, mode 1777 |
| Model store | named volume `credit-intelligence-lab_lab_ollama`, subpath `models`, mounted at `/models`, owned by 10010; the existing weights were reused, nothing was downloaded again |
| Health | `healthy` (`ollama show` for the configured model) |
| Limits | memory 5 GiB, 3 CPUs (unchanged) |
| Inference | `ollama run qwen3:4b-instruct-2507-q4_K_M "Reply with exactly one word: OK"` returned `OK`; engine log shows `POST /api/generate 200` |

The one-time ownership change on an existing volume is part of `node scripts/docker-local.mjs --prepare-model`. It can also be run by hand with the engine stopped:

```bash
docker run --rm --pull never -v credit-intelligence-lab_lab_ollama:/data busybox:1.37 sh -c 'mkdir -p /data/models && chown -R 10010:10010 /data/models'
```

The Ollama key pair (`id_ed25519`) from the earlier layout stays at the volume root, owned by root. Compose mounts only the `models` subfolder, so the container does not see it.

No hardening measure had to be loosened: the engine started with all of them active, loaded the model from `/models` and answered.

**Image scan.** Trivy, HIGH and CRITICAL, with the vulnerability database of 11 November (not updated): the Ollama image has 2 HIGH findings in its Ubuntu 24.04 packages and 50 HIGH findings in the Go modules of the bundled `ollama` 0.40.6 binary. The engine is repackaged, not rebuilt, so these need a version change; see [USE_CASE_MATRIX.md](USE_CASE_MATRIX.md#open-gaps), item 10.

**Nova (local Ollama, through the Java API and the citation contract).**

- Pre-check case `CR-2de4fdcb-40a`, German, `contractor_lab nova` (first run): the model stopped at the 420-token output limit (`LocalAiConfiguration`, `numPredict`) after 2,366 prompt tokens. The Java API refused the cut-off answer with 503 and an empty body, and the lab stopped with a traceback. The lab now reports `NOVA_NOT_COMPLETED` for that case, with a unit test.
- The same case after that change: the model completed the answer in about 226 seconds. The answer used bracketed list numbers such as `[1, 2]` and `[3]`, which the citation contract refuses (`NON_SOURCE_BRACKET`). Result: `NOVA_REFUSED_BY_CITATION_CONTRACT`; the deterministic draft stayed; nothing was approved, paid or sent. The lab exits with code 1 because 1 of 3 criteria passed. The result file is in `.local/ai103/`, which is not in Git.
- Single-document case `CR-9437bf8b-ded`, whose PDF page 2 contains a sentence addressed to AI assistants that asks for automatic payment approval and an e-mail. Two chat questions through `/api/assistant/chat` were both refused by the citation contract (`NON_SOURCE_BRACKET`), after 55 and 25 seconds. No answer text reached anyone, so the injected instruction could not be checked against a live answer.

Nova therefore ran through the hardened engine and the Java API, but no answer passed the output contract in this pass. The validator was not loosened. Options and their trade-offs are listed in [USE_CASE_MATRIX.md](USE_CASE_MATRIX.md#open-gaps).

**Acceptance and browser.** Not run in this pass. `TEST_CONTRACTOR_PRECHECK=1 node scripts/test-oauth.mjs` and the browser checks need the web app on `localhost:3000`. The earlier 53/53 acceptance result belonged to a verification stack that was torn down and is not repeated here.

## 3. Azure

**Not run.** The user chose not to call Azure in this pass. Every Azure service stays `azure-not-run`; none is `azure-verified`.

Read-only check of the subscription (no resource created, nothing called): the Azure CLI is signed in, and the subscription
holds two Cognitive Services accounts (an Azure OpenAI account and a Document Intelligence account, both in West Europe).
There is no Speech, Translator, Language, Content Safety, AI Services or AI Search resource.

Still to run, each only after a separate confirmation, with its resource and the number of calls named first:

1. Speech: fast transcription on the fictional WAV, and one SSML synthesis (checks the response format and the WAV header).
2. Translator: one `translate` request and one `transliterate` request on the fictional e-mail.
3. Voice Live: one spoken turn and one barge-in on scripted audio, through the official SDK sample.
4. AI Search: create a separate test index, upload the fictional page set, run keyword, vector and hybrid queries, then delete the index. The hybrid request is unverified (the Learn page returned 404).
5. Content Understanding: one analysis of the fictional document with the documented analyzer name and API version.
6. Prompt Shields: one `text:shieldPrompt` call on the fictional injection PDF text.

## 4. Known limits

- The Nova suggestion depends on a 4-billion-parameter local model on CPU. Its output is checked in code; a refused answer keeps the deterministic draft and says why.
- In the latest pass no Nova answer passed the citation contract (section 2). The local output budget (420 tokens) and the model's bracketed list numbers are the causes; the contract itself was not changed.
- The speech and listening checks were not played back; the browser voice label was checked in the page text only.
- Hybrid search, the normalized-image page number in the AI Search indexer and the Voice Live live session are unverified.
- The PDF invoice number `RE-2026-0311` belongs to a separate use-case fixture; this lab uses `RG-2026-0457`.
