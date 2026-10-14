# Local Docker UI and AI audit — 12 October 2026

For the later DATEV-only library and selectable feature tours, see [13 October follow-up](DATEV_AND_FEATURE_TOURS.md). The older PDF screenshots and integration records below describe the historical audit, not current offered payroll samples.

## Scope

Verified at `http://localhost:3000/en` using the existing nine-service Docker stack: Next.js, Java API, Keycloak, two PostgreSQL databases, Qdrant, Redis, ClamAV and OTLP collector. `storage-init` completed with exit code 0. Existing volumes were retained.

The Azure VM was not started; no infrastructure or Vercel release was created. Local Azure AI uses a refreshed short-lived Entra token-file bridge, not VM Managed Identity. No API key was added. Only fictional test records and the previously approved fictional DATEV pages were sent to the existing shared AI services.

## Improvements

- Rebuilt the outdated web container so the running local app matches the new source.
- Added translated overview entry points for payroll analysis, evidence search and Nova; document-provider configuration is not described as validated accuracy or guaranteed connectivity.
- Added meaningful Documents, Banking and Activity headings/subtitles.
- Kept both the case and section when switching EN/DE/VI. Only allowlisted sections and case IDs are copied; OAuth codes/state and arbitrary URLs are excluded.
- Distinguished unavailable backend, expired session and permission denial, with recovery actions.
- Isolated OAuth test cookies by origin and added a final check count.
- Excluded Terraform state/plans/operator variables, provider downloads and private local/Vercel files from Docker build context. The final context was about 5 MB rather than 235 MB.
- Updated README with the actual AI implementations, their limits and fresh local screenshots. Third-party PDFs remain outside Git/public assets.

## Automated results

| Check | Result |
| --- | --- |
| Frontend unit/regression tests | **91 passed**, 18 files after the Nova keyboard/tour follow-up (77 passed in the original audit) |
| Lint | Passed, no warnings |
| TypeScript | Passed |
| Next.js production build | Passed locally and in the final Docker web image |
| Java Maven verification | **126 passed; 1 opt-in live test skipped**, no failures/errors |
| Live local OAuth / reliability / AI / banking integration | **77 checks passed** after replacing the web container |
| Final-image OAuth / API smoke test | **22 checks passed**, no additional Azure calls |
| Patch whitespace checks | Passed |

The skipped Java test is not presented as an Azure pass: the independently executed integration actually called Azure.

```bash
# Keep the existing authorized local Azure profile running:
node scripts/docker-azure.mjs watch
# In another terminal, from the repository root:
TEST_PLATFORM=1 TEST_DATEV=1 TEST_BANKING=1 TEST_CHAT=azure node scripts/test-oauth.mjs
```

Prepare the two private reference pages as described in [PUBLIC_PAYROLL_TESTS.md](PUBLIC_PAYROLL_TESTS.md). The integration creates fictional local cases and consumes Azure calls; do not use real customer documents.

### Boundaries exercised

- Keycloak PKCE discovery/login/code exchange; tenant, audience and roles; Java and Next.js authenticated requests.
- Anonymous/malformed-token rejection, disabled password grant, refresh/logout and authorization-code replay prevention.
- Persistent case creation, original-PDF SHA-256 round trips, field review and audit updates.
- ONNX MiniLM + Qdrant + BM25 search; policy sources returned; instruction override rejected.
- Queued upload returned 202, rejected duplicates and completed actual ClamAV + Azure extraction. Harmless EICAR content was blocked through queued and synchronous paths.
- DATEV Robert: **9 tables / 185 cells**, net `2.967,11`, payout `2.882,11`. Melanie: **11 tables / 214 cells**, net `4.212,90`, payout `3.069,93`. The originals remained private and byte-identical.
- Nova delivered an actual `azure-entra` stream, kept net/payout separate and supplied named document/page source IDs.
- Fictional banking seed, human-checked simulation, duplicate prevention and idempotency. No real payment network called.
- Forty-reference synthetic-text evaluation: precision **100%**, recall **90.5%**, field F1 **95.0%**, retrieval Recall@5 **54.7%**, two quarantined injection samples.

Final integration cases: `CR-1faad568-7f6` (reliability), `CR-54a6917f-5f9` (banking), `CR-b7aa1e5a-336` (DATEV). The browser walkthrough used `CR-39183694-98c` and an app-generated payroll fixture.

## Browser and screenshot provenance

Normal browser controls exercised sign-in, case creation/search, synthetic PDF upload, original rendering, zoom 100 → 125 → 100%, human confirmation and EN → DE → VI → EN navigation retaining the same case/section. The AI Studio returned actual Qdrant passages; Nova read `3200 EUR`, `Muster GmbH`, `01.10.2026` from the uploaded PDF and labelled its Azure response. The quality evaluation was started from the UI rather than displaying prefilled scores. All nine sections were opened. A reviewer note was saved and appeared in Operations; the workflow audit showed case creation, extraction and human confirmation. A banking reference filter returned one movement; the downloaded CSV contained exactly a header and that one movement.

README screenshots are captures of the rebuilt authenticated local app, not mockups. The PDF image uses the app's own generated fictional document, not a redistributed DATEV page. No credentials or real financial records are included. Desktop/mobile checks are browser-viewport checks, not physical-device certification.

The narrow viewport had no document-level horizontal overflow; its menu opened all nine sections and returned to the same selected case. A deliberate local Java-API stop produced the new backend-unavailable message. This exposed and fixed an incorrect simultaneous “no cases match” hint; the empty hint is now suppressed on service errors. Java was started again, returned health `UP`, and the same version-2 case/PDF review was recovered by Refresh. No volumes were removed.

## Remaining limits

Synthetic-text results do not establish OCR or LLM accuracy. MiniLM is English-focused; German/Vietnamese retrieval needs separate representative evaluation. Routing, reranking and lexical support are rules/heuristics; valid source IDs do not prove truth. Amount-only reconciliation does not verify identity, period or authenticity. No exhaustive accessibility certification or independent security assessment is claimed. The source and screenshots remain local until a separately requested commit/release.

## Nova keyboard and onboarding follow-up — 12 October 2026

- Shared live/demo composer: Enter submits, Shift+Enter inserts a newline; empty/disabled input, held Enter, IME composition and Safari key code 229 do not submit accidentally.
- Six-step EN/DE/VI walkthrough opens when the authenticated workspace has a case; it is not reset by token refresh, case refresh or a saved version change within the mounted workspace. A page reload or a new login starts a new in-memory welcome cycle.
- The header's Tips & tour button reopens guidance. The mounted chat and unsent draft are preserved while the tour is shown; controls remain inside the floating non-modal widget.
- Tour links are allowlisted workspace destinations. Navigation does not automatically upload, extract, evaluate, execute an AI tool or write records. No preferences or tour state are sent to Azure.
- Browser checks: explicit local logout/login; tour auto-open; Back/Next through all six steps; finish/skip; Documents link; Enter to local app help; Shift+Enter newline; blank composer disabled; replay with an unsent draft retained; English/German/Vietnamese tour rendering and Vietnamese Enter submission; narrow viewport with no page overflow and fully visible Next/Back controls.
- Fixed two issues found during browser testing: footer navigation could be clipped, and the next step could retain the previous step's scroll offset. The final image keeps the footer visible and resets the tour body on step changes; final browser DOM confirmed scroll offset `0` for the new step.
- Final checks: **91 frontend tests passed**, lint and TypeScript passed, Docker web production build passed, **22 OAuth/API checks passed** against the final image. Java/services were not changed or rebuilt in this follow-up. Existing volumes and the deallocated Azure VM were untouched.
- New screenshot: `screenshots/local-nova-tour-2026-10-12.jpg`. No new Azure inference calls were made for these tour/keyboard checks; the app-guide response explicitly reports its local mode. IME edge cases are automated logic checks, not a physical-keyboard certification.
