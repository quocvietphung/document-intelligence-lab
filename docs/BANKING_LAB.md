# Banking workbench: Java AI solution-engineering lab

Inspired by the [Microsoft Java Banking Assistant sample](https://github.com/Azure-Samples/agent-openai-java-banking-assistant), not affiliated with apoBank or Microsoft. This is a synthetic portfolio/interview lab, not a banking product or a complete implementation of that sample.

## Walkthrough

1. Start the existing Docker/Azure stack as described in [Azure runbook](AZURE_AI.md).
2. Open `http://localhost:3000/en`; sign in with the existing local synthetic advisor account.
3. Select a case, then **Banking lab**. Java initializes case-scoped mock records in PostgreSQL on first use (idempotently, without replacing existing data).
4. **Accounts:** inspect practice/personal/reserve balances calculated from opening balances plus movements.
5. **Transactions:** filter by account, direction, merchant/reference and date range; export the filtered CSV. Money is stored as integer cents. Spreadsheet formula-like text is escaped on export.
6. **Invoices & payments:** inspect the medical equipment sample. Explicitly check its source and recipient, then prepare a simulation. A reviewer/admin must separately confirm. Only a mock ledger debit is created; no bank, SEPA endpoint or payment network is called.
7. Inspect the already-paid invoice and unverified recipient: both are blocked. Retry confirmations do not double-debit. The audit records drafting and confirmation actors.
8. **Agent context:** open Nova with a prefilled question. The user sends it explicitly. Java exposes read-only account/transaction/invoice tools bound to the already-authorized case. No payment-writing tool is exposed to the model.
9. **Documents & review** remains the separate real Azure Document Intelligence upload/extraction flow. Mock invoice text is not described as OCR or uploaded evidence.

## Mapping to the sample

| Sample concept | This lab |
|---|---|
| Account service / account agent | Case-scoped account API, cards and read-only `bankAccounts` tool |
| Transaction reporting | Search/filter/export and read-only `bankTransactions` tool |
| Invoice/payment task | Explicit two-stage, role-checked simulation; duplicate/beneficiary/balance checks |
| Document Intelligence | Existing keyless Azure `prebuilt-layout` upload with provenance and source review |
| Java/LangChain4j tools | Existing case tools plus three read-only banking tools |
| Human oversight | Source checkbox, reviewer confirmation, version check, persisted audit |
| Microagents/MCP | Not implemented; these tools are local LangChain4j tools, not an MCP server |

Base Docker Compose has a deterministic local demo. The explicit shared Azure profile now connects Nova to `gpt-4.1-mini` with Entra and read-only tools. Live connectivity and synthetic document Q&A are verified; representative answer quality and multi-agent routing still require their own evaluation. No autonomous payment workflow or credit decisions are offered.

## Data and isolation

- New table: `banking_lab(tenant, case_id, payload)` with a composite primary key.
- Initial sample: 3 accounts, 11 movements, 3 beneficiaries, 3 invoice scenarios per selected case.
- Non-routable `DEMO` account references, fictitious counterparties, no real credentials or customer data.
- Seed operations are idempotent. Existing credit-case versions, documents, login database and uploaded sources are unchanged.
- Writes require the persistent Java case store and configured write permission. A row lock serializes mutations. Optimistic versions reject stale requests. The draft request ID is idempotent; confirmation retries return the stored simulated result.
- Tenant comes from the validated Keycloak JWT, never a client request body. Unknown/foreign case IDs return 404. Customer roles cannot access the advisor workspace.

## API

```text
GET  /api/cases/{caseId}/banking
POST /api/cases/{caseId}/banking/payments
POST /api/cases/{caseId}/banking/payments/{paymentId}/confirm
```

The Next.js authenticated proxy only allows these explicit paths/methods. Java permits draft creation for ADVISOR/ADMIN and confirmation for REVIEWER/ADMIN. This is role gating, not enforced four-eyes separation: the local demo user holds both roles. Production maker-checker requires separate users plus a rule rejecting self-approval.

## Verification

Java tests cover persistent/idempotent seed, cross-tenant/case isolation, source confirmation, balance math, duplicate drafts/invoices, stale versions, exactly one debit and read-only tools. Frontend tests cover payload validation, cent arithmetic, CSV escaping, proxy routing and complete EN/DE/VI labels. See [verification record](PLATFORM_VERIFICATION.md) for executed checks.

Run the browser walkthrough on synthetic records only. None of these fixtures establish suitability, financial accuracy or production readiness for a regulated bank.
