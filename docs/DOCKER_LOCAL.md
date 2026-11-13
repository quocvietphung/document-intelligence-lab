# Docker local setup

Run commands from the repository root. The base + platform profile needs no Azure account, Node.js, Java or Maven installed on the host; builds run in containers.

## Prerequisites

Use Docker Desktop (Linux containers) or Docker Engine + Compose v2. Suggested allocation: 4 CPUs, 8 GB memory, 15 GB disk. Initial builds and ClamAV signatures need internet. ClamAV uses its official `linux/amd64` image, emulated on Apple Silicon.

The optional offline ETL/inspection worker uses a digest-pinned Wolfi base, Python 3.12 and signed APK packages for Tesseract's English/German data. Its Python requirements pin the patched dbt/sqlparse combination. Building needs the public `cgr.dev` registry and APK repository; processing has no network access and runs as UID 1000. Installer/bootstrap tools are removed from the runtime: change requirements and rebuild to update dependencies. Container scans remain enabled, including this worker. Local AI images, weights and build cache need additional disk space beyond the base profile.

Keep ports 3000/8080/8081 free. Do not run host Next.js/Java on the same ports. Use **localhost** in the browser because the development issuer and redirects intentionally use that hostname.

```bash
docker version
docker compose version
git clone https://github.com/quocvietphung/document-intelligence-lab.git
cd document-intelligence-lab
mkdir -p .local/reference-pdfs
docker compose -f docker-compose.yml -f docker-compose.platform.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.platform.yml \
  up --build -d --wait --wait-timeout 900
```

### Optional Microsoft 365 evidence PoC

The read-only M365 document-evidence service is part of the full stack started by `node scripts/docker-local.mjs`
(see [Production stack and the Spark experiment](#production-stack-and-the-spark-experiment)). With the smaller
base + platform profile above it can be added on its own. It does not enable Microsoft Graph or Azure: its default
is a fictional local dataset with deterministic answers, and live providers remain explicit opt-ins.

```bash
docker compose -f docker-compose.yml -f docker-compose.platform.yml \
  -f docker-compose.m365.yml up -d --build --no-deps m365-poc
curl --fail http://127.0.0.1:8765/health
docker compose -f docker-compose.yml -f docker-compose.platform.yml \
  -f docker-compose.m365.yml ps m365-poc
```

The service appears as `credit-intelligence-lab-m365-poc-1`, binds only to `127.0.0.1:8765`, runs as a
non-root user with a read-only filesystem and has no database or persistent volume. Stop only this optional
service with:

```bash
docker compose -f docker-compose.yml -f docker-compose.platform.yml \
  -f docker-compose.m365.yml stop m365-poc
docker compose -f docker-compose.yml -f docker-compose.platform.yml \
  -f docker-compose.m365.yml rm -f m365-poc
```

See [`services/m365-mcp-poc/README.md`](../services/m365-mcp-poc/README.md) for the API, MCP tools, Entra
boundary and the explicit Graph/Azure configuration.

There is **no required `.env` file** for this profile. Copying `.env.example` alone does not configure the Java container: Compose supplies its environment. The smaller base file alone is for limited OAuth checks, not the complete research platform.

## Optional layers ("profiles")

| Layer | How to enable | Credentials |
| --- | --- | --- |
| default (core local stack) | `node scripts/docker-local.mjs` | none |
| google-connectors (Gmail, Google Drive, Gmail drafts) | `--with-google-connectors` adds `docker-compose.google.yml`, which reads the git-ignored `.env.google.local` | your own Google OAuth client; see [Connectors](CONNECTORS.md) |
| local-ai (Nova/Ollama) | part of the default stack (`docker-compose.nova-local.yml`); `--prepare-model` downloads the model once | none |
| observability (traces) | `docker-compose.observability.yml`, see below | none |
| analytics (ML worker, MLflow) | `--with-analytics` | none |

The Integrations page (**Sources & integrations**) shows each adapter's label. Without the Google layer, Gmail and Drive are listed as not configured, and the simulated Microsoft 365 adapter reads fictional documents from the M365 service over the private Compose network.

**Local model engine (Ollama).** The `ollama` service runs as the fixed user `10010:10010` (set in its image and in Compose).
Its root filesystem is read-only, its only writable scratch space is a `tmpfs` at `/tmp` (also its `HOME`), it has no Linux
capabilities (`cap_drop: ALL`), and `no-new-privileges` is set. The model store is `/models`, which Compose mounts from the
`models` folder of the persistent volume `credit-intelligence-lab_lab_ollama`, so the existing weights are reused in place.
Volumes created before this change had root-owned files; `--prepare-model` changes ownership of that folder once, and the
same step can be run by hand while the engine is stopped:

```bash
docker run --rm --pull never -v credit-intelligence-lab_lab_ollama:/data busybox:1.37 sh -c 'mkdir -p /data/models && chown -R 10010:10010 /data/models'
```

## Production stack and the Spark experiment

The supported stack is defined once in [`scripts/compose-files.mjs`](../scripts/compose-files.mjs) and started by
`node scripts/docker-local.mjs`: Java API, Next.js, Keycloak, PostgreSQL (cases and identity), Redis, Qdrant,
ClamAV, Docling, local Nova (Ollama), the offline Python ETL with **DuckDB Bronze → Silver → Gold** and the M365
evidence service. `--with-analytics` adds the optional ML worker and MLflow overlay. **DuckDB is the supported
analytics engine.** Spark is never built or started by this command, by the Azure VM files or by the production
image gate.

Prove what Docker Compose actually renders (every profile enabled, with and without analytics):

```bash
node scripts/check-production-compose.mjs
```

Health checks while the stack runs:

```bash
PROD="-f docker-compose.yml -f docker-compose.platform.yml -f docker-compose.docling.yml \
  -f docker-compose.nova-local.yml -f docker-compose.etl.yml -f docker-compose.local-resources.yml \
  -f docker-compose.m365.yml"
OLLAMA_CHAT_MODEL=qwen3:4b-instruct-2507-q4_K_M docker compose $PROD ps
curl --fail http://localhost:8081/actuator/health
curl --fail http://127.0.0.1:8765/health
```

Safe shutdown keeps every named volume (documents, databases, models, ETL history):

```bash
OLLAMA_CHAT_MODEL=qwen3:4b-instruct-2507-q4_K_M docker compose $PROD stop
# or remove containers and networks only, still keeping volumes:
OLLAMA_CHAT_MODEL=qwen3:4b-instruct-2507-q4_K_M docker compose $PROD down
```

| Mode | What leaves the machine |
| --- | --- |
| Local (default) | No document, question or answer. Internet is used for image builds, ClamAV signature updates and the explicit `--prepare-model` download only. The ETL worker runs with `network_mode: none`; the M365 service uses fictional mock data. |
| Azure (opt-in) | A PDF you confirm for analysis is sent to your Azure Document Intelligence resource; Nova sends the question and selected evidence to your Azure OpenAI deployment. The M365 service contacts Azure only with its own explicit live settings. |

**Spark is an experiment, not a deployment target.** It stays in `docker-compose.spark.yml` behind the `spark`
profile and runs only when you ask for it, as a one-shot batch over an existing ETL export:

```bash
node scripts/run-document-spark.mjs --snapshot '<scope>/<etl-run-id>'
```

The Spark image is excluded from production because Trivy reports unresolved HIGH/CRITICAL vulnerabilities in
Java libraries bundled inside the pinned PySpark wheel. Its tests and its real, unsuppressed scan run in the
separate *Spark research experiment (non-production, not deployed)* workflow. Do not add Spark to Azure deployment
files.

## Expected state and login

```text
case-db, identity-db, keycloak, credit-api, redis, clamav: running / healthy
qdrant, web: running (no Compose healthcheck)
storage-init: exited with code 0 (permissions task completed)
```

```bash
docker compose -f docker-compose.yml -f docker-compose.platform.yml ps --all
curl --fail http://localhost:8081/actuator/health
```

Open `http://localhost:3000/en` for the English interface; `/de` for German or `/vi` for Vietnamese. Interface labels follow the selected language. Document text, filenames, user-authored records and source number formatting remain unchanged.

| Purpose | Username | Password |
| --- | --- | --- |
| App user, ADVISOR + REVIEWER | `advisor.demo` | `demo-password` |
| Keycloak local admin (`http://localhost:8080/admin/`) | `admin` | `local-admin-only` |

These public example credentials are **local only**. Ports bind to loopback; never expose this development realm publicly. New identity databases import these accounts; **existing realm imports do not reset passwords**. Use authorized account administration rather than deleting a database to fix a login issue.

## First document

1. Create a General documents dossier.
2. Prepare the private Kaggle library using the [README](../README.md#kaggle-document-library). In Document research library, preview invoice 51109301, then confirm Import & analyze. Visiting a page never uploads it automatically.
3. Wait for extraction; open the private PDF/result and compare amount, date and identifier.
4. In Ask documents, search for the invoice total and inspect its original source.
5. In AI Experiments, independently read labels from the PDF or specify a question's target page, acknowledge the source check, save a reference and run an experiment.
6. Inspect Processing & data: Processing queue versus Data assets & Azure. Exports contain text and require private handling.

Local profile: PDFBox text extraction, Tesseract German/English image OCR and Java field rules. It is **not Azure OCR**; table/field results can differ. Supported PDF/image/TXT inputs stay within app limits. User-facing samples come only from the private Kaggle library and preserved DATEV references; legacy self-authored PDFs are test-only.

Nova app guidance is local. Nova evidence-analysis requires Azure OpenAI; no local LLM is bundled and no fake answer replaces an unavailable cloud model.

## Azure mode: your resources, your identity

For the complete resource/model preparation, role-assignment examples and Nova walkthrough, use [Azure AI for local Docker](AZURE_AI.md). This section covers starting the Docker profile once those prerequisites are ready.

This optional profile uses existing resources you control. It does **not** create resources, grant RBAC, start a VM or change your subscription. Azure inference may be billable; check region, data use and spending controls first.

| Configuration | Meaning |
| --- | --- |
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | Custom-subdomain resource root, e.g. `https://example-docs.cognitiveservices.azure.com/` |
| `AZURE_OPENAI_ENDPOINT` | Resource root, e.g. `https://example-chat.openai.azure.com/`, not `/openai/v1` |
| `AZURE_OPENAI_DEPLOYMENT` | Your deployed chat model's deployment name |

An authorized administrator grants your CLI identity **Cognitive Services User** on the document resource and **Cognitive Services OpenAI User** on OpenAI. Subscription-level administration alone may not allow inference. The helper never grants roles. [Microsoft Entra/Azure OpenAI guide](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/managed-identity).

Install host **Node.js 22+** and **Azure CLI**, then:

```bash
cp .env.azure.example .env.azure.local
# Edit the three YOUR-* values in .env.azure.local using your editor.
az login --tenant YOUR-TENANT-ID
az account set --subscription YOUR-SUBSCRIPTION-ID
node scripts/docker-azure.mjs up
```

If the file already exists, edit instead of overwriting it. The helper reads the ignored file; already-exported shell values take precedence. Public `.azure.com` endpoints are supported. Sovereign-cloud endpoints/audiences need a reviewed configuration change.

The helper validates configuration, gets a short-lived Cognitive Services token from host Azure CLI without printing it, writes it atomically with restrictive permissions under `.local/azure-auth/`, and read-only mounts that directory into Java. It starts the base + Azure + platform overrides using the host numeric UID/GID for private-volume permissions, then refreshes every five minutes.

| Command | Behavior |
| --- | --- |
| `node scripts/docker-azure.mjs up` | Build/start and keep token renewal active |
| `node scripts/docker-azure.mjs start` | Use existing images; keep renewal active |
| `node scripts/docker-azure.mjs watch` | Token renewal only, no container startup |
| `node scripts/docker-azure.mjs prepare` | Refresh once, no ongoing renewal |
| Ctrl+C | Stop renewal, not running containers |

Keep the foreground helper running. Cloning does not install a background service. After reboot, start Docker and the helper again. Expired/revoked identity fails closed. Never print/commit token files or mount the host's entire Azure CLI cache.

Keycloak JWT authenticates the app user; Entra token authenticates Java to Azure. The developer token bridge is **not Managed Identity**. On Azure-hosted compute, use appropriately scoped Managed Identity instead.

Azure mode is explicitly `azure`, not silent local fallback. PDF limit: two pages in the Azure Compose profile, four in local mode; file limit 3 MB. Reservations are conservative usage estimates, not billed token counts or a guaranteed monetary cap.

### Return to the no-Azure profile

Stop the renewal helper. Recreate the API so its previous Azure environment is removed; omit the Azure override:

```bash
docker compose -f docker-compose.yml -f docker-compose.platform.yml \
  up -d --build --force-recreate credit-api web
```

## Storage and lifecycle

| Named volume / path | Contents |
| --- | --- |
| `credit_cases` | Dossiers, extraction/review history, jobs, research records and compatible original storage |
| `identity_postgres` | Keycloak users/realm/sessions |
| `lab_documents` | Private queued file objects |
| `lab_vectors` | Qdrant index |
| `lab_limits` | Redis state |
| `lab_virus_definitions` | ClamAV signatures |
| `.local/reference-pdfs/` | Optional private DATEV pages; web read-only mount |
| `.local/azure-auth/` | Short-lived token, ignored and excluded from builds |

Compose project name stays `credit-intelligence-lab` for compatibility. Changing project name creates different volumes, not a data migration. `storage-init` exits 0 after setting private-volume ownership, including existing dossier subdirectories. This keeps files accessible when moving between the image user and the host UID used by the Azure profile; it does not delete files or touch host directories outside that named volume.

Stop without deleting data:

```bash
docker compose -f docker-compose.yml -f docker-compose.platform.yml stop
```

Start/rebuild the same profile:

```bash
docker compose -f docker-compose.yml -f docker-compose.platform.yml \
  up -d --build --wait --wait-timeout 900
```

Remove this stack's containers/network but **keep named volumes**:

```bash
docker compose -f docker-compose.yml -f docker-compose.platform.yml down
```

**Do not add `-v` / `--volumes` unless intentionally erasing persistent lab data.** Avoid volume/system prune as a debugging shortcut. Back up before storage/schema/account work; see existing backup/restore tools under `scripts/`.

## Verify the running stack

With host Node.js 22+:

```bash
# Full no-Azure stack; writes one fictional dossier. No DATEV required.
TEST_SHOWCASE=1 node scripts/test-oauth.mjs
# Config safety checks; no cloud calls.
node --test scripts/docker-azure-config.test.mjs
```

Acceptance covers OIDC+PKCE, token audience/roles/tenant, upload queue, ClamAV, local invoice extraction, byte-identical private originals, anonymous denial, Qdrant, durable experiments and export. It logs out afterward. Labelled test records remain; no existing dossier is erased.

After preparing the eight Kaggle PDFs and starting Azure mode, `TEST_KAGGLE=1 TEST_KAGGLE_CHAT=1 node scripts/test-oauth.mjs` verifies the complete Kaggle library, Azure layout analysis, private originals, classification, hybrid retrieval and Nova citations. This separate opt-in check creates two local dossiers and makes billable Azure inference calls; it does not delete prior records or approve extracted values.

For the processing control room, run `TEST_PIPELINE=1 node scripts/test-oauth.mjs` in Azure mode. It creates a labelled local dossier, analyzes one pinned synthetic Kaggle invoice, verifies source integrity and six database-recorded stages, and checks duplicate rejection, waiting-job cancellation and an inert content-security negative control. The invoice analysis may incur Azure charges; the blocked control must not reach Azure. No existing records are erased or human-approval states fabricated. See [pipeline operations](../README.md#document-pipeline-operations) for retry, cancellation and manifest limits.

For code checks: `npm ci && npm run verify`; Java 21/Maven: `mvn -f services/credit-api/pom.xml verify`. `TEST_RESEARCH=1 node scripts/test-oauth.mjs` needs an existing approved Robert-Muster original and is **not** the fresh-clone test. Other opt-in historical flags can call Azure; read their prerequisites before running.

## Logs and troubleshooting

```bash
docker compose -f docker-compose.yml -f docker-compose.platform.yml \
  logs --tail=80 credit-api web keycloak
docker compose -f docker-compose.yml -f docker-compose.platform.yml \
  logs --tail=40 clamav
```

Inspect logs privately; redact identifiers before sharing. Never dump environment/token contents.

| Symptom | Remedy |
| --- | --- |
| Docker unreachable | Start Docker Desktop/Engine; confirm `docker version` includes the server |
| Port already in use | Inspect 3000/8080/8081 and stop only the recognized conflicting app |
| ClamAV starting | Allow signature initialization; inspect scanner logs, do not disable scanning |
| `storage-init` exited 0 | Expected success |
| Fresh login fails | Use local account above; open `localhost`, check Keycloak health, issuer/redirect |
| Existing account password differs | Existing realm is retained; use authorized admin, not volume deletion |
| API 401/403 | Check issuer, `credit-api` audience, roles and tenant; never disable JWT checks |
| Azure 401/403 | Correct tenant, token renewal and resource-scoped inference roles |
| Model deployment not found | Actual deployment name and correct resource-root endpoint |
| Analysis 503 | Current provider, identity renewal/service readiness and newest job; old failure is history |
| HTTP 409 / stale reference | Refresh source/dossier; save a newly checked reference version |
| Nova unavailable locally | Expected without OpenAI; app help and RAG are separate |
| Redis unavailable | Restore dependency; do not remove shared limits |
| Foundry/Data Factory/Blob not connected | Expected: preparation/export exists, cloud connectors require separate integration |

## Optional traces and production boundary

```bash
docker compose -f docker-compose.yml -f docker-compose.platform.yml \
  -f docker-compose.observability.yml up -d
```

Optional local traces are not an automatic Application Insights integration. Manage with the same override. Do not remove orphaned containers before checking their purpose.

This guide does not run Terraform, publish images, start a paid VM, expose databases or deploy Vercel. Azure deployment files (`infra/azure/vm-lab/`) contain no Spark service, and Spark must not be added to them. Automatic Git-triggered Vercel deployment is disabled for this showcase release. Cloud release, TLS, secret management, backups and production identity remain separate work.

A separate cloud showcase exists. Its Vercel frontend, https://document-intelligence-lab.vercel.app, signs in against the Azure VM backend. That VM is started on demand and is normally deallocated; see [Azure VM lab](AZURE_VM_LAB.md). Local Docker does not use the showcase. Local volumes and the separately retained Azure AI resources do not depend on it.

## Local memory profile

The local helper includes `docker-compose.local-resources.yml`: one Docling conversion worker; CPU/RAM ceilings for PostgreSQL, Keycloak, API, web, Redis, Qdrant and ClamAV; one Ollama request/model. The parser keeps 3 GiB and the model container keeps 5 GiB ceilings for processing peaks. Limits are not reserved RAM. Startup no longer loads Nova weights merely to open the UI. The first question loads the installed model; the default engine keep-alive is five idle minutes. `node scripts/docker-local.mjs --no-build --warmup` explicitly prepares RAM for a presentation. Model weights remain in their existing volume.

Cold CPU responses can take several minutes. The local chat proxy uses a bounded 380-second HTTP transport deadline, above the model's 360-second deadline; the default Node 300-second header timeout must not discard an answer saved by Java. Cancellation still aborts the client wait, and cloud requests keep their separate shorter deadline.

Check actual usage with `docker stats --no-stream`. Disk images/cache are separate from RAM: only clean rebuildable cache or explicitly approved unused images. Never use volume/system prune to solve memory pressure. Backups stream to disk with `scripts/backup-workspace.mjs`; reference/model files, database volumes and other projects are not removed by startup.
