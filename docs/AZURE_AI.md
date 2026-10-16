# Azure AI for the local Docker workspace

This guide connects **your local Java container** to Azure Document Intelligence and Azure OpenAI. Docker, Keycloak and the databases stay on your machine. It does not deploy a VM or Vercel application.

Start with [Docker local setup](DOCKER_LOCAL.md). Without Azure, the workspace still offers local extraction, PDF review, evidence search and experiments. Only Nova's evidence-analysis mode needs a deployed chat model.

## 1. Understand the two authentication boundaries

```text
Browser -- Keycloak access token --> Next.js proxy --> Java API
Host Azure CLI -- short-lived Entra token file --> Java --> Azure AI
```

Keycloak verifies the **app user**: API audience, role, tenant and dossier access. An Entra token verifies the **developer identity** allowed to call Azure. Neither token replaces the other.

The token-file bridge is for local development, **not Managed Identity**. Managed Identity applies to an Azure-hosted workload. Microsoft documents the distinction and resource-scoped OpenAI access in its [keyless authentication guide](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/managed-identity).

No Azure API key belongs in Next.js public variables, Git, Vercel or a browser. This setup does not require a client secret or an application registration.

## 2. Prepare the resources

Reuse resources you are authorized to use, or have an administrator create these two resources:

| Resource | Required configuration |
| --- | --- |
| Azure OpenAI | A resource-root endpoint and a deployed chat model compatible with Chat Completions/tool calling |
| Azure Document Intelligence | A custom-subdomain resource endpoint; the application uses `prebuilt-layout` |

### Azure OpenAI and the model deployment

1. Open the Azure OpenAI resource in Azure/Foundry and record its resource endpoint.
2. Open its model deployment screen and deploy a supported chat model with available quota in your region.
3. Record the **deployment name** you chose. It can differ from the underlying model name.
4. Use the deployment/resource pair from the same resource.

The existing local integration has been exercised with a `gpt-4.1-mini` chat deployment. Do not assume that this model/version is available in every region or that a Responses-only/reasoning deployment accepts the same settings.

This code uses LangChain4j `AzureOpenAiChatModel` with temperature `0.1`, output limit `1500`, a `35-second` timeout, no SDK retries and provider request/response logging disabled. These settings are in `services/credit-api/src/main/java/dev/creditlab/assistant/AzureAiConfiguration.java`, not editable model tuning controls in the UI.

Creating a resource or model deployment can incur costs. It is not done by any local startup script.

### Document Intelligence

Use a resource-specific endpoint, such as:

```text
https://example-documents.cognitiveservices.azure.com/
```

A regional endpoint is not interchangeable with a custom-subdomain endpoint for Entra authentication. See [Microsoft's authentication requirements](https://learn.microsoft.com/en-us/azure/ai-services/authentication).

No custom extraction model training is required for `prebuilt-layout`. Field classification/normalization also use Java rules; do not describe this as a trained payroll or insurance model.

If access is restricted, use the organization's approved network/VPN and verify DNS and access policy. Do not bypass restrictions or make a private resource public merely to get a successful test.

## 3. Sign in to the correct tenant/subscription

Install **Azure CLI**, **Node.js 22+**, and Docker on the host.

```bash
az login --tenant YOUR-TENANT-ID
az account set --subscription YOUR-SUBSCRIPTION-ID
az account show --query '{subscription:name,id:id,tenant:tenantId}' -o table
```

For a browserless session, use the Azure CLI's supported device-code login flow. Your host CLI session stays on the host; the app does not copy the `.azure` directory into Docker.

Tenant/subscription IDs identify configuration, not a credential. Signing in does not by itself grant inference permission.

## 4. Grant resource-scoped inference permissions

An authorized administrator grants:

| Identity | Resource scope | Role |
| --- | --- | --- |
| Your developer user | The one Azure OpenAI resource | `Cognitive Services OpenAI User` |
| Your developer user | The one Document Intelligence resource | `Cognitive Services User` |

Being able to administer a subscription is not the same as having data-plane inference access. These grants are persistent resource access; review the exact account and scope before applying them. Do not grant Owner, subscription-wide access or a new service principal for this local walkthrough.

### Portal

On each resource, open **Access control (IAM)** → **Add role assignment**. Select the role above and the correct developer user. Review the member and resource before confirming.

### CLI alternative — administrator action, not startup

The following example targets the currently signed-in user. An administrator granting another developer access must substitute that developer's object ID.

```bash
doclabUserId=$(az ad signed-in-user show --query id -o tsv)
doclabOpenAIId=$(az cognitiveservices account show -g YOUR-AI-RESOURCE-GROUP -n YOUR-OPENAI-RESOURCE --query id -o tsv)
doclabDocumentId=$(az cognitiveservices account show -g YOUR-AI-RESOURCE-GROUP -n YOUR-DOCUMENT-RESOURCE --query id -o tsv)

az role assignment create --assignee-object-id "$doclabUserId" --assignee-principal-type User --role "Cognitive Services OpenAI User" --scope "$doclabOpenAIId"
az role assignment create --assignee-object-id "$doclabUserId" --assignee-principal-type User --role "Cognitive Services User" --scope "$doclabDocumentId"
```

Allow time for role propagation before diagnosing a newly granted `403`. Do not repeatedly broaden permissions. Local helpers never run these role-assignment commands.

## 5. Configure the local app

From the repository root, copy the example **only if the private file does not already exist**:

```bash
cp .env.azure.example .env.azure.local
```

Edit the file using your editor:

```dotenv
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://YOUR-DOCUMENT-RESOURCE.cognitiveservices.azure.com/
AZURE_OPENAI_ENDPOINT=https://YOUR-OPENAI-RESOURCE.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=YOUR-CHAT-DEPLOYMENT
```

| Value | Correct | Incorrect |
| --- | --- | --- |
| OpenAI endpoint | Resource root ending in `.openai.azure.com/` | Portal URL, Foundry project URL or `/openai/v1/chat/completions` |
| Document endpoint | Custom-subdomain resource root | Document Intelligence Studio page or analyze-operation URL |
| Deployment | Your actual deployment name | Guessing a model family name |
| Credentials | Host Entra login + helper | API key in `NEXT_PUBLIC_*` or token pasted into a file manually |

The ignored `.env.azure.local` is read by `scripts/docker-azure.mjs`; exported shell values take precedence. Next.js does not automatically turn this file into Java container configuration. The helper supplies Compose variables.

The validator accepts public Azure HTTPS `.azure.com` hosts. Sovereign clouds require a reviewed endpoint/audience change. Use the root endpoints even if vendor examples use a different SDK-specific base URL.

## 6. Start Docker with continuous token renewal

```bash
node scripts/docker-azure.mjs up
```

The helper:

1. Validates the required endpoint/deployment values.
2. Obtains a short-lived token for `https://cognitiveservices.azure.com/` using host Azure CLI.
3. Atomically writes `.local/azure-auth/token.json` with private directory/file permissions.
4. Read-only mounts that directory as `/run/azure-auth` in Java.
5. Starts base + Azure + platform Compose files using the host numeric UID/GID.
6. Refreshes the token every five minutes without printing it.

Do not change the token audience to match an unrelated SDK example: the checked-in token bridge and Java credential validate the Cognitive Services resource for this integration.

| Helper command | Purpose |
| --- | --- |
| `node scripts/docker-azure.mjs up` | Build/start containers, then keep renewal active |
| `node scripts/docker-azure.mjs start` | Start existing images and keep renewal active |
| `node scripts/docker-azure.mjs watch` | Renew tokens only |
| `node scripts/docker-azure.mjs prepare` | Refresh once; not a long-running renewal service |

Keep that terminal running. **Ctrl+C stops token renewal, not Docker.** Containers can remain healthy while an expired token causes AI calls to fail. After a reboot, start Docker and run the helper again. A clone does not install a background service.

Azure Compose limits: PDF **2 pages**, images **6 MP**, files **3 MB**. Interactive limits are finite: 12 AI requests/minute/account, 150,000 reserved tokens/day/account and 300,000/day/tenant. These are lab safeguards, **not billed usage or a monetary cap**.

## 7. Verify with the actual UI

Open [the English workspace](http://localhost:3000/en) and sign in to local Keycloak.

### Document analysis

1. Create/select the correct document-domain dossier.
2. Upload an included fictional PDF, or prepare the permitted DATEV reference pages.
3. Preview it and explicitly confirm analysis.
4. Find **Analysis results** above the library and choose **View result & PDF**.
5. Check the document's provider/model, original page, extracted values and tables.
6. Expand **OCR recognition details** only when needed. Its model signal is not measured accuracy.

Previewing a prepared PDF does not send it to Azure. Confirmed analysis does. An old failed queue attempt remains history; inspect the newest attempt/result.

### Nova

1. Open Nova and select **Evidence analysis**.
2. Ask in English, for example:

> What are the net earnings and payout in this DATEV payslip? Cite the page and do not invent missing deductions.

3. Press Enter to send; Shift+Enter adds a line break.
4. Check the reply's **Azure OpenAI** mode, page sources and evidence-by-statement controls.
5. Open a citation and compare the original before accepting a value.
6. Use feedback or a confirmed reviewer task when evidence is wrong or incomplete.

**App guidance** is a separate local mode. A greeting, configured-engine badge, health endpoint or local guide response is not proof that the Azure model answered. A completed source-linked model reply is the relevant connectivity check, not an accuracy benchmark.

The README screenshots use approved fictional DATEV evidence. They do not imply that real customer data can be uploaded without permission.

## 8. Diagnose safely

```bash
docker compose -f docker-compose.yml -f docker-compose.platform.yml ps --all
curl --fail http://localhost:8081/actuator/health
node --test scripts/docker-azure-config.test.mjs
```

| Symptom | Check |
| --- | --- |
| App `401/403` before reaching AI | Keycloak session, API audience, roles, tenant and dossier permission |
| Azure `401` | Correct tenant, current token, supported resource endpoint |
| Azure `403` | Resource-scoped data-plane role, propagation and approved network access |
| Deployment not found / `404` | Deployment belongs to the configured resource; use its deployment name |
| Nova works, OCR fails | Document resource endpoint/role and its quota are separate from OpenAI |
| OCR works, Nova fails | Chat deployment/role, compatible model settings and request limits |
| `429` | Distinguish the app's shared limits from Azure quota; wait for the applicable reset |
| Analysis `503` | Check current provider, helper renewal, service logs and newest queue attempt |
| Helper exited | Restart it; `prepare` alone does not renew indefinitely |

Do not paste token files, credentials, PDF text or provider payloads into support logs. Expired or unavailable identity should fail closed, not fall back to a fabricated answer.

## Return to local-only processing

Stop the renewal helper, then recreate only the app services with the base profile:

```bash
docker compose -f docker-compose.yml -f docker-compose.platform.yml up -d --build --force-recreate credit-api web
```

Named database/document volumes remain. Existing Azure-analyzed documents retain their true provider metadata; switching modes does not relabel or re-analyze them.

## Data and cloud boundaries

Document Intelligence receives the explicitly confirmed file. Nova receives the current question and permitted selected evidence/tool results, not a silent upload of every local PDF. Sources and model answers remain scoped to the authorized dossier.

The former demo VM has been deleted; it is not needed to call the retained AI resources from local Docker. Terraform, Vercel, Foundry evaluations, Data Factory, Blob ingestion and Application Insights are not activated by this guide. Review usage charges, region and data-handling rules separately.
