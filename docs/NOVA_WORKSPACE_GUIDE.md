# Nova workspace guide and DATEV reference library

Feature branch: `codex/nova-workspace-datev`. No master/develop merge or production promotion is part of this change.

## Product help, not arbitrary browser control

`services/credit-api/src/main/resources/nova-features.json` is the shared catalog for the Next.js widget and Java/LangChain4j tools. It covers overview, studio, documents, pipeline, controls, banking, evaluation, operations and audit in EN/DE/VI.

User-authored help requests produce guided cards locally; case-evidence questions still use the existing Java/Azure route. Clear provenance labels distinguish the guide, synthetic public fixtures and actual Azure responses. Read-only tools are invoked by user clicks, not by executing provider-generated JavaScript or following document instructions. No arbitrary URL, write/delete/payment tool is exposed. Case IDs, response shapes and identity are checked by the existing authenticated endpoints.

The widget can inspect case summary, document fields, activity, agents, pipeline jobs, reconciliation, evaluations, operations and mock banking. Evidence search uses `/api/cases/{id}/platform/search`; no new model or public Azure endpoint is introduced. Empty evaluations remain empty, rather than fabricated accuracy.

## Private official payroll references

Source: [DATEV LODAS 2025](https://www.datev.de/content/dam/markenassets/themen-und-produktgruppen/zielgruppen/zielgruppenuebergreifend/shop-assets/personalwirtschaft/lodas-musterauswertung-2025-deutsch.pdf), publisher pages 2 and 3. Fictional Robert-Muster and Melanie-Muster. Historical December 2025 examples are not current tax/payroll advice; DATEV is not a universal legal layout requirement.

Self-made PDF fixtures are no longer offered by the payroll library. They remain only as baseline/regression/demo assets; existing uploaded evidence is not overwritten or deleted. The official library keeps net earnings and payout distinct and labels manually recorded reference values as references, not AI results.

1. Download the source privately and follow `docs/PUBLIC_PAYROLL_TESTS.md` to prepare the two pages.
2. Compose mounts `.local/reference-pdfs/` read-only, outside the Docker build context.
3. `/api/payroll-references` verifies the bearer through the Java case-reader endpoint before showing availability or PDF bytes. Filenames are fixed/allowlisted. Responses are private, `no-store`, `nosniff`. `next.config.ts` explicitly excludes `.local/**/*` from this route's output trace; a local build with prepared references verified that no private PDFs enter the deployment manifest.
4. Public demo mode fails closed; only links to the publisher are shown, never private PDFs.
5. Preview locally, select Import, read the provider/destination notice and confirm. The import creates a durable job and opens the pipeline; extraction runs in the Java worker, not a long browser/proxy request. Azure mode sends only that page; a human must verify extraction afterward.

The two private pages were previously approved by the owner for Azure tests; no real employee documents or extra internet payroll records are collected. No third-party PDF is committed or hosted publicly.

## Checks

Frontend tests cover nine-section localization/deep links, bounded read tools, synthetic/live distinction, no fabricated benchmarks, unknown actions, private DATEV auth and public fail-closed behaviour. Java tests cover the catalog tools and unsupported IDs. The existing OAuth smoke test additionally checks private reference availability and byte-identical `no-store` previews before extraction.

Browser verification must cover app help → in-chat read/search → section navigation, minimize/reopen, private preview → cancel/confirm import → Azure field extraction → human-review state. Two official samples establish connectivity and a limited extraction check, not a representative OCR accuracy benchmark.

## Verified 12 October 2026

- 59 frontend tests passed; lint, typecheck and Next.js production build passed.
- Maven: 120 tests discovered, 119 passed, 1 opt-in live-provider test skipped, zero failures/errors. Docker Java and web images built; Java used the existing trusted local runtime after a registry timeout.
- `TEST_DATEV=1 TEST_CHAT=azure node scripts/test-oauth.mjs` passed: private preview/auth/no-store/byte identity, real Azure extraction of both pages, separate net/payout fields, and named Nova sources. Reference test case: `CR-b3e1a3fd-918`.
- Browser: app guide, real Qdrant search inside Nova, section links, private PDF preview and cancel-before-send verified. Real Azure Nova listed all nine app sections through the Java catalog tools; its internal links navigated correctly. The widget fit a 390×844 viewport, minimized/reopened without losing replies, and had no console errors.
- A browser import exposed the old 45-second synchronous proxy timeout. DATEV import now queues a durable job and opens the pipeline. The revised UI flow completed for Melanie in `CR-80ee7bb3-b39`: ClamAV passed, 11 layout tables extracted, net `4.212,90` and payout `3.069,93`, status still human review. Existing Robert evidence was preserved.

Not included: production banking certification, a representative accuracy benchmark, redistribution rights for DATEV, autonomous write tools, or a master/develop merge. Known base-image/dependency security findings from earlier work are not resolved by this feature branch.
