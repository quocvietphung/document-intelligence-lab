# Contributing

Document Intelligence Lab is an MIT-licensed research application. Contributions should improve document extraction, traceable retrieval, evaluation or human review, without adding payments or automated financial decisions.

## Start locally

Follow the [README](README.md) for Docker, Keycloak and Azure configuration. The [local Docling guide](docs/LOCAL_DOCUMENT_AI.md) runs extraction without an Azure account. It does not provide a local generative replacement for Nova.

Use a `feature/short-description` branch from `develop`. Keep pull requests focused; retain the current Java/Next.js directory structure and reuse existing providers, validation and UI components. Do not include unrelated infrastructure or personal configuration changes.

## Before opening a pull request

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
node --test scripts/docker-azure-config.test.mjs
node --test scripts/check-public-source.test.mjs
node scripts/check-public-source.mjs
mvn --batch-mode -f services/credit-api/pom.xml verify
```

Unit and contract tests use synthetic fixtures and do not call Azure. Live scripts explicitly marked `TEST_*` can create local records and make billable Azure requests: read their prerequisites and use only documents you are permitted to process. Never disable Keycloak or ClamAV to make an acceptance check pass.

For Docling provider changes, also run `node scripts/test-docling-local.mjs`. This explicit local model smoke test requires Docker and downloads the pinned parser/test-build dependencies, but does not send a PDF to Azure or change the existing app provider.

For provider changes, test missing configuration, unavailable services, malformed results, document limits, correct page attribution, original currency and unknown confidence. Distinguish contract fixtures from real inference tests. Include model/provider and dependency versions with benchmark results; report sample size and hardware rather than claiming universal accuracy.

## Documents, models and screenshots

- Contribute code you have the right to license under MIT; retain third-party notices.
- Do not commit customer documents, downloaded DATEV/Kaggle PDFs, model weights, database dumps, token files, private keys, Terraform state or personal `.env` files.
- Keep third-party references under ignored `.local/` paths. A dataset uploader's license claim does not independently prove permission over the underlying publisher's work.
- Small self-authored fictional fixtures may live under `services/credit-api/src/test/resources/`. State their origin and purpose; never pass them off as real transactions or held-out evaluation data.
- Use your own or explicitly permitted material for screenshots. Redact names, filenames, identifiers and secrets where needed. A public sample PDF is not automatically licensed for redistribution in a screenshot.
- Model code and weights have separate licenses. Do not describe all Hugging Face models as freely redistributable or hosted inference as free.

See [third-party boundaries](THIRD_PARTY_NOTICES.md) and [security reporting](SECURITY.md). Do not post vulnerability details, access tokens, original PDFs or unredacted logs in public issues.

## Review expectations

Explain the user problem, implementation, tests and limitations. For UI changes, include English screenshots made with permitted fictional data, and check German/Vietnamese translations. Keep AI, deterministic rules and human verification visibly distinct. A successful extraction never implies human approval or measured accuracy.

Maintainer review and passing CI are required before merging. Contributions are offered under this repository's MIT license; external assets retain their own terms.
