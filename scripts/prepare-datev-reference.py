"""Split public DATEV demonstration pages for PRIVATE local extraction tests.

Supply the unchanged official LODAS 2025 sample PDF downloaded from the link
in docs/PUBLIC_PAYROLL_TESTS.md. Third-party PDFs are never copied into public/
or tracked in Git; this is not a payroll generator or a legal payroll check.
"""
import argparse
from pathlib import Path
from pypdf import PdfReader, PdfWriter

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
args = parser.parse_args()
reader = PdfReader(args.source)
if len(reader.pages) != 30 or "Musterauswertungen" not in reader.pages[0].extract_text():
    raise SystemExit("Expected the official 30-page DATEV LODAS 2025 sample.")
root = Path(__file__).resolve().parents[1]
destination = root / ".local/reference-pdfs"
destination.mkdir(parents=True, exist_ok=True)
for number, name, marker in [(1, "datev-lodas-2025-robert-muster.pdf", "Robert-Muster"),
                              (2, "datev-lodas-2025-melanie-muster.pdf", "Melanie-Muster")]:
    if marker not in reader.pages[number].extract_text():
        raise SystemExit("Sample identity did not match. Inspect the source manually.")
    target = destination / name
    if target.exists():
        raise SystemExit(f"Refusing to overwrite existing reference: {target}")
    writer = PdfWriter()
    writer.add_page(reader.pages[number])
    writer.add_metadata({"/Title": "DATEV LODAS 2025 public demonstration - private local test",
                         "/Subject": "Unmodified sample page; not an actual employee record"})
    with target.open("wb") as stream:
        writer.write(stream)
    if len(PdfReader(target).pages) != 1 or target.stat().st_size > 3_000_000:
        raise SystemExit("Derived sample does not meet local upload limits.")
    print(f"Prepared one-page private reference: {target}")
