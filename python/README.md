# Document Evidence Lab

Local PDF parsing, deterministic validation and traceable evidence for document AI experiments. Part of [Document Intelligence Lab](https://github.com/quocvietphung/document-intelligence-lab).

The **Python library runs without Java, Docker, an Azure account or an LLM**. It adds evidence checks around Docling rather than replacing Docling's parser. The optional SDK connects to the existing Java platform for authenticated workflows and audit history.

## Install

Use Python 3.10 or newer. Pin the alpha release and choose whether to install the optional parser:

```bash
python -m pip install 'document-evidence-lab[docling]==0.1.0a1'
```

For the dependency-free validation core and authenticated SDK, use `document-evidence-lab==0.1.0a1` without `[docling]`. Installing the extra does not itself authorize a model download. This is research software; alpha releases are not production certifications.

### Install from source

```bash
git clone https://github.com/quocvietphung/document-intelligence-lab.git
cd document-intelligence-lab
python3 -m venv .venv
source .venv/bin/activate
python -m pip install './python[docling]'
```

Use Python 3.10 or newer. On Windows, activate with `.venv\Scripts\Activate.ps1`. `pip install ./python` installs only the lightweight core and SDK; it does not install Docling or download models.

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

## License

MIT for this package. Docling, model weights and source documents retain their own licenses. No model, publisher PDF, token or customer document is bundled in the wheel.
