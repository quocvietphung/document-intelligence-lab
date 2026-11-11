# Azure AI Search configuration (AI-103 exercise 5, not deployed)

Four JSON files in the shapes the documentation describes, api-version **2026-04-01** (latest GA version listed on
learn.microsoft.com on 2026-11-11). Placeholders in angle brackets must be filled with existing resources; nothing here
creates a resource. Use `az login` and managed identities; do not add keys.

Order to create them (REST or portal): data source → skillset → index → indexer. The indexer runs the OCR skill on
normalized page images (`generateNormalizedImagePerPage`, PDF only) and the split skill on the extracted text.

Verified in the documentation read on 2026-11-11:
- Blob data source type `azureblob`; `dataToExtract` `contentAndMetadata` and `parsingMode` `default` (required with
  `imageAction`).
- OCR skill `#Microsoft.Skills.Vision.OcrSkill` on `/document/normalized_images/*`.
- Split skill `#Microsoft.Skills.Text.SplitSkill` with `textSplitMode` `pages`.

**Not verified** (do before a live run):
- The page-number field of normalized images, which the `page` index field needs for citations.
- The hybrid query body (search text plus `vectorQueries`). The Learn hybrid page returned 404 when read.
  This lab therefore sends a keyword query; hybrid search needs an embedding deployment (billable) and is a next step.

Check the files locally (no network): `python3 -m unittest tests.test_search -v`.
