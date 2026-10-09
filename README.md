# Credit Intelligence Lab

A production-minded banking AI engineering portfolio built from an earlier finance prototype. The lab demonstrates document intelligence, tenant isolation, human review, measurable AI quality and keyless Azure OpenAI access.

> All names, documents, amounts and metrics are synthetic. This independent project is not affiliated with apoBank or any lender. It does not provide financial advice or make credit decisions.

## What the lab demonstrates

- Credit intake inspired by real document-collection workflows: applicant, co-applicant, checklist, save/resume model and missing-document status.
- Document AI concepts: classification, OCR field extraction, per-field confidence, missing-field checks and contradiction detection.
- Human-in-the-loop control: low-confidence or conflicting evidence is escalated; there is no approval/rejection endpoint.
- AI evaluation: labelled reference-set metrics are shown separately from technical availability.
- Explainable AI copilot: Nova answers questions about the synthetic case and cites the current workflow context.
- OAuth 2.0/OIDC with Keycloak and PKCE for the browser.
- Tenant and role enforcement in a Java 21/Spring Boot resource server.
- Azure OpenAI via Microsoft Entra workload identity / Vercel OIDC—no long-lived Azure API key.
- Docker Compose for the full local platform and CI for both TypeScript and Java.

## Architecture

```text
Browser / Next.js 16
  ├─ Keycloak OAuth 2.0 + OIDC + PKCE
  ├─ Credit workspace and human review
  └─ Nova streaming chat
         │
         ├─ Next.js AI route ── Vercel OIDC ── Azure OpenAI
         │                        (short-lived Entra token)
         │
         └─ Java 21 / Spring Boot API
              ├─ JWT signature and role validation
              ├─ tenant_id derived from verified token
              ├─ case/document workflow
              └─ health and audit-safe operations
```

The same word “tenant” appears in two independent security boundaries:

1. **Business tenant**: `tenant_id` in the Keycloak JWT isolates customer organisations.
2. **Azure tenant**: Microsoft Entra tenant used to exchange Vercel’s OIDC assertion for a short-lived Azure token.

## Run the web app

Requirements: Node.js 22+.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. Without Keycloak or Azure configuration the UI starts in a clearly labelled synthetic demo mode and Nova uses deterministic demo answers.

## AI Solution Engineer practice map

| Capability | Demonstrated here |
|---|---|
| Document AI | Classification, OCR-style extracted fields, confidence and evidence review |
| LLM/RAG | Case-scoped retrieval, multilingual streaming answers and deterministic fallback |
| Evaluation | Labelled synthetic reference metrics kept separate from service uptime |
| Java integration | Spring Boot REST resource server with validation and tests |
| Identity | OAuth 2.0/OIDC, PKCE, roles and verified `tenant_id` claims |
| Azure security | Workload identity and short-lived tokens instead of a stored API key |
| Operations | Health endpoint, audit-safe events, Docker Compose and CI |
| Responsible AI | Human review, uncertainty handling and no automated lending decision |

## Run the complete OAuth platform

Requirements: Docker Desktop with Docker Compose.

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Next.js workspace | `http://localhost:3000` |
| Keycloak | `http://localhost:8080` |
| Java API | `http://localhost:8081/actuator/health` |

Local-only demo login:

- User: `advisor.demo`
- Password: `demo-password`
- Roles: `ADVISOR`, `REVIEWER`
- Business tenant: `praxisbank-demo`

The checked-in account is deliberately limited to local development. Do not reuse these credentials outside the lab.

## Run and test the Java API

```bash
cd services/credit-api
mvn spring-boot:run -Dspring-boot.run.arguments="--app.security.enabled=false"
```

```bash
curl -H "X-Demo-Tenant: praxisbank-demo" http://localhost:8080/api/cases
```

In the secured Docker profile the demo header is not an authentication mechanism: the API derives `tenant_id` from the verified Keycloak token. The header exists only for the isolated, security-disabled Java test profile.

## Azure OpenAI without an API key

Copy `.env.example` to `.env.local` and set endpoint, deployment, Azure tenant ID and client ID. Locally, `DefaultAzureCredential` can use `az login`. On Vercel, configure workload identity federation and grant the application the minimum Azure OpenAI role. The route exchanges Vercel’s signed OIDC assertion through `ClientAssertionCredential`.

Never commit an Azure API key. The project intentionally has no API-key code path.

## Production topology on Vercel

The Git repository can be connected to three Vercel projects so each workload has an independent release boundary:

| Project | Root directory | Runtime |
|---|---|---|
| `credit-intelligence-lab` | `/` | Native Next.js |
| `credit-intelligence-api` | `services/credit-api` | OCI container from `Dockerfile.vercel` |
| `credit-intelligence-auth` | `infra/keycloak` | OCI container from `Dockerfile.vercel` |

Keycloak uses an external PostgreSQL database provisioned through the Vercel Marketplace. This is required because Vercel containers are stateless and scale to zero. The database preserves the realm, users, sessions and signing material across container restarts.

Production environment boundaries:

- The browser uses OAuth 2.0 Authorization Code with PKCE and never receives a client secret.
- The Java API validates the Keycloak issuer and signing keys before deriving roles and `tenant_id`.
- The Next.js chat route exchanges Vercel OIDC for a short-lived Microsoft Entra token; no Azure OpenAI key is stored.
- All public portfolio records are synthetic. The shared demo account is intentionally restricted to synthetic read-only data.

Vercel container support is suitable here as a portfolio lab. A regulated production bank deployment should run Keycloak in an always-on, multi-replica environment with managed PostgreSQL, backups, private networking and operational ownership.

## Verification

```bash
npm run verify
cd services/credit-api && mvn verify
```

The GitHub Actions workflow runs lint, TypeScript checks, unit tests, Next.js production build and Maven tests on every pull request.

## Safety boundaries

- Synthetic portfolio data only.
- AI output is explanatory, not a lending decision.
- Confidence values are model signals, not factual certainty.
- Contradictions and confidence below policy thresholds require human review.
- Logs should contain IDs and status codes, not raw document text or identity numbers.
- A production deployment still needs persistent encrypted storage, distributed rate limiting, complete audit retention, DPIA/legal review and independent model validation.
