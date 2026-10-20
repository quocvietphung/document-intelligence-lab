# Local open-source document processing

This profile replaces document extraction with **Docling Serve CPU**, while retaining Java, PostgreSQL, Keycloak, Qdrant, the security queue and the existing PDF review UI. It does not install a new frontend, call a public demo service or replace Nova with a local LLM.

For **Docling plus local Nova**, use the combined [README local Docker walkthrough](../README.md#local-docker-with-nova). The commands on this page intentionally test document extraction alone.

The adapter uses the stable v1 wire format (`sources` with `kind: file`, and an explicit `inbody` target). Legacy `file_sources` examples do not match the pinned server's OpenAPI schema. The image is pinned by version and digest; review both when upgrading.

## Start

Install Git and Docker with Compose v2. Ensure at least **12 GiB free inside Docker's disk image**, not just free on the host: the parser image is about 4.4 GB, and app/test build caches need additional room. A full Docker disk can prevent PostgreSQL recovery and break sign-in. From the repository root:

```bash
mkdir -p .local/reference-pdfs
docker compose -f docker-compose.yml -f docker-compose.platform.yml \
  -f docker-compose.docling.yml up --build -d --wait --wait-timeout 360
```

If an Azure token-renewal helper is open, stop that helper with Ctrl+C first. Do not run two configurations concurrently. This command reuses the project's named volumes and recreates services whose configuration changed; it does not delete previous originals, reviews or accounts.

The pinned upstream CPU image is several GB and includes local models. Allow additional memory/disk beyond the base stack; the parser is limited to 3 GB RAM and two CPUs, with one Java request in flight. Actual memory and latency depend on documents/hardware. No GPU is required by this profile. If startup fails, inspect parser logs rather than bypassing the scanner or enabling network access for unreviewed models.

```bash
docker compose -f docker-compose.yml -f docker-compose.platform.yml \
  -f docker-compose.docling.yml ps --all
docker compose -f docker-compose.yml -f docker-compose.platform.yml \
  -f docker-compose.docling.yml logs --tail=50 docling
```

## Try a document

1. Open [the English workspace](http://localhost:3000/en) and sign in through Keycloak as described in the README.
2. Create a research dossier. Upload a permitted PDF/image through **Data Pipelines → Processing queue**, or prepare a private DATEV/Kaggle reference and import it from **Documents & review**.
3. Confirm **Docling** in processing settings. The durable queue scans the file before calling the internal parser.
4. Open **Result & PDF**. Verify the provider `docling`, page text, fields, tables and original currency. Successful extraction remains **awaiting human review**.
5. Try **AI Studio** for local retrieval. **Nova App guidance** remains available, but **Evidence analysis is unavailable without a configured generative model**. This profile must not be advertised as a fully local Nova chatbot.

The lab accepts PDF, PNG and JPEG, at most 3 MB, four PDF pages or 6 MP images. The bridge sends bytes, not URLs or original customer filenames; follows no redirects; rejects partial/oversized/ambiguous-page output; and does not silently fall back to Azure. Layout/table models provide structure; Java still performs transparent field mapping and validation. `docling-layout-tableformer` identifies the pipeline, not a custom trained payroll model or a measured accuracy. Missing confidence stays unknown.

Docling is not exposed on a host port and has no network egress. Temporary parser scratch files are on a bounded in-memory filesystem; source originals/results remain in the existing private storage/database. The parser image and app dependencies are downloaded during setup. Never mount your Azure CLI cache, documents directory or Docker socket into it.

## Verify the local model

To verify the real Java-to-model contract without changing your current app provider, run:

```bash
node scripts/test-docling-local.mjs
```

This builds a local test image from the existing Java Docker build stage, starts only Docling, generates a fictional one-page invoice with a table and checks the returned page/cells. No host Java/Maven, Azure inference, publisher PDF or database write is required. It is a runtime smoke test, not an accuracy benchmark or a full authenticated batch-workflow test. The parser remains running after the check; the disposable test container is removed automatically.

The helper checks available Docker disk space first and refuses to start with less than 12 GiB free. It does not automatically delete cache or data. Node.js 22+ is needed for this helper, as with the main Azure walkthrough.

The Java client explicitly uses HTTP/1.1 for the pinned Uvicorn server; h2c upgrade attempts are not supported by that server configuration.

## Stop or return to Azure

```bash
docker compose -f docker-compose.yml -f docker-compose.platform.yml \
  -f docker-compose.docling.yml stop
```

Keep volumes. To return to Azure, stop the parser service with that configuration, then follow the README's Azure helper. Stopped Docling containers can remain visible in Docker; their presence does not mean cloud inference is running.

## Research and contribution scope

Benchmark extraction field-by-field and table-by-table against independently checked labels. Keep provider/source/version separate. Old extractions are not automatically rerun or relabelled when changing provider, and same-file duplicate protection still applies. Use a new research dossier to compare a permitted source with another provider.

For local generative Nova, use the separate [local Docker walkthrough](../README.md#local-docker-with-nova), which layers Ollama after this Docling profile. Optional BGE/reranker adapters are documented in [AI integrations](AI_INTEGRATIONS.md); they are not installed by this profile. Do not change vector models in an existing collection without a separate versioned index and reindex plan. See [CONTRIBUTING](../CONTRIBUTING.md) and [third-party notices](../THIRD_PARTY_NOTICES.md).
