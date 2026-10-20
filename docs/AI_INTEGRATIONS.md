# Optional AI integrations

The default remains local Docker, with the existing Docling or PDFBox/Tesseract document provider and MiniLM retrieval. These additions are **opt-in adapters**. Configuration/contract tests do not establish model quality or a working Azure connection. No model weights are bundled, automatically downloaded or silently replaced by a cloud model.

## What is implemented, and what is not verified

| Addition | Implemented boundary | Still requires explicit live verification |
| --- | --- | --- |
| Blob intake | Authorized dossier prefix, first-page listing, explicit consent, ETag-conditioned download into the existing scanned queue | Storage account, RBAC, network and actual source import |
| Data Factory | Private scoped request export and operator CLI for an **existing** pipeline | Pipeline activities, credentials, connectivity, Azure run status and downstream completion |
| Foundry evaluation | Private saved-answer export and Azure AI Evaluation SDK operator bridge | Judge access, model compatibility, relevance/groundedness behavior and human reference answers |
| Application Insights | Optional traces-only collector with attribute allowlisting | Azure destination, retention, privacy review and actual delivery |
| Nova local | LangChain4j Ollama ChatModel, supplied authorized context, explicit local identity and no fallback | Installed model, language quality, latency and source behavior; autonomous tools are not enabled locally |
| PaddleOCR | Bounded page/table contract and Java document-provider adapter | CPU image build, cached PP-StructureV3 models, language configuration and extraction quality |
| BGE-M3 | 1,024-dimensional embedding adapter and separate Qdrant collection | Prepared weights, multilingual retrieval benchmark and memory/latency |
| BGE reranker | Learned reranking of at most 24 hybrid candidates | Prepared weights and measured relevance versus latency |
| Vision | One original page to an explicit local Ollama vision model | Installed vision model, image support and numeric correctness; observations remain unverified |

UI locations: **Data Pipelines → Assets** for Sources & orchestration, **Research lab → Experiments** for evaluation and optional local vision, **Operations** for monitoring configuration. Opening a page reads local configuration only. Refreshing configuration does not run a model or contact Azure.

### Current local-model acceptance result — 20 October 2026

With `qwen3:4b-instruct-2507-q4_K_M`, authenticated local generation returned a final answer with the original invoice date and exact, available source-page citations. However, chronology also returned undated VAT and gross-total facts, failing the task-focus assertion. The acceptance script exited nonzero and was not weakened to accept this output. Remaining clause/privacy and language checks were not completed on this checkpoint. Successful application builds, unit tests and container health do not resolve this model-quality limitation. Treat these workflows as unapproved research drafts; this update is source publication only, not cloud deployment or production acceptance.

## PDF exercises for each AI service

Overview's **16 AI-assisted workflows** and Nova's **10 controlled task prompts** all include a collapsible PDF example. Optional provider cards also carry examples. These are reproducible exercise instructions, **not assertions that every provider is installed, connected or accurate**. Prepare the private DATEV/Kaggle references using the README; keep PDFs out of Git. Import only after selecting the matching dossier domain and confirming processing. Never treat reference-library metadata as an analyzed original.

| Service | PDF exercise | What to inspect independently |
| --- | --- | --- |
| Docling CPU | `kaggle-invoice-51109301.pdf` | Original invoice number, INR currency, item table and Total × Gross Worth; keep unknown confidence unknown. |
| Azure Document Intelligence | The same one-page invoice | Compare layout/cells and source pages against Docling; explicit cloud inference can cost money. |
| PaddleOCR / PP-StructureV3 | The same invoice; a permitted scan for a second run | Text, table cells and page coordinates; weights/CPU image still require separate verification. |
| MiniLM + Qdrant + BM25 | `kaggle-shelter-renters-conditions-p11-12.pdf` | Ask about the stated policy coverage period; open the returned source page. Relevance is not coverage advice. |
| BGE-M3 | The same insurance excerpt; ask the same question in EN/DE/VI | Compare hit rate/MRR using human-checked target pages and the separate 1,024d collection; no claim that multilingual search is automatically better. |
| BGE reranker | The same excerpt and candidate passages | Compare top passages before/after ranking; record latency and unsupported/irrelevant hits. |
| Nova via Ollama | Synthetic invoice 51109301 | Ask for invoice number, currency and gross total with page citations; preserve INR, distinguish extraction from human approval. |
| Nova via Azure OpenAI | `datev-lodas-2025-robert-muster.pdf` | Distinguish Netto-Verdienst from Auszahlungsbetrag using that person's actual PDF; do not infer deductions or creditworthiness. |
| Local vision / separately prepared Qwen-VL | One original invoice page | Ask which total label is visible; compare image, amount and currency. Vision is an unverified observation, not replacement OCR. |
| Foundry / Azure AI Evaluation SDK | Saved Nova answer on invoice 51109301 | Export the saved question/answer/page excerpts privately; add independent human ground truth before completeness scoring. No full PDF is sent by this export. |

The new **chronology**, **clause/obligation review** and **sensitive-data review** are app-owned prompts for the selected LLM, not three additional model deployments. They retain backend Bearer/tenant/dossier authorization, source citations, feature controls and unapproved answer history. Chronology does not calculate legal deadlines; clause review is not legal advice; privacy review reports identifier categories for manual inspection without copying sensitive values or modifying/redacting the PDF. They can miss information.

Local Nova uses supplied authorized context without agent tools; the separately configured Azure agent retains its scoped read-only tools. The three review tasks inspect original page text (at most three pages, 2,000 characters per page), not narrow semantic hits or header-field summaries. This is bounded excerpt review, not a complete document/privacy audit; earlier incorrect drafts remain unapproved history.

Blob, ADF and Application Insights are **infrastructure, not extra AI models**. For their PDF exercise, import the same synthetic invoice through the explicit source queue, inspect the source hash/receipt, and inspect metadata-only monitoring. Azure runs remain separately authorized and not automatically verified by a local success.

## Lightweight verification — no paid requests or model downloads

From the repository root:

```bash
npm run verify
(cd services/credit-api && mvn test)
node --test scripts/run-adf.test.mjs
python3 -B scripts/test_foundry_config.py
(cd services/model-runtime && python3 -B -m unittest test_server)
```

The model adapter tests use synthetic HTTP responses and fictional data. The Paddle tests exercise normalized page/table contracts, not real Paddle inference. The PDF vision test renders a generated page without loading a vision model. Existing Docling model checks remain documented separately in [Local document AI](LOCAL_DOCUMENT_AI.md).

With the baseline Docling stack running and at least one existing local dossier, the read-only acceptance test below signs in via Keycloak/PKCE and checks both the web proxy and Java API. It verifies that all nine additions remain disabled and require authentication; it does not import files or run inference. The public fixture login defaults to `advisor.demo` / `demo-password`; use private `TEST_USERNAME` / `TEST_PASSWORD` environment overrides if your retained local identity database differs.

```bash
TEST_INTEGRATIONS=1 node scripts/test-oauth.mjs
```

## Nova using a local model

The supplied local walkthrough uses **Qwen3 4B Instruct 2507 Q4** (`qwen3:4b-instruct-2507-q4_K_M`) with LangChain4j and a CPU-only Ollama image. This is the explicit [non-thinking checkpoint](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507), not the generic reasoning alias. Complex reasoning and interpretation still require independent review. Check model licenses before redistribution. Model identifiers containing URL schemes or cloud suffixes are rejected; `OLLAMA_NO_CLOUD=1` disables Ollama cloud use in the supplied container. No API token is forwarded to Ollama.

Explicit first preparation (downloads the model once; no Azure requests):

```bash
node scripts/docker-local.mjs --prepare-model
```

Later starts reuse the installed weights and retained databases:

```bash
node scripts/docker-local.mjs
```

The helper builds `services/ollama-cpu/Dockerfile` from a digest-pinned official release, preserving the engine/root runtime notices while omitting GPU backend directories. First build still downloads the upstream GPU-containing input; subsequent model preparation reuses an existing CPU image. The measured ARM64 runtime is 181 MB, versus 4.24 GB upstream; this is image size, not a universal download or total-stack estimate. The separately stored ~2.5-GB model is another disk consumer; build cache/source images can remain until explicitly cleaned. Previously prepared models are not automatically removed. No automatic prune is performed. The helper requires at least 8 GiB free inside Docker before preparation and 1 GiB on subsequent starts.

Once app services are healthy, startup preloads the explicit model with an empty prompt on the internal network, using a five-minute timeout and a 30-minute keep-alive. No document or question is sent, and warmup does not prove answer quality. On low available RAM, close other heavy apps and wait for the helper to finish; repeated request retries do not fix memory pressure. The 0.6B and 1.7B trials were not retained as defaults after observed identifier, clause-review or privacy-category errors.

The CPU profile disables multi-prompt RAM snapshots (`LLAMA_ARG_CACHE_RAM=0`), while retaining the active 4,096-token context slot. Local generation is bounded to 420 tokens; the three new review tasks use at most three concise bullets. Other tasks retain their requested format, such as an editable email draft. Startup releases model RAM before rebuilding app images, then reloads the model after the stack is healthy. These are latency/memory safeguards, not accuracy guarantees.

Local replies must finish with the provider's normal `STOP` reason. Length-limited or otherwise incomplete output is rejected instead of displayed/stored as a successful answer. A reasoning-only trial produced analysis narration and hit the output cap; passing loose word/citation checks was not sufficient, and that checkpoint was rejected for interactive Nova.

The engine uses three CPU threads, matching its three-CPU container quota. Nova keeps the original citation IDs; experiments with short aliases were not retained because the small model confused them with business identifiers. The backend never invents missing citations or repairs unknown IDs by guessing. Source existence is still not proof that a statement is correct.

Preparation uses a newly created temporary daemon without a public port and stops only that container on completion, retaining `credit-intelligence-lab_lab_ollama`. Normal startup never downloads missing model weights; it fails with preparation instructions. The internal runtime network cannot fetch models. Record the installed model digest in private experiment notes. To select another reviewed local model, pass its exact ID explicitly:

```bash
OLLAMA_CHAT_MODEL='your-reviewed-local-model' node scripts/docker-local.mjs --prepare-model
```

The helper combines base + platform + Docling + local Nova, in that order. For manual Compose commands, set `OLLAMA_CHAT_MODEL` explicitly; the profile rejects a missing value. Do not combine the Azure token helper with the local Nova profile. Local Nova clears Azure chat configuration and does not fall back to Azure if Ollama fails. The optional real-model check is `TEST_NOVA_LOCAL=1 node scripts/test-oauth.mjs`; it requires the prepared synthetic invoice library, creates labelled local records and leaves evidence for inspection.

Sign in through Keycloak, open Nova → Evidence analysis and ask about an authorized original document. The identity should say **Ollama · Local LLM**, not Azure OpenAI. Check each source and amount independently. Daemon health (`ollama list`) does not prove the selected model is installed or can answer. Local calls have a 180-second timeout and read only supplied context without agent tool loops. The local web request allows 380 seconds (Azure remains 45 seconds). CPU requests can take minutes, especially with long source IDs and multiple citations. Failures remain visible with no model fallback. Responses are delivered after generation, not token-by-token streaming; stopping the browser request is not a guarantee of cancelling every backend inference.

For optional page vision, prepare a local vision-capable model separately and set `OLLAMA_VISION_MODEL` to its exact installed name before recreating the API. Qwen3-VL is one candidate, **not a preinstalled or quality-certified dependency**. The API sends only the chosen original page after consent; it never treats a vision response as verified OCR or authorizes tools from it.

## BGE / reranker / PaddleOCR

The `docker-compose.models.yml` profile builds an optional CPU service. **Its image build itself can download large Python/framework packages**, even with no weights. Do not build it for the lightweight checks.

Before a real run, separately prepare reviewed model snapshots, retaining model revisions and licenses:

```text
.local/models/bge-m3/                  # full local snapshot, including config/tokenizer/weights
.local/models/bge-reranker-v2-m3/      # full independent snapshot
.local/paddle-cache/                  # reviewed PaddleX / PP-StructureV3 cache
```

The model service has no host port, no network egress, offline Hugging Face settings and read-only model mounts. Health reports service readiness and whether any model has been loaded; it is not a quality test. Missing weights fail explicitly. On a 16-GB Mac, start **one optional experiment at a time**: Docling, Ollama and multiple large CPU models together can exhaust Docker memory. BGE and reranker weights can remain resident together; the 5-GB limit is a safety cap, not a guarantee they fit.

For BGE, set `EMBEDDING_PROVIDER=bge-m3`; for learned reranking, set `LEARNED_RERANKER_ENABLED=true`. Then add `-f docker-compose.models.yml` after base + platform and validate with `config --quiet`. The BGE collection is `document_lab_bge_m3_v1`, **not** the existing 384-dimensional `credit_lab_v1`. Do not reuse that version for different model weights; change/version the collection before switching snapshots. Reindexing happens on authorized retrieval, not at startup. Benchmark against human-checked questions before claiming an improvement.

For Paddle, set `PADDLE_ENABLED=true` at build/run time and `DOCUMENT_ANALYSIS_MODE=paddleocr`. Use the models profile **instead of** the Docling profile for this experiment. PP-StructureV3 language/model settings must be verified for your documents; default availability is not evidence of German DATEV quality. The adapter accepts at most 4 pages / 3 MB and preserves unknown confidence. Java field rules are not a trained classifier. Its Python dependency stack and architecture compatibility still require a real image-build test.

References: [BGE-M3](https://huggingface.co/BAAI/bge-m3), [BGE reranker](https://huggingface.co/BAAI/bge-reranker-v2-m3), [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR), [Ollama integration](https://docs.langchain4j.dev/integrations/language-models/ollama/).

## Explicit private Blob intake

Use an existing private Azure Blob account; no storage resource or role is created here. Configure your own values through the shell or a private environment file:

```text
AZURE_BLOB_INGEST_ENDPOINT=https://YOURACCOUNT.blob.core.windows.net
AZURE_BLOB_INGEST_CONTAINER=document-intake
```

Add `-f docker-compose.integrations.yml` to the existing local stack. The local Docker profile reads `.local/azure-auth/storage-token.json` read-only. It must be a separate, short-lived **Storage audience** token with this private structure:

```json
{"resource":"https://storage.azure.com/","accessToken":"SHORT_LIVED_TOKEN","expiresOn":"ISO_8601_WITH_OFFSET"}
```

Have an authorized operator obtain/renew that token via Azure CLI or an approved credential process; do not paste real tokens into Git, screenshots, issues or chat. The existing cognitive-services token helper does **not** renew this separate storage token. For a native Java process with no token file, the adapter uses DefaultAzureCredential. Grant only the required Blob read permissions scoped to your container; app roles are not Azure roles.

The source prefix is `SHA-256(tenant + "|" + caseId) + "/"`. The UI's scoped ADF request export includes this prefix after an explicit successful source scan. Upload only permitted PDF/PNG/JPEG files beneath that prefix; nested paths and traversal are rejected. Listing examines only the first 20 source entries, not every Blob in the account. Import uses the selected ETag, current dossier version and explicit processing consent, then enters the existing durable queue and ClamAV scan. It is **manual pull ingestion**, not an Event Grid listener, continuous sync or exactly-once delivery system.

## Data Factory operator bridge

Download a scoped request from Sources and keep it under `.local/`. Configure an existing factory resource ID and pipeline name:

```bash
export AZURE_ADF_RESOURCE_ID='/subscriptions/YOUR-SUBSCRIPTION-UUID/resourceGroups/YOUR-GROUP/providers/Microsoft.DataFactory/factories/YOUR-FACTORY'
export AZURE_ADF_PIPELINE='YOUR_PIPELINE'
node scripts/run-adf.mjs .local/adf-request.json
```

The default only validates. After separately reviewing Azure permissions, costs and remote connectivity, the explicit billable/cloud action is:

```bash
node scripts/run-adf.mjs .local/adf-request.json --execute-cloud --ack-remote-connectivity
```

Your existing pipeline must accept `labRequestId`, `labCaseId` and `labSourcePrefix`, and must implement its own authorized activities/idempotency. The helper records the returned Azure run ID privately, not a completed ingestion result. **Azure cannot call Mac localhost directly.** No tunnel, public API, self-hosted integration runtime or cloud callback is provisioned. Status remains in Azure / the private CLI receipt; it is not silently imported into the batch dashboard. Inspect uncertain submissions before retrying.

## Foundry / Azure AI Evaluation SDK

From Research lab → Experiments, load saved answers containing original-document sources and explicitly download private evaluation input. It contains question, answer and cited excerpts, **not PDF bytes**. A saved answer may predate the current dossier revision; this is a historical answer snapshot, not re-extraction of the current document. Ground truth is blank until a human independently supplies it.

Validation without SDK installation or inference:

```bash
python3 -B scripts/evaluate-foundry.py .local/evaluation.json
```

Only when explicitly approved for a real judge test, install `azure-ai-evaluation==1.18.8` and `azure-identity` in a private virtual environment, sign in with Azure CLI and configure an authorized Azure OpenAI judge deployment:

```text
AZURE_EVALUATION_ENDPOINT=https://YOURRESOURCE.openai.azure.com
AZURE_EVALUATION_DEPLOYMENT=YOUR_JUDGE_DEPLOYMENT
```

```bash
python3 scripts/evaluate-foundry.py .local/evaluation.json \
  --execute-cloud --output .local/evaluations/new-result.json
```

This sends private question/answer/context to the selected Azure judge and can incur inference charges. Results are written to a new private file; existing output is not silently overwritten. It evaluates groundedness/relevance and, only with nonblank human ground truth, completeness. It does **not** upload to a Foundry project, create Azure resources or prove factual correctness. SDK and judge compatibility require live verification. [Azure evaluation concepts](https://learn.microsoft.com/en-us/azure/foundry/concepts/evaluation-overview).

## Application Insights

Only add `-f docker-compose.monitoring.yml` when you explicitly want cloud traces and have set your own `APPLICATIONINSIGHTS_CONNECTION_STRING`. Do not combine it with another collector override. Trace ingestion/retention can be billable.

The collector exports traces only: no log/metric pipeline; span events and spans with links are dropped; names are generic; resource/scope attributes are stripped; only request method, status and provider attributes remain. Prompt text, PDF text, URLs, tokens and dossier/user IDs are not intentionally included. This policy has an offline configuration check, **not** a live privacy/delivery certification. Review actual exported data and Azure retention before enabling it. Traces record timing and errors; they do not measure model accuracy or total billing.

## Citation and prompt-injection limits

Nova now flags currency/amount pairs absent from the **cited source excerpts**, in addition to unknown/missing citation IDs. It normalizes supported numeric formats but cannot establish that an amount belongs to the correct person, period or concept. Truncated excerpts can cause conservative warnings; absence of a warning is not semantic verification.

Document instructions remain untrusted. Unicode-normalized pattern checks, scoped read-only tools, backend authorization and adversarial tests add layers, not immunity. Human review remains required for consequential interpretations. Do not advertise these tests as proof that all hallucinations or prompt injections are prevented.
