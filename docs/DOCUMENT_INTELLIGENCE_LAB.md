# Multi-domain document research - feature verification

Verified locally on 15-16 October 2026. Branch: `feature/document-intelligence-lab`.

## Scope

- GitHub repository and local directory renamed to `document-intelligence-lab`.
- Visible branding, dossier creation, dashboard and source research now cover banking/payroll, insurance and general documents in EN/DE/VI.
- Domain is persistent dossier metadata, preserved by version-checked edits, document attachment, review and reads.
- Historical JSON defaults to banking. No original, account, audit record, database table or volume was deleted.
- DATEV Robert/Melanie originals remain private and outside Git.
- Three new clearly fictional PDFs cover policy, claim notification and invoice analysis. They are original fixtures, not DATEV products or actual insurance documents.
- Nova's prompt, retrieval policy and comparison/terminology tasks use the selected dossier domain. No credit, coverage, underwriting or settlement decisions.
- Production Vercel/Azure infrastructure and `master`/`develop` were not updated by this feature.

## Verification evidence

| Check | Result |
| --- | --- |
| Frontend lint and typecheck | Passed |
| Frontend unit/regression tests | 196 passed across 30 files |
| Java tests | 181 total: 180 passed, one opt-in live test skipped; no failures |
| Next.js optimized build | Passed |
| Standard Docker web and Java builds | Passed |
| Live multi-domain acceptance | 93 checks passed, repeated after switching to the canonical Docker-built Java image |
| OAuth/API compatibility regression | 31 checks passed, including real Azure PDF extraction and manual review |
| Keycloak config validation | Passed; OIDC, PKCE, API audience and tenant claims retained |
| Production dependency audit (`npm audit --omit=dev`) | Zero vulnerabilities reported at verification time; not a general security certification |

### Live acceptance (`TEST_MULTIDOMAIN=1`)

The test signs in through the real local Keycloak authorization-code/PKCE flow and checks:

1. Create banking, insurance and general dossiers with no requested loan amount.
2. Compare domain-specific missing-document templates; persist/read back from PostgreSQL.
3. Preserve domain when editing through the compatible old request format.
4. Reject anonymous dossier and original-PDF requests.
5. Queue the three fictional PDFs, scan through ClamAV and process through real Azure Document Intelligence `prebuilt-layout`.
6. Read policy, claim and invoice types plus supported amounts/identifiers/dates, retaining page evidence and provider provenance.
7. Retrieve the private original byte-for-byte; verify Qdrant returns the selected dossier's evidence.
8. Ask real Azure OpenAI about policy premium/deductible and invoice total. Verify source amounts, original-source metadata and stored answer history.
9. Confirm every previously analyzed DATEV original remains accessible only with authentication and both prepared private files remain present.

These runs prove the tested examples and service integration, not general OCR accuracy or insurance-domain correctness.

### Compatibility regression

`scripts/test-oauth.mjs` now selects a fictional PDF for Azure and a text fixture only for the explicit local OCR profile. An earlier attempt used TXT against Azure and was correctly rejected; the test was made profile-aware instead of weakening the API's upload validation. The regression verifies original bytes, manual field review, audit, session refresh/logout and forbidden authentication shortcuts.

### Browser check

The local browser successfully signed in and displayed the new application title, domain cards with real persisted counts, existing DATEV dossier, configured Azure engines and Nova. Keycloak's existing local realm display name was updated without replacing the realm or users. Page tours omit DATEV-only steps outside banking.

## Runtime notes

Docker Hub initially timed out while resolving the Java runtime. A previously verified Java/Tesseract runtime was used for the first acceptance run. The official base subsequently downloaded successfully; the standard Java Dockerfile built, the API was recreated from that image, and all 93 live acceptance checks passed again. The final app does not depend on that temporary cache-build workaround.

The Mac's existing short-lived token refresh job was updated to the renamed repository path and confirmed running. This does not grant new Azure permissions or store an API key. Compose service/volume names, the Keycloak realm/client and Java/database identifiers retain their historical names deliberately to preserve existing data.

All long-running local application dependencies were observed running; PostgreSQL, Keycloak, Redis, ClamAV and Java reported healthy. `storage-init` exits successfully after setting volume ownership by design. The optional old OpenTelemetry container remains stopped unless its observability profile is explicitly started.

## Run

```bash
cd /Users/vietphung/git/document-intelligence-lab
node scripts/docker-azure.mjs start
```

Open `http://localhost:3000/vi`, choose a domain and create/open a dossier. For live acceptance:

```bash
TEST_MULTIDOMAIN=1 node scripts/test-oauth.mjs
TEST_WRITE=1 node scripts/test-oauth.mjs
```

Use `TEST_LOCAL_AI_UNAVAILABLE=1` only with a local profile that intentionally has no Azure model configured.

## Remaining boundaries

- Classification/field extraction rules are not a custom-trained insurance model.
- MiniLM embeddings are English-focused; ranking is not calibrated truth or a neural reranker.
- Uploaded fictional examples do not provide a representative labeled evaluation corpus for all layouts.
- Claims are not adjudicated; policy interpretation is a draft requiring qualified review.
- Domain filters are not security boundaries; server-side tenant/dossier authorization remains mandatory.
- No production deployment, Azure resource rename or automatic data purge was performed.
