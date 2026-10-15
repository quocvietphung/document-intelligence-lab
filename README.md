# Document Intelligence Lab

An independent **Azure AI document research lab** for banking, insurance and general documents. Extract the source, retrieve evidence, explain uncertainty, and keep a human in control.

> This feature release is local-only. The existing Vercel/Azure production application is not redeployed by this change. No real customer data, payments, automated credit approval, insurance coverage decisions or claim settlement.

**Stack:** Next.js / React / TypeScript · Java 21 / Spring Boot / LangChain4j · Azure Document Intelligence + Azure OpenAI · PostgreSQL · Qdrant / ONNX / BM25 · Keycloak OIDC + PKCE · Redis · ClamAV · Docker Compose · Terraform.

## Three research domains

| Domain | Document examples | Research focus |
| --- | --- | --- |
| **Banking & payroll** | Preserved private DATEV Robert/Melanie references, income evidence, statements | Separate net earnings from payout; inspect source fields and page evidence |
| **Insurance / Versicherungen** | Fictional policy and claim notification | Policy references, insurer, policyholder, premium, deductible, coverage dates and limits; never decide coverage or compensation |
| **General documents** | Fictional invoices, contracts, reports | Extract text/tables, inspect dates and amounts, ask source-grounded questions without credit-file requirements |

Choose a domain card to filter **persisted dossiers**, not generated demo records. Create a dossier with a subject and research objective; a loan amount is no longer required. Each dossier carries its domain through PostgreSQL persistence, editing, document attachment, review, RAG and Nova.

Existing dossiers without a domain remain **banking**. Existing originals, audit entries, users, database volumes and private DATEV files are retained.

## What you can do

1. **Create or open a research dossier** in English, German or Vietnamese.
2. **Preview and analyze a PDF/image.** The document page displays processing status and results; open the original alongside extracted fields/tables.
3. **Inspect provenance.** See extraction provider/model, page evidence, OCR recognition signals and human-review status.
4. **Retrieve evidence in AI Studio.** ONNX MiniLM embeddings + Qdrant + BM25 rank relevant text, fields and tables within the authorized dossier.
5. **Ask Nova.** Azure OpenAI explains the supplied evidence, cites sources and states missing information. Navigation help is labelled separately and makes no LLM call.
6. **Compare documents or explain German terminology.** Controlled task prompts adapt to the selected domain and remain editable drafts until you send.
7. **Review and correct.** Confirm fields against the original, report unsupported answers, prepare revisions and create reviewer tasks.
8. **Inspect operations and audit history.** Authenticated service metadata, quotas, request traces, processing history and recorded review actions.

### AI versus rules

| Component | Actual implementation | Boundary |
| --- | --- | --- |
| Document extraction | Azure Document Intelligence `prebuilt-layout`; explicit local PDFBox/Tesseract profile | OCR confidence is not validated field accuracy |
| Nova | Existing Azure OpenAI deployment via Java/LangChain4j | Read-only authorized evidence tools; no credit, coverage or payout decisions |
| Hybrid retrieval | Local quantized MiniLM embeddings, Qdrant, BM25 and transparent score combination | English-focused embedding; no trained neural reranker or guaranteed multilingual recall |
| Document types and fields | Transparent Java rules, including insurance-policy, insurance-claim, invoice and contract | Not a trained insurance classifier or an Azure custom model |
| Required-document checks | Banking: income + statement; insurance: policy; general: no fixed checklist | These are explicit lab templates, not legal or underwriting requirements |
| Human review / feedback | Version-checked application workflow and stored history | Citation existence and human-reviewed source status do not prove every AI statement true |

## Local walkthrough

1. Start Docker Desktop and sign in to Azure CLI if using the existing shared Azure resources.
2. From the repository directory, run:

```bash
node scripts/docker-azure.mjs up
```

The helper refreshes short-lived Entra tokens without logging them. Keep it running while testing Azure. To start already-built images without rebuilding:

```bash
node scripts/docker-azure.mjs start
```

For a local-only OCR profile without Azure model calls:

```bash
docker compose -f docker-compose.yml -f docker-compose.platform.yml up --build -d
```

| Service | Local address |
| --- | --- |
| Web | http://localhost:3000/en |
| Java health | http://localhost:8081/actuator/health |
| Keycloak | http://localhost:8080 |

Use the existing local lab account configured by the operator. The repository includes local-only example identities; never reuse those credentials on a real deployment.

### Try insurance

- Choose **Insurance** and create a fictional dossier.
- Open **Documents & review**. Preview either insurance research sample, then explicitly confirm analysis.
- Open **View result & PDF** and compare the policy number, premium, deductible and dates with the source.
- Use **Domain research**, **AI Studio** or Nova to compare policy/claim references.
- Nova must distinguish the stated coverage limit from any hypothetical compensation. It cannot settle a claim.

### Keep using DATEV

Choose **Banking & payroll** to access the original private DATEV library and existing results. The Robert/Melanie PDFs remain in `.local/reference-pdfs/`, outside Git and public assets. They are not replaced by homemade payslips.

The three PDFs in `public/samples/` are newly authored, clearly fictional insurance/invoice fixtures, **not DATEV products**. Regenerate them with `scripts/generate-research-samples.py` using ReportLab. They contain no real customer information.

## Architecture

```text
Browser / Next.js
    ├── Keycloak: OIDC authorization code + PKCE
    └── authenticated API transport
              ↓
    Java / Spring Boot: verified JWT, tenant + dossier scope
       ├── PostgreSQL: dossiers, domain, extraction, audit, feedback
       ├── document queue → ClamAV → Azure Document Intelligence
       ├── PDFBox / Tesseract in the explicit local profile
       ├── ONNX + Qdrant + BM25 → selected evidence
       ├── LangChain4j → Azure OpenAI → cited explanation
       └── Redis limits, private document storage, telemetry
```

User login is independent of Azure authentication: **Keycloak** authenticates the app user; the cloud VM's **Managed Identity** authenticates to Azure AI. Local Docker uses a short-lived token file refreshed by the operator's Azure CLI. No Azure API key is stored in Vercel or committed.

The current cloud infrastructure remains Vercel frontend + Azure VM/Compose. This feature branch does not deploy it, rename Azure resources or modify production credentials.

## Compatibility and data safety

The historical Java package `dev.creditlab`, service name `credit-api`, Keycloak realm/client IDs, database table names, `CR-` identifiers and Docker Compose project/volume names are deliberately retained as **internal compatibility identifiers**. Renaming them merely for branding could disconnect users or existing originals. The visible app, GitHub repository and local directory use Document Intelligence Lab.

Domain is stored in each dossier's existing JSON payload; no table is dropped or destructively migrated. Old payloads default to banking. Permission checks remain server-side for every business API. A domain filter is organization/navigation, not a security boundary; tenant and dossier authorization remain mandatory.

## Tests

```bash
npm run verify
mvn -f services/credit-api/pom.xml test
TEST_WRITE=1 node scripts/test-oauth.mjs
TEST_MULTIDOMAIN=1 node scripts/test-oauth.mjs
```

The multi-domain acceptance test uses the real local login, API, PostgreSQL and uploaded originals. Live Azure checks are explicit and use only fictional test PDFs. Use `TEST_LOCAL_AI_UNAVAILABLE=1` only for the explicit local profile without Azure. Passing unit tests does not establish general OCR/LLM accuracy.

See [feature verification](docs/DOCUMENT_INTELLIGENCE_LAB.md) for the actual checks performed and any local build limitations. Earlier credit-focused release reports in `docs/` are historical records, not a claim that this feature branch is deployed.

## Responsible research

- Only fictional or explicitly authorized public references.
- No payments, automated lending, underwriting or claim settlement.
- No fabricated accuracy, cost-saving or compliance claims.
- No hidden fallback from an unavailable Azure service to a fake model response.
- Upload consent, source inspection, least privilege and human review remain part of the workflow.
