# Showcase release verification

Verification date: 16 October 2026. Source release for Document Intelligence Lab; no Azure/Vercel production redeployment.

## Scope

- Release multi-domain document research and the source-bound AI Experiments/Data Pipelines workspaces.
- Rewrite the English README and Docker runbook for a new developer, with actual local screenshots.
- Replace owner-specific Azure Compose endpoints with validated, ignored per-developer configuration.
- Keep application/identity database volumes, original documents and existing private DATEV files intact.
- Preserve unrelated, uncommitted VM interview-scheduler changes; they are not part of this release.

## Code checks

| Check | Result |
| --- | --- |
| ESLint / TypeScript | Passed |
| Frontend unit tests | 204 passed across 32 files |
| Java `mvn verify` | 197 discovered, 196 passed, one opt-in live Azure test skipped; no failures/errors |
| Azure configuration safety | Five Node.js tests passed; no cloud calls |
| Base + platform Compose configuration | Valid without Azure variables |
| Source-bound research acceptance | 33 checks passed in the retained local workspace during the preceding implementation |

The web production build, Java package and both standard Docker image builds succeeded. Test counts do not imply general OCR/LLM accuracy or production certification.

## Fresh-stack acceptance

A separate `document-intelligence-showcase-check` Compose project was created with new identity/application databases, vector/Redis/document/signature volumes, and no Azure override. The retained local stack was temporarily stopped to free its ports; no existing database was removed.

`TEST_SHOWCASE=1 node scripts/test-oauth.mjs` completed **26 checks successfully**: real OIDC/PKCE login with the documented account, API audience/tenant/roles, fictional invoice upload and durable job, ClamAV scan, local extraction/type/total, authenticated original byte integrity, anonymous denial, actual Qdrant retrieval, saved question reference, durable three-method retrieval evaluation, zero Azure calls and private export. The session logged out.

The UI also logged in with `advisor.demo` / `demo-password` against the new realm. Repeated open/close/refresh of the invoice result left exactly **one** sample-library section, with no browser console errors. Layouts at 1280px and 390px had no horizontal document overflow.

The private test object was checked after ownership transitions `1000:1000 → 501:20 → 1000:1000`. Both non-root users read the same expected SHA-256 as the authored invoice; recursive initialization preserves nested object access. The temporary test containers/network were removed afterward with `down` **without deleting volumes**, and the original local stack was restored using the tested images.

Production npm dependency audit reported zero vulnerabilities at verification time. This is not a complete security assessment or a guarantee about future dependency findings.

## Reproducibility and security improvements

- A new clone no longer depends on the author's Azure endpoint/deployment names. `docker-azure.mjs` reads `.env.azure.local`, with exported environment values taking precedence, and rejects missing/template/insecure configuration before token access.
- `.env.azure.example` is tracked; actual `.env.azure.local`, tokens, private PDFs and build outputs are excluded.
- Local web, identity and API ports bind to loopback. No new public endpoint or RBAC grant was introduced.
- Private-volume initialization also updates existing dossier subdirectory ownership when switching between local image UID and Azure host UID, instead of changing only the root directory and breaking later access.
- The fresh-stack acceptance uses the repository-authored invoice, real Keycloak login and durable workers. It does not need a pre-existing DATEV dossier or call Azure.
- Different React keys now identify the sample library and document-results workspace. Previously their shared dossier key could cause the sample library to duplicate after rerenders. A regression test guards their distinct identities.
- Multi-domain document guidance no longer describes all sources as payroll.
- `vercel.json` disables Git-triggered deployments, so pushing the showcase branches is not an implicit cloud rollout. GitHub verification workflows still run.

## Screenshot provenance

The overview, private fictional-invoice evidence review, actual source-bound evaluation results and logical pipeline layers were captured from local Docker at a tested 1280px desktop breakpoint. English UI is used for the showcase. The screenshots contain fictional examples; no credentials/tokens or original DATEV PDF pages are distributed.

Example evaluation scores cover only two manually checked DATEV fields and one labelled retrieval target. They are not a representative benchmark. Fresh clones do not inherit the author's dossier counts or private reference files.

## Release boundary

The release synchronizes `master` and `develop` only after local checks. No force-push, history/date rewrite, branch deletion, database deletion, cloud VM startup or Terraform apply is required. Existing cloud infrastructure remains on its previous deployed release.
