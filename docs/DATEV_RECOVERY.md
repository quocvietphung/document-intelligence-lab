# DATEV queue recovery — 13 October 2026

## Incident and cause

Case `CR-80ee7bb3-b39` contained a failed job for `datev-lodas-2025-robert-muster.pdf`, created at 00:18 Europe/Berlin. The job stopped after three attempts with `ANALYSIS_HTTP_503`. ClamAV reported clean.

The local Azure token had expired at 23:38 the previous evening; the host token-renewal helper was no longer running. Java's credential failure confirmed this cause. Docker could remain healthy while Azure inference was unavailable: container health is not evidence of a valid cloud credential.

No API key, extra Azure resource or new RBAC permission was needed. The existing Azure CLI session supplied a fresh short-lived token.

## Repair

- The host's existing `scripts/docker-azure.mjs watch` now runs in a macOS user LaunchAgent, `dev.creditlab.azure-token-refresh`, rather than depending on an open terminal. It renews every five minutes and starts in the user's login session.
- The token file is private, ignored by Git/builds, and read-only inside Java's container. The CLI refresh-token cache is not mounted. This remains a local developer bridge, not Managed Identity; Azure runtime identity is unchanged.
- Credential failures, access denial and service failures now have separate safe error codes and EN/DE/VI explanations. Old generic failures are not relabelled retrospectively.
- The pipeline offers **Retry DATEV reference** only for the two approved Robert/Melanie filenames with matching SHA-256 hashes. Java checks both stored metadata and actual object bytes; filename alone is insufficient.
- The user must confirm the provider and new processing job. The server enforces tenant/case/role scope, retention, quotas, duplicate protection and a new malware scan. Other documents, security-blocked jobs, expired objects and active/completed duplicates cannot use this recovery action.
- Retrying creates a new job. The old failed job remains unchanged in history.

## Verified result

| Check | Observed result |
| --- | --- |
| Old job | `job-ee7c77cc-6ee4-4c6f-8209-15f22aaa10fb` remains failed |
| New job | `job-658bd916-9c8d-4c12-9cf1-9e72a4c2c19f` completed on attempt 1 |
| New evidence | `doc-26c17974-9831-4c54-a45b-86e1f96e04d2` |
| Provider/model | Actual Azure Document Intelligence / `prebuilt-layout` |
| Scanner | ClamAV INSTREAM, clean |
| PDF viewer | Authenticated original rendered, page 1/1 at 100% |
| Tables | 9 extracted tables |
| Net income | `Netto-Verdienst: 2.967,11` |
| Payout | `Auszahlungsbetrag: 2.882,11` |
| Review | `HUMAN_REVIEW`; no automatic field confirmation |

![Successful new Robert extraction with the old failure retained](screenshots/local-datev-recovery-2026-10-13.jpg)

The screenshot shows pipeline controls/status, not a redistributed DATEV PDF. Only the previously approved fictional Robert page was reprocessed. Original publisher-owned files remain private. This single result is not a general OCR or LLM accuracy claim.

## Tests and boundaries

- Frontend: 106 passing tests, lint and TypeScript checks; Docker production build passed.
- Java: 134 passed, one additional opt-in live test skipped, zero failures/errors.
- Rebuilt local stack: 29 OAuth/reference checks passed (PKCE, token refresh/logout, tenant/role boundaries, private byte-identical DATEV samples, old public URLs blocked).
- Recovery regressions cover unauthorized/foreign cases, wrong methods, expired/security-blocked jobs, unknown filenames and changed bytes, safe error mapping, localized consent and browser proxy forwarding.
- Actual Azure inference was verified separately through the browser confirmation, not inferred from skipped live unit tests.

No cloud deployment, VM start, new credentials/permissions, Git commit or push was performed. Other earlier UI edits and stored evidence remain intact. A revoked Azure CLI session still requires `az login`; a background helper cannot grant itself permission. See [Azure AI runbook](AZURE_AI.md#background-token-renewal-on-this-mac).
