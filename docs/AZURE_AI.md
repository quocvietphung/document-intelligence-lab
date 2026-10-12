# Azure AI runbook

The Java API owns both AI trust boundaries:

```text
Browser -> Keycloak access token -> Java API
                                  |- selected tenant/case
                                  |- Azure Document Intelligence
                                  `- LangChain4j -> Azure OpenAI
```

Azure compute uses `DefaultAzureCredential` / Managed Identity. The local Docker profile uses the host's Azure CLI login through a read-only, short-lived token file for both Document Intelligence and OpenAI. There is intentionally no Azure API-key code path. Raw prompts, document text and tokens are not written to application logs.

## Verified shared AI profile (2026-10-11)

`docker-compose.azure.yml` now configures both real services: `vietphung-documents-shared` / `prebuilt-layout` and `vietphung-ai-shared` / `gpt-4.1-mini`. Java selects the `token-file` credential for both. `AZURE_AI_REQUIRED=true` prevents a missing endpoint/deployment from silently starting in demo mode. The UI labels this profile **Azure OpenAI · Entra identity, no API key**, not Managed Identity.

The signed-in developer identity has **Cognitive Services OpenAI User** on the shared OpenAI resource only, granted after explicit owner approval. Subscription Owner alone did not provide this inference data permission. No new model, key or paid Azure resource was created. Inference on the existing model still follows normal Azure token billing.

The three one-page German payroll samples are clearly fictitious. Open **Documents & review → Payroll sample library**, preview a PDF, then import/analyze it. **Inspect evidence** displays the authenticated original with PDF.js, page/zoom controls and extracted fields. PDF.js worker/font/wasm assets are served by the app itself; no document or bearer token is sent to a PDF-viewer CDN. Original bytes remain in the case database. Source links in Nova can open the selected case's PDF evidence.

Live integration:

```bash
TEST_PAYROLL=1 TEST_CHAT=azure node scripts/test-oauth.mjs
TEST_BANKING=1 TEST_CHAT=azure node scripts/test-oauth.mjs
```

These use synthetic records only and exercise Azure calls. The ordinary Java/TypeScript suites do not call Azure unless explicitly enabled. Keep `scripts/docker-azure.mjs` running for token renewal while using the local Docker profile.

## Document Intelligence modes

| Mode | Behaviour |
|---|---|
| `local` | PDFBox/Tesseract plus transparent label rules; no Azure call |
| `azure` | `prebuilt-layout` (or the configured model) must succeed; failures fail closed |
| `azure-with-local-fallback` | Azure is primary; service failures fall back to local extraction and the stored provider makes this visible |

Every stored document records `analysisProvider`, `modelId`, `contentType`, page text/evidence and OCR confidence when available. Confidence is a recognition signal, never business accuracy. Every extracted field still requires human confirmation.

## Provision the keyless Azure resources

```bash
az login
az group create --name rg-credit-ai-lab --location germanywestcentral
cp infra/azure/ai-services.bicepparam.example infra/azure/ai-services.bicepparam
az deployment group what-if \
  --resource-group rg-credit-ai-lab \
  --template-file infra/azure/ai-services.bicep \
  --parameters infra/azure/ai-services.bicepparam
az deployment group create \
  --resource-group rg-credit-ai-lab \
  --template-file infra/azure/ai-services.bicep \
  --parameters infra/azure/ai-services.bicepparam
```

The template creates a user-assigned managed identity, Document Intelligence and the least-privilege Cognitive Services role assignment. The default `prebuilt-layout` request enables `KEY_VALUE_PAIRS`; a trained custom model ID can be supplied later without changing the transport. Both Azure key-value pairs and top-level custom fields are normalized into the review schema while page evidence and provider/model provenance remain visible. Azure OpenAI creation is optional because model availability and quotas vary by subscription and region. Set `deployOpenAi=true` only after confirming quota, model version and allowed region.

Attach the output managed identity to the Java runtime (for example Azure Container Apps), then set:

```text
AZURE_CLIENT_ID=<managed identity client id>
DOCUMENT_ANALYSIS_MODE=azure
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=<deployment output>
AZURE_DOCUMENT_INTELLIGENCE_MODEL=prebuilt-layout
AZURE_OPENAI_ENDPOINT=<existing or deployment output>
AZURE_OPENAI_DEPLOYMENT=<deployment name>
```

For a direct local Java run, `az login` supplies the developer identity. Grant that identity **Cognitive Services User** for Document Intelligence and **Cognitive Services OpenAI User** for Azure OpenAI. Base Docker Compose remains in `local` mode; the explicit Azure override enables the token-file bridge without copying the host CLI credential cache into a container.

## Existing shared resource (2026-10-11)

Document Intelligence `vietphung-documents-shared` is in the existing `ai-shared` resource group, West Europe, on the free `F0` tier. It is a separate service alongside `vietphung-ai-shared` OpenAI. No new Azure OpenAI deployment or storage service is required for byte uploads.

Endpoint: `https://vietphung-documents-shared.cognitiveservices.azure.com/`

API-key authentication is disabled. The local developer has resource-scoped **Cognitive Services User** access. Managed Identity `credit-intelligence-ai` has the same role on this document resource; attach it to a Java Azure runtime before using it there. Its client ID is `d571d150-197a-4f5b-9f50-0d49cc2a9487`. Local execution uses `az login` and does not require setting that Managed Identity client ID.

The `azure-shared` Spring profile configures the endpoint, `prebuilt-layout` plus key-value extraction, and a two-page maximum. It explicitly selects `AzureCliCredential` to avoid IDE credential/keychain prompts on macOS. On an Azure runtime set `AZURE_DOCUMENT_INTELLIGENCE_CREDENTIAL=default` (and `AZURE_TOKEN_CREDENTIALS=ManagedIdentityCredential` for a deployed Managed Identity). PDFs over two pages are rejected before calling Azure, avoiding incomplete F0 results. The upload formats in this profile are PDF, PNG and JPEG; TXT remains a local-only format.

Run Java on the host with existing Keycloak/PostgreSQL configuration:

```bash
az login
cd services/credit-api
mvn spring-boot:run -Dspring-boot.run.profiles=azure-shared
```

This command retains OAuth/Keycloak validation. For browser uploads the Java case database must also be configured; running the profile alone does not provision Keycloak or PostgreSQL. The default Docker Compose still uses local extraction. A host Azure CLI session is not automatically available inside its Java container.

### Recommended: web and Java both in Docker

Stop any host Next.js/Java processes using ports 3000 and 8081 before starting this stack. Do not run both versions on the same ports.

```bash
az login
node scripts/docker-azure.mjs
```

This builds/starts all five application containers with `docker-compose.azure.yml`: web, Java, Keycloak and two PostgreSQL databases. Existing database volumes are retained. Open `http://localhost:3000/en`. Containers have `unless-stopped` restart policies.

Keep this small host helper running: every five minutes it renews a short-lived Cognitive Services access token using your existing Azure CLI login. Java reads a read-only bind-mounted token file. No API key or Azure CLI refresh-token directory is mounted into Docker; `.local/azure-auth/` is excluded from Git and the Docker build context. This is a local developer bridge, **not Managed Identity**. On Azure use Managed Identity instead.

If the helper stops, containers stay running, but Azure calls fail closed after the token expires. Restart token renewal without rebuilding with `node scripts/docker-azure.mjs watch`. After a reboot, run the normal start command again. `prepare` is only for one-shot setup and does not renew tokens.

If Maven downloads inside Docker fail, build the JAR with your host Maven cache, then use the prebuilt runtime Dockerfile:

```bash
cd services/credit-api
mvn -DskipTests package
docker build -f Dockerfile.prebuilt -t credit-intelligence-lab-credit-api .
cd ../..
docker compose build web
node scripts/docker-azure.mjs start
```

`start` uses existing images without rebuilding and still renews the Azure token. For offline local packaging only, `Dockerfile.prebuilt` also accepts `--build-arg RUNTIME_IMAGE=<trusted-local-java-tesseract-image>`; never supply an untrusted base image. Run the Java tests before packaging.

### Alternative: Java and web on the host

Start Docker Desktop. From the repository root start only the supporting services:

```bash
docker compose -f docker-compose.yml -f docker-compose.azure-host.yml \
  up -d --wait --wait-timeout 180 case-db identity-db keycloak
```

In a second terminal run the Java API on the host (the credentials below are the existing synthetic local database credentials):

```bash
cd services/credit-api
SERVER_PORT=8081 \
KEYCLOAK_ISSUER=http://localhost:8080/realms/credit-intelligence \
KEYCLOAK_JWK_URI=http://localhost:8080/realms/credit-intelligence/protocol/openid-connect/certs \
CASE_PERSISTENCE_ENABLED=true CASE_WRITES_ENABLED=true \
CASE_DATABASE_URL=jdbc:postgresql://localhost:5433/credit_cases \
CASE_DATABASE_USER=credit_lab CASE_DATABASE_PASSWORD=local-cases-only \
mvn spring-boot:run -Dspring-boot.run.profiles=azure-shared
```

In a third terminal, from the repository root:

```bash
CREDIT_API_URL=http://localhost:8081 \
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080 \
NEXT_PUBLIC_KEYCLOAK_REALM=credit-intelligence \
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=credit-intelligence-web \
npm run dev -- --hostname 127.0.0.1
```

Open `http://localhost:3000/en`, sign in as the local `advisor.demo` account, create a synthetic case, then open **Documents & review → Upload sample payroll**. This sends the one-page PDF in `public/demo/synthetic-payroll.pdf` through the same authenticated upload endpoint as a selected file. **Inspect evidence** shows the actual extraction provider/model and the extracted net income, employer and date alongside page evidence. This flow was successfully verified with Azure on 2026-10-11. No real applicant or financial data is included in the sample.

An opt-in live test generates a synthetic PDF in memory and verifies real Azure page/field extraction through the application's Java provider:

```bash
cd services/credit-api
AZURE_DOCUMENT_LIVE_TEST=true \
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://vietphung-documents-shared.cognitiveservices.azure.com/ \
mvn -Dtest=AzureDocumentIntelligenceLiveTest test
```

Optionally set `AZURE_DOCUMENT_SAMPLE_PATH` to export the generated synthetic PDF for manual browser uploads. The ordinary test suite never calls Azure unless `AZURE_DOCUMENT_LIVE_TEST=true` is explicitly set.

To reproduce only the shared document resource configuration, use `infra/azure/shared-document-intelligence.bicep` against `ai-shared`. It defaults to F0, disables key authentication, and leaves existing shared OpenAI resources unchanged. RBAC assignments are separate from this resource template.

F0 limits: [Microsoft service limits](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/service-limits?view=doc-intel-4.0.0). Model support: [Layout documentation](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/layout?view=doc-intel-4.0.0).

## Verification

1. Call `GET /api/cases/document-analysis/status` with an advisor token. It must report the selected mode, provider, model and `keylessIdentity: true`.
2. Upload a synthetic PDF/image. Inspect its provider/model and page evidence in the workspace.
3. Confirm/edit fields as a reviewer; no field is auto-approved.
4. Ask Nova a case question. The Java API binds tools to the already-authorized tenant and case; the model cannot select another case.
5. Check the append-only `ai_audit` table. It stores request ID, actor, tenant, case, mode and time—never the prompt or document content.

Production still requires private networking or restricted ingress, encrypted object storage instead of bounded PostgreSQL blobs, malware scanning, retention/deletion policy, backup/restore tests, regional/data-residency review, DPIA, alerting and independent model/security validation.
