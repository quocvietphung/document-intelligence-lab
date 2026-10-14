# Document-only workspace

Normal Docker requires Keycloak authentication and works from originals uploaded to the selected, tenant-authorized case.

- No automatic case, bank-account, transaction, invoice or balance fixtures are seeded.
- Historical placeholder documents without originals are excluded from live evidence and RAG.
- Statements and invoices remain empty until actual originals are analyzed.
- Nova returns an explicit service error when Azure is unavailable; no canned financial answer substitutes for inference.
- Research shows extracted fields, tables, provider and review state from originals. OCR confidence is not measured accuracy; there are no fixed benchmark percentages in this workspace.
- Official fictional DATEV PDFs remain available for authenticated preview and explicit import/analysis. Reference amounts are not extraction results.
- Existing uploaded PDFs, audit entries, database records and Docker volumes are retained. Legacy fixture records are not used as live evidence.

Offline test fixtures remain for regression coverage. Experimental benchmark endpoints are restricted to the explicit `research-fixtures` Spring profile; the old evaluation endpoint is disabled. Do not enable that profile in the normal document workspace.

Human confirmation is still required. No payment service, automatic lending decision or production-compliance claim is added.

## Local verification — 14 October 2026

- Frontend: lint/typecheck and 183 tests pass; Docker Next.js production build passes.
- Java: 161 tests, zero failures/errors, one skipped live-provider test.
- Authenticated web/API: 35 OAuth and document-only checks pass, including original PDF bytes, private no-store downloads, tenant isolation, empty banking fixtures, absent fixed scores and disabled experimental endpoints.
- Browser: existing Azure-analyzed DATEV original renders with its fields; statement/invoice page shows an empty state when no originals exist. No new PDF was sent to Azure during this verification.
- Docker: web and Java rebuilt locally; persistent PostgreSQL, Keycloak, Qdrant, Redis, ClamAV and telemetry services preserved. No cloud rollout or branch merge.

Previous research-comparison screenshots in historical audit documents describe the earlier interface, not the current document-only workspace.
