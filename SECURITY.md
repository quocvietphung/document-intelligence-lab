# Security

This is local research software, not a certified financial or document-management product. The `master` branch is the maintained baseline; verify the exact commit and its checks before use.

## Report privately

Use the repository's **Security → Report a vulnerability** if private vulnerability reporting is enabled. Otherwise, open a public issue asking the maintainer for a private reporting channel **without including exploit details or sensitive data**. Do not upload documents, credentials, tokens or unredacted logs to an issue.

Include the affected commit, a minimal synthetic reproduction and the expected authorization/data boundary. Do not test against other users' deployments or data.

## Local deployment boundaries

- Docker's development Keycloak accounts and database passwords are deliberately public example credentials, not production secrets. Keep published ports on loopback; do not expose this realm to the Internet.
- Keep JWT issuer/audience/tenant and role checks enabled. Docling is an internal service with no published host port; app traffic must still pass the authenticated Java API.
- PDFs and extracted text are untrusted. Keep format/size/page limits, ClamAV scanning, timeouts and evidence guards enabled.
- The Docling profile disables remote pipeline calls and runs the parser on an internal Docker network. No Azure/Hugging Face inference API receives PDFs from this profile. Images/build dependencies may be downloaded before processing.
- Azure mode is a different, explicit configuration. Confirm data-processing permission and resource access before calling it. Tokens belong in ignored local files, never browser-public variables or screenshots.
- Follow the documented retention behavior. Stopping containers is not deletion; named volumes retain data. Do not publish volumes, dumps, intake receipts or processing manifests.

CI checks reduce risk; they do not prove the absence of vulnerabilities, undisclosed secrets or third-party copyright issues. If a credential is exposed, revoke/rotate it before considering history cleanup. Do not rewrite shared Git history without a coordinated recovery plan.

## Dependency review notes

At the local-Nova release review (2026-10-20), `npm audit --omit=dev` reported no advisories. Full audit still reported five high-severity entries along the **development-only** `eslint-config-next → fast-glob → micromatch → braces@3.0.3` chain ([upstream advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)); a compatible patched `braces` release was not available. `brace-expansion` was separately updated to its compatible patched release. Do not run lint against untrusted glob patterns or disable security checks to obtain a green badge. Recheck advisories and CI on the exact commit; this note is not a vulnerability waiver or a claim that container scans are clean.
