# Read-only banking evidence for document analysis

Credit Intelligence Lab is an **AI bank-document analysis app**, not a transactional bank. No payment features exist, including simulations. Inspired by the [Microsoft Java Banking Assistant sample](https://github.com/Azure-Samples/agent-openai-java-banking-assistant), but not affiliated with Microsoft or apoBank and not a complete implementation of that sample.

## Walkthrough

1. Start the local Docker stack using the [Azure integration runbook](AZURE_AI.md). Cloud services are optional and incur their own usage charges.
2. Open `http://localhost:3000/en`; sign in with the existing local synthetic advisor account.
3. Select a fictional case, then **Banking evidence** (Deutsch: **Bankbelege**; Tiếng Việt: **Chứng cứ ngân hàng**).
4. **Accounts:** inspect read-only practice/personal/reserve balances, computed from opening balances plus sample statement entries.
5. **Transactions:** filter by account, direction, counterparty/reference and dates. Inspect an entry or export precisely the filtered CSV. Monetary values use integer cents; spreadsheet formula-like text is escaped.
6. **Invoice evidence:** open a sample to inspect its source and linked statement entries. Missing links do not prove that an invoice is unpaid. An unverified supplier requires evidence review, not a fraud verdict.
7. **Ask Nova about this evidence:** opens an editable question; it does not send automatically. Nova can explain evidence but cannot create transactions or change balances.
8. **Documents & review:** the separate PDF/image upload and Azure/local extraction flow. Fixture invoice text is not OCR output from an uploaded document.
9. **Review & insights:** compare extracted payroll net/payout with sample salary amounts. Identity, period and authenticity still require manual verification.

## Mapping to the reference sample

| Reference concept | Included in this document-analysis lab |
| --- | --- |
| Account context | Tenant/case-scoped read-only snapshot and `bankAccounts` |
| Transaction reporting | Filters, details, CSV and `bankTransactions` |
| Invoice processing | Evidence inspection, statement-entry links and `bankInvoices` |
| Document Intelligence | Keyless Azure `prebuilt-layout`, extracted fields/tables, source review |
| Java/LangChain4j | Case and evidence tools bound to the verified selected case |
| Human oversight | Document-field review, source links and persisted review history |
| Payment execution / payment agents | **Excluded**, including mock payment preparation/confirmation |
| MCP server | Not implemented; these are local LangChain4j tools |

Base Docker uses a deterministic local fallback. The shared Azure profile can connect Nova through short-lived Entra authentication. Successful connectivity is not proof of representative OCR/LLM accuracy or regulated-bank production readiness.

## Data and isolation

- PostgreSQL table: `banking_lab(tenant, case_id, payload)`, composite key.
- Initial fixture: 3 account contexts, 11 statement entries, 3 suppliers and 3 invoice examples.
- References are non-routable DEMO identifiers; counterparties are fictional.
- First-read seeding is idempotent. Existing case versions, documents and authentication records are preserved.
- Subsequent reads do not modify balances, snapshot versions or transaction history.
- Tenant comes from the verified Keycloak JWT, never from a client body. Unknown/foreign cases return 404; customer roles cannot access the advisor workspace.
- Legacy payment fields/history remain for persisted-snapshot compatibility only; there are no callable mutation methods or UI actions.

## API

```text
GET /api/cases/{caseId}/banking
```

Next.js allows only GET for this namespace. Former payment POST paths return 404 through the proxy and are explicitly denied with 403 by Java for every authorized lab role. The old payment-order XML endpoint and download were removed.

## Verification

See [analysis-only verification](ANALYSIS_ONLY.md) for the current local regression results and browser screenshots. Earlier [platform verification](PLATFORM_VERIFICATION.md) contains historical checks that predate removal of mock payments; those checks are not current instructions.

Tests cover idempotent/persistent seeding, foreign-case isolation, balance arithmetic, read-only tool contracts, blocked legacy endpoints, preserved old snapshots, filtered CSV safety and complete EN/DE/VI labels.
