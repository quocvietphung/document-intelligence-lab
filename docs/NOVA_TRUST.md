# Nova: evidence, privacy and review

Nova has two intentionally separate modes:

- **App guidance:** local feature help, navigation links and page tours; no LLM call.
- **Evidence analysis:** Azure OpenAI through Java/LangChain4j, using the selected authorized dossier and read-only tools.

A greeting or configured-engine badge does not prove a model call succeeded. [Configure and verify local Azure access](AZURE_AI.md).

## Using Nova

Open the floating Nova button, choose a mode and type a question. Enter sends; Shift+Enter creates a new line. Expand the reading area for long answers, minimize the chat when inspecting a document, or use the adjacent guide button for a tour of the current page.

The controlled task library prepares editable prompts for:

1. Document/dossier summary.
2. Cross-document evidence comparison.
3. Explanation of inconsistencies.
4. Draft request for missing documents.
5. Reviewer evidence checklist.
6. German document terminology.
7. German–Vietnamese evidence summary.

Selecting a task prepares a draft; the user decides whether to send it. No tool sends an email, transfers money, approves a loan or settles a claim. Explicitly selecting a bilingual task produces two languages by design; ordinary interface labels follow the chosen locale.

## Read the evidence

A reply can expose source links and evidence by statement. Open the original page and compare its text/amounts before accepting a conclusion.

`SOURCE_LINKED` means the referenced source ID exists in the selected context. It is **not semantic verification, calibrated confidence or factual accuracy**. An exact PDF highlight is displayed only when supported by a unique text match; otherwise the viewer opens the page without pretending to identify an exact region.

Document field edits and reviewer confirmation are separate from the model answer. Net earnings and payout must not be substituted for each other. German source quotations, names and number formatting remain unchanged in every UI language.

## Feedback and reviewer tasks

- Report an incorrect amount, person, unsupported source or other issue.
- A correction request is an unsent draft. A subsequent answer receives a new immutable answer ID linked to the original; the old answer is retained.
- Confirm before creating a human-review task. A reviewer can claim, return, resolve or reopen it with a note and history.
- Completing a task is not a financial decision or blanket validation of the model.

## What leaves the device?

| Action | Destination / data |
| --- | --- |
| Open a page, tour or local guide | No Azure inference |
| Preview a prepared private PDF | Authenticated local document service |
| Confirm Azure document analysis | Selected file → Azure Document Intelligence |
| Send an evidence-analysis message | Question + permitted selected evidence/tool context → Azure OpenAI |
| Export a research bundle | Private browser download; not an automatic Azure upload |

The app does not silently upload the entire document library. Nevertheless, Azure mode is external processing: use fictional or explicitly permitted documents and review regional/privacy requirements.

## Storage and access

- Keycloak authenticates the user; API-audience JWT, role, tenant and dossier checks apply before access.
- Answer/feedback/task/feature/event records are held in PostgreSQL `lab_records` with verified tenant and dossier IDs.
- ADVISOR/REVIEWER/ADMIN can read/report; reviewer/admin roles control review transitions, and admin controls case-scoped AI availability.
- Original/revision answers and feedback are insert-only. Idempotency and version checks reject conflicting retries or stale writes.
- PDF originals use authenticated `no-store` requests; tokens are not put into document URLs.
- **Clear chat clears the visible conversation, not the audit/database history.** Answer, feedback, reference and task history has no automatic purge in this lab. Document retention is a separate worker policy.

## Monitoring limits

The review center reports observed answer duration, counts, feedback and source-link issues from a bounded set of stored records. It does not measure billed tokens/cost, global hallucination rate or customer time saved.

Prompt guards, scoped tools and source checks reduce specific risks; they are not a security certification. Reviewers remain responsible for checking the original evidence.

## Restart and history controls

Persistent deployments now keep Nova lifecycle metadata in PostgreSQL. Request IDs and cancellation tombstones survive API restarts; an expired lease becomes Interrupted rather than being retried. Cancellation does not prove a remote or local provider stopped. The operator can preview scoped old inspection/answer/feedback history with `scripts/retention-lab.mjs`; deletion requires explicit case confirmation and leaves an audit summary. Original documents, OCR corrections, reviewer tasks and reference datasets are outside that policy. Nothing is purged automatically. See [local recovery and retention](RELIABILITY_LAB.md).
