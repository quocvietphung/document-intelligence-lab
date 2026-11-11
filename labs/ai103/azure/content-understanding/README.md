# Azure AI Content Understanding (AI-103 exercise 6, not run)

Documented facts (learn.microsoft.com, read 2026-11-11):
- GA api-version **2025-11-01**; preview **2026-06-01-preview** (for evaluation only).
- Analyze: `POST {endpoint}/contentunderstanding/analyzers/{analyzerId}:analyze?api-version=2025-11-01`. Body
  `inputs[]` with `url` or `data` (base64), plus `mimeType`. The response is `202` with an `Operation-Location`
  header; poll until `status` is `Succeeded`.
- Prebuilt analyzers include `prebuilt-documentSearch` (RAG ingestion), `prebuilt-layout`, `prebuilt-read`,
  `prebuilt-invoice`, `prebuilt-contract`, `prebuilt-imageSearch`, `prebuilt-audioSearch` and `prebuilt-callCenter`.
- Authentication: `Ocp-Apim-Subscription-Key` or Microsoft Entra ID (scope `https://cognitiveservices.azure.com/.default`).

**Corrections to the brief:**
- The documentation does not list `single-task` or `pro` analysis modes. `pro mode` is retired (2025-05-01-preview).
  The current option is **agentic mode** in the preview API (`config.workflow`), limited to document analyzers, one
  input per request, and about 400,000 tokens per minute per analyzer job. This lab does not use it.
- `prebuilt-documentAnalyzer`, `prebuilt-imageAnalyzer` and `prebuilt-audioAnalyzer` do not exist in the
  documentation. The earlier environment template named them; it now uses the documented names.

Check the request locally: `python3 -m unittest tests.test_content_understanding -v`.
