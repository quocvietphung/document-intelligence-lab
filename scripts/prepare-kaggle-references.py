"""Prepare reviewed PRIVATE Kaggle PDFs for insurance and general documents.

Requires pypdf==6.10.0. Source PDFs are publisher-owned; Kaggle metadata is not
proof of underlying redistribution rights. Do not put originals/excerpts in Git.
"""
import argparse
import hashlib
import io
import json
import re
from pathlib import Path
import urllib.request
import pypdf
from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "lib/kaggle-reference-catalog.json"
MAX_BYTES = 3_000_000


def digest(data):
    return hashlib.sha256(data).hexdigest()


def prepare(sample):
    if not re.fullmatch(r"[a-f0-9]{64}", sample["sha256"]):
        raise ValueError("Only reviewed, hash-pinned excerpts may be prepared")
    cache = ROOT / (".local/kaggle-insurance" if sample["domain"] == "insurance" else ".local/kaggle-invoices")
    target = ROOT / ".local/reference-pdfs" / sample["file"]
    cache.mkdir(parents=True, exist_ok=True)
    target.parent.mkdir(parents=True, exist_ok=True)
    original = cache / Path(sample["sourceFile"]).name
    if original.is_symlink() or target.is_symlink():
        raise ValueError("Symlink references are not accepted")
    if original.exists():
        data = original.read_bytes()
    else:
        request = urllib.request.Request(sample["downloadUrl"], headers={"User-Agent": "DocumentIntelligenceLab/1.0"})
        with urllib.request.urlopen(request, timeout=40) as response:
            data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES or digest(data) != sample["sourceSha256"]:
            raise ValueError("Source changed or too large; no reference was prepared")
        with original.open("xb") as stream:
            stream.write(data)
    if len(data) > MAX_BYTES or digest(data) != sample["sourceSha256"] or not data.startswith(b"%PDF-"):
        raise ValueError("Source SHA-256 mismatch; inspect the pinned dataset version")
    reader = PdfReader(io.BytesIO(data))
    if reader.is_encrypted or len(reader.pages) != sample["sourcePageCount"]:
        raise ValueError("Unexpected PDF structure")
    for page_number, marker in zip(sample["sourcePages"], sample["markers"], strict=True):
        if marker not in (reader.pages[page_number - 1].extract_text() or ""):
            raise ValueError("Source page did not match the reviewed reference")
    if sample["format"] == "pdf-original":
        result = data
    else:
        result = excerpt(reader, sample)
    if len(result) > MAX_BYTES or digest(result) != sample["sha256"]:
        raise ValueError("Prepared reference hash mismatch; use pinned pypdf version")
    if target.exists():
        if digest(target.read_bytes()) != digest(result):
            raise ValueError("Refusing to overwrite an existing different reference")
    else:
        with target.open("xb") as stream:
            stream.write(result)
    print(f"Prepared {sample['id']}: {len(sample['sourcePages'])} pages; SHA-256 {digest(result)}")


def excerpt(reader, sample):
    writer = PdfWriter()
    for page_number, marker in zip(sample["sourcePages"], sample["markers"], strict=True):
        page = reader.pages[page_number - 1]
        if marker not in (page.extract_text() or ""):
            raise ValueError("Source page did not match the reviewed reference")
        writer.add_page(page, excluded_keys=("/Annots", "/AA"))
    writer.add_metadata({"/Title": sample["title"], "/Subject": "Private research excerpt; source PDF pages " + ", ".join(map(str, sample["sourcePages"])) + "; not a complete policy or German insurance advice"})
    output = io.BytesIO()
    writer.write(output)
    result = output.getvalue()
    return result


if __name__ == "__main__":
    if pypdf.__version__ != "6.10.0":
        raise SystemExit("Install pypdf==6.10.0 in a private virtual environment")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--domain", choices=["insurance", "general", "all"], default="all")
    args = parser.parse_args()
    for entry in json.loads(CATALOG.read_text()):
        if args.domain == "all" or entry["domain"] == args.domain:
            prepare(entry)
