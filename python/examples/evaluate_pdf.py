"""Measure a permitted PDF against independently prepared, hash-bound labels."""
import argparse,json,os
from document_evidence import DoclingReader,evaluate_document

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("pdf");parser.add_argument("reference");parser.add_argument("--output",required=True)
parser.add_argument("--allow-model-download",action="store_true")
args=parser.parse_args()
document=DoclingReader(allow_model_download=args.allow_model_download).read(args.pdf)
report=evaluate_document(document,json.load(open(args.reference)))
with os.fdopen(os.open(args.output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),"w") as output:
    json.dump(report,output,indent=2)
print("Private dimension report saved. No approval or overall accuracy score was assigned.")
