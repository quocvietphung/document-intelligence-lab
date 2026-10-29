# Document Evidence Lab

Local PDF parsing, deterministic validation and traceable evidence for document AI experiments. Part of [Document Intelligence Lab](https://github.com/quocvietphung/document-intelligence-lab).

**Published alpha:** [document-evidence-lab 0.1.0a1 on PyPI](https://pypi.org/project/document-evidence-lab/0.1.0a1/) · [release source](https://github.com/quocvietphung/document-intelligence-lab/tree/python-v0.1.0a1).

**Source/wheel preview: 0.2.0a1.** The structural inspection and local grounding APIs below are in the repository and preview wheel; they are not in the published `0.1.0a1`. No new PyPI release is published by a normal branch push.

The **Python library runs without Java, Docker, an Azure account or an LLM**. It adds evidence checks around Docling rather than replacing Docling's parser. The optional SDK connects to the existing Java platform for authenticated workflows and audit history.

## Install

Use Python 3.10 or newer; check `python3 --version` and choose a supported interpreter if needed. Create a virtual environment and install the published alpha with the optional parser:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install 'document-evidence-lab[docling]==0.1.0a1'
```

On Windows PowerShell, activate with `.venv\Scripts\Activate.ps1` instead. For only the dependency-free validation core and authenticated SDK, use this install command in the environment:

```bash
python -m pip install 'document-evidence-lab==0.1.0a1'
```

Installing the extra does not itself authorize a model download. Neither variant bundles models or publisher PDFs, nor starts Nova or the web UI. The distribution name is `document-evidence-lab`, the import is `document_evidence`, and the CLI is `document-evidence`. This is research software; alpha releases are not production certifications.

### Install from source

```bash
git clone https://github.com/quocvietphung/document-intelligence-lab.git
cd document-intelligence-lab
python3 -m venv .venv
source .venv/bin/activate
python -m pip install './python[docling]'
```

Use Python 3.10 or newer. On Windows, activate with `.venv\Scripts\Activate.ps1`. `pip install ./python` installs only the lightweight core and SDK; it does not install Docling or download models.

## Inspect native tags and exact PDF locations

Install the source preview's optional inspection dependencies and a local Tesseract binary. This path loads no Docling or LLM model:

```bash
python -m pip install './python[inspection]'
# macOS; on Ubuntu use: sudo apt-get install tesseract-ocr
brew install tesseract
tesseract --list-langs

document-evidence services/credit-api/src/test/resources/evidence/structure-regression.pdf --tags-only
document-evidence services/credit-api/src/test/resources/evidence/evidence-inspection-regression.pdf \
  --ground 'Total: $500' --page 2 --no-ocr --output private-locations.json
document-evidence services/credit-api/src/test/resources/evidence/scanned-skew-regression.pdf \
  --ground 'Total: $500' --page 2 --output private-scan-locations.json
```

Use the installed language codes with `--ocr-language eng+deu` after installing the corresponding Tesseract packs. Values, context and output JSON can be private; existing files are never overwritten. `--no-deskew` disables Hough-line correction. `--no-ocr` never falls back to an OCR or cloud service.

```python
from document_evidence import ground_pdf, read_pdf_structure

tags = read_pdf_structure("document.pdf")
result = ground_pdf("document.pdf", "Total: $500", page=1)
print(result.status)  # matched, ambiguous, not-found, or an explicit candidate selection
for candidate in result.candidates:
    print(candidate.id, candidate.bbox, candidate.method)

# A UI/user may select one recorded candidate; a duplicate is never chosen silently.
# selected = ground_pdf("document.pdf", "Total: $500", page=1,
#                       occurrence_id=result.candidates[2].id)
```

- Native tags retain raw/mapped roles, hierarchy, page/MCID references and recorded table scope/header attributes. They remain separate from layout inferred by Docling. Tag presence is not PDF/UA or WCAG certification.
- Native glyph boxes use PDFium's page-to-device transform, including native rotation and crop offsets. Coordinates are normalized against the **original displayed page**, top-left, as stated by `coordinate_space`.
- Image-only pages, and mixed pages without an exact native-text match for the requested value, may use the local Tesseract fallback. Reliable near-horizontal Hough lines may support correction within ±12°; OCR polygons are inverse-projected to the original image. Weak/inconsistent line evidence leaves the scan unchanged. OCR may try clockwise 0°/90°/180°/270° corrections; polygons are mapped back to the unchanged original. Auto mode stops at the first orientation matching the exact requested text, so it is a candidate, not a general orientation guarantee. Pass `orientation="90"` or CLI `--orientation 90` to choose explicitly; `"0"` disables right-angle trials.
- Matching changes whitespace only. It preserves currencies, separators and digits; a missing or ambiguous value stays unresolved. Candidate identity is scoped to the PDF hash, extraction method and offsets; engine versions are retained. Pin versions when comparing runs.
- Every result says `text-match-only` and requires human review. Tesseract confidence is a recognition signal, not accuracy. A match can still reproduce incorrect hidden text/OCR. Inspect the original crop; no PDF or saved answer is edited.

The included PDFs are self-authored regression examples: native repeated values/90° metadata rotation, a tagged two-column page with deliberately different paint order, and two image-only scans (upright/4°). They are not publisher documents or valid PDF/UA exemplars. See [inspection example](examples/inspect_pdf.py).

### Compare independent OCR observations

`inspect_evidence` adds a separate Tesseract crop observation to the source candidates. Supply the exact stored provider bounds and page dimensions; rotated or mismatched provider geometry abstains. The observations are never merged into a corrected value:

```python
from document_evidence import inspect_evidence

receipt = inspect_evidence("document.pdf", "8,500", page=1,
    recorded_text="8,500", recorded_bbox=(0.77, 0.306, 0.825, 0.323),
    recorded_page_size=(600, 800))
print(receipt["comparison"]["status"])  # DIFFERENT, NOT_COMPARABLE, AGREEMENT_NOT_VERIFIED
```

These coordinates are an example for the repository's `structure-regression.pdf`; use the actual source geometry for other files. The receipt contains private text and a source crop, plus engine and implementation hashes. Inspect both readings; disagreement does not identify which one is wrong. The Docker workspace uses this same library in its existing offline ETL worker. No PDF, saved answer or human approval is changed.

For the bounded synthetic location benchmark, see the root README's **Local evidence quality workflow**. It reports missed cases and separates native text, scan, mixed-page and visual-rotation groups. Its generated labels are not human-approved business ground truth.

## Preserve layout and reading order with Docling

Install both extras to use parsing and inspection: `python -m pip install './python[docling,inspection]'`.

```python
from document_evidence import DoclingReader, validate_structure

document = DoclingReader().read("document.pdf")  # uses already prepared local weights
print(document.pages[0].reading_order_method)
print(document.pages[0].text)  # body-tree order, followed by explicitly unplaced content
print(validate_structure(document).to_dict())
```

`document.structure` preserves the recorded body hierarchy and semantic labels; `native_structure` inspects the source PDF's own tags. Headings/lists/tables and table-cell spans/header flags survive normalization. Exact cell sources have their own IDs and optional boxes. Missing, cyclic, duplicated or external body references never become a trusted reading order. Partial order and absent/uninspected native tags are findings, not guessed success. `validate_document` retains its original checks; `validate_structure` is a separate opt-in report. Both always require human review.

## Read a local PDF

```python
from document_evidence import DoclingReader, validate_document

# First use: explicitly permit downloading Docling's model weights.
document = DoclingReader(allow_model_download=True, timeout_seconds=900).read("invoice.pdf")
report = validate_document(document, required_labels=("Invoice no",))

print(document.pages[0].text)
print(report.to_dict())
```

First preparation caches layout, table and RapidOCR Torch weights, including OCR weights that a text-only invoice might not exercise. Later, `DoclingReader().read("invoice.pdf")` uses the prepared Docling model directory with Hugging Face offline mode and a DNS/socket audit guard in the conversion child process. Missing weights fail; there is no cloud fallback. This is an application safeguard, not an OS sandbox. Use `artifacts_path="/path/to/prepared/models"` for a separately prepared directory. Remote OCR/plugins are disabled. Initial preparation may need the explicit 900-second timeout; normal reads default to 180 seconds. Downloads require internet and disk space; local inference uses CPU/RAM, not a paid API. Test the OCR recognizer against your document language; counts and confidence are not accuracy guarantees.

```bash
document-evidence invoice.pdf --allow-model-download --timeout 900 --output private-result.json
```

The command refuses to overwrite an existing output file. The JSON contains document text: keep it private. Conversion runs in a short-lived Python child process for a bounded timeout and offline settings, **not** in a server or security sandbox. Defaults: unencrypted PDF, four pages, 3 MB, 180-second timeout. This standalone path has **no ClamAV, authentication, queue or durable audit store**; use only trusted/permitted PDFs, or use the Java workflow when those controls are required.

## Check amounts and evidence without Docling

```python
from document_evidence import normalize_money, validate_citations

result = normalize_money("2967,11 EUR")
assert str(result.amount) == "2967.11"
assert result.currency == "EUR"

answer = validate_citations("Invoice 51109301 [document:p1].", ["document:p1"])
```

Supported currency codes are EUR, INR, USD and GBP; ambiguous separators and unknown/mixed currencies remain findings. Source strings are unchanged. `validate_citations` checks source IDs, not whether a statement is factually supported. `check_evidence(document, source_id, quote, value="...")` adds exact quote/value containment. Neither check understands meaning or replaces human review.

Normalized results contain a SHA-256 document identity, page-bound source IDs, optional bounding boxes, table cells/spans and unknown confidence represented by `None`. These IDs identify this conversion; they are **not** interchangeable with Java dossier IDs. No human approval is inferred.

## Optional Java SDK

The core PyPI install includes the SDK; Docling is not needed for API access. Start the Java/Docker platform separately before using it.

```python
import os
from document_evidence.client import PlatformClient

client = PlatformClient("http://localhost:8081", token=lambda: os.environ["LAB_ACCESS_TOKEN"])
workflow = client.workflow(os.environ["LAB_CASE_ID"])
```

Supply a Keycloak **access token**, not an Azure token or a password. The token callback can supply refreshed credentials; the SDK does not log in, store passwords or refresh automatically. Java enforces audience, tenant and roles. The client refuses redirects and plaintext remote origins. It does not invoke Nova implicitly.

Read methods: `list_cases`, `get_case`, `workflow`, `trust`, `audit`, `batches`. `submit_pdf(case_id, path, consent=True, request_id="stable-uuid")` explicitly uploads to the existing scanned batch queue. Reuse the same UUID and metadata when investigating an uncertain submission; there is no automatic retry. A returned intake receipt is not completed OCR or approval. Full [platform setup and examples](https://github.com/quocvietphung/document-intelligence-lab#local-docker-workspace) are in the repository README.

## Development

```bash
python -m pip install './python[dev]'
python -m unittest discover -s python/tests -v
python -m build python
python -m twine check python/dist/*
```

Core tests do not download models. `TEST_PYTHON_PDF=/private/path/invoice.pdf TEST_ALLOW_MODEL_DOWNLOAD=1 TEST_DOCLING_TIMEOUT=900 python -m unittest discover -s python/tests -p test_docling_smoke.py -v` explicitly runs actual Docling. Omit the download flag after preparing weights. Shared repository fixtures check citations against Java and strict money rules against the Docker ETL worker; only an explicitly documented subset is compared with Java's permissive amount-comparison helper.

With inspection dependencies/Tesseract installed, run `TEST_PDF_INSPECTION=1 python -m unittest discover -s python/tests -p test_inspection.py -v` for actual tag, crop-box, native rotation, OCR and inverse-projected skew tests. `python python/tools/check_structure_pdf.py services/credit-api/src/test/resources/evidence/structure-regression.pdf` converts an actual PDF with the installed Docling reader and checks the retained structure. The shared structure contract is consumed by Java and Python. These are scoped regressions, not a general OCR/reading-order benchmark.

Build a preview wheel with `python -m build python --outdir python/dist/0.2.0a1`. Install the generated wheel into a clean environment with `python -m pip install python/dist/0.2.0a1/document_evidence_lab-0.2.0a1-py3-none-any.whl`; add its `[inspection]`/`[docling]` extra for the corresponding local engines. This does not publish to PyPI.

## License

MIT for this package. Docling, model weights and source documents retain their own licenses. No model, publisher PDF, token or customer document is bundled in the wheel.

## Source-bound quality dimensions

`evaluate_document` compares a normalized document with a reference bound to its original SHA-256. It separately reports character error rate, labelled table-cell text/structure matches and reading-order anchor pairs. It never combines these into an accuracy or approval score. Prepare labels from the PDF, never from predictions.

```python
import json
from document_evidence import DoclingReader, evaluate_document

document = DoclingReader().read("services/credit-api/src/test/resources/evidence/structure-regression.pdf")
with open("python/examples/references/structure-quality.json") as source:
    report = evaluate_document(document, json.load(source))
print(report["pages"])
```

Run from the repository root with the Docling extra and previously prepared weights. The included reference is self-authored generated input, not independently reviewed business ground truth. Its six table cells and reading anchors come from the PDF generator's known content. Exact cell checks are not TEDS; order scores cover only unique labelled anchors. Exports can contain private findings. The source/wheel preview remains separate from the published PyPI alpha; these changes do not publish a new release.


### Source-preview analytics SDK

These methods are in the repository preview, **not** the published PyPI 0.1.0a1. They add no runtime dependencies. Java enforces the token audience, tenant, dossier and role.

```python
layers = client.data_layers(case_id)
report = client.analytics(case_id)

# Explicit private-copy consent and a stable request UUID are required for writes.
# Read the current case version first; retain receipts and inspect status separately.
receipt = client.build_data_layers(
    case_id, case_version=client.get_case(case_id)["version"],
    request_id="12345678-1234-1234-1234-123456789abc", consent=True,
)
```

After that exact ETL receipt completes, `client.evaluate_cohort(case_id, case_version=..., etl_run_id=..., request_id=..., consent=True)` queues the optional local experiment. Read `client.analytics(case_id)` to inspect its result; there is no hidden polling, retry, cloud fallback or model installation. A small PDF cohort returns insufficient baseline data, with unmeasured accuracy metrics. See the main README for Docker, MLflow and PySpark setup.
