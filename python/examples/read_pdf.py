"""Use a permitted local PDF; no Java, Docker, login or Azure is required."""
import argparse
import json

from document_evidence import DoclingReader, check_evidence, normalize_money, validate_document

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("pdf")
parser.add_argument("--artifacts-path")
parser.add_argument("--allow-model-download", action="store_true")
parser.add_argument("--timeout", type=int, default=180)
args = parser.parse_args()

document = DoclingReader(artifacts_path=args.artifacts_path,
                         allow_model_download=args.allow_model_download, timeout_seconds=args.timeout).read(args.pdf)
print(json.dumps({"document": document.to_dict(), "validation": validate_document(document).to_dict()},
                 ensure_ascii=False, indent=2))
print("Decimal-comma example:", normalize_money("2967,11 EUR"))
source = document.sources[0]
print("Exact excerpt present:", check_evidence(document, source.id, source.text))
print("These are local checks, not human approval or semantic fact-checking.")
