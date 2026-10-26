"""Inspect a permitted local PDF. No Java/Docker/Azure/LLM or PDF modifications."""
import argparse
from dataclasses import asdict
import json
from document_evidence import ground_pdf,read_pdf_structure

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('pdf')
parser.add_argument('--value',default='Total: $500')
parser.add_argument('--page',type=int,default=1)
args=parser.parse_args()
print(json.dumps({'native_structure':asdict(read_pdf_structure(args.pdf)),
                  'grounding':ground_pdf(args.pdf,args.value,page=args.page).to_dict()},indent=2))
