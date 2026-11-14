"""Build the committed AI-103 capability fixtures (fictional, authored for this repository).

Outputs go to labs/ai103/fixtures/capability/:
- rotated-repeated-value.pdf      page 1 shows the approved amount four times; page 2 is rotated 90 degrees
- rotated-repeated-value.text.json  the text of each page and its rotation, read back from the generated PDF
- ocr-misread.sample.json         OCR output of the change order page where one digit is misread (48.730 for 48.780)
- images.json                     size, MIME type and checksum of the two acceptance photos, read from their headers
- manifest.json                   checksums and provenance of every file in this folder

Output is deterministic (reportlab invariant mode), so checksums stay stable. Run with an environment that has
reportlab, for example the M365 PoC development venv:
    services/m365-mcp-poc/.venv/bin/python scripts/prepare-ai103-capability-fixtures.py
"""
from __future__ import annotations

import hashlib
import json
import struct
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "labs/ai103/fixtures/capability"
PAGES = ROOT / "labs/ai103/fixtures/search/dossier-pages.json"
PHOTOS = ROOT / "services/credit-api/src/main/resources/contractor-dossier"
PDF_NAME = "rotated-repeated-value.pdf"
AMOUNT = "48.780,00"
MISREAD = "48.730,00"
LICENSE = "MIT, authored for this repository; fictional data (FIKTIVE DATEN)."


def draw_page_one(pdf: canvas.Canvas) -> list[str]:
    lines = [
        "FIKTIVE DATEN · AI-103 Capability Lab · Fixture gleicher Wert",
        "Projekt-ID: LH-2026-C07 · Auftrag WV-2026-031",
        f"Position 1 · Gesamtvergütung · {AMOUNT} EUR brutto",
        f"Zwischensumme · {AMOUNT} EUR brutto",
        f"Prüfvermerk · genehmigter Betrag {AMOUNT} EUR brutto",
        f"Schlusssumme · {AMOUNT} EUR brutto",
    ]
    y = 780
    for index, line in enumerate(lines):
        pdf.setFont("Helvetica-Bold" if index == 0 else "Helvetica", 12 if index else 13)
        pdf.drawString(56, y, line)
        y -= 28
    return lines


def draw_page_two(pdf: canvas.Canvas) -> list[str]:
    lines = [
        "Seite 2 · gedrehte Seite (90 Grad) · Nachtrag N-01",
        f"Nachtrag genehmigt: {AMOUNT} EUR brutto",
    ]
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(56, 780, lines[0])
    pdf.setFont("Helvetica", 12)
    pdf.drawString(56, 752, lines[1])
    return lines


def build_pdf(path: Path) -> dict:
    pdf = canvas.Canvas(str(path), pagesize=A4, invariant=1)
    pdf.setTitle("AI-103 capability fixture: repeated value and rotated page")
    pdf.setAuthor("Document Intelligence Lab (fictional)")
    page_one = draw_page_one(pdf)
    pdf.showPage()
    pdf.setPageRotation(90)
    page_two = draw_page_two(pdf)
    pdf.showPage()
    pdf.save()
    return {"pages": [
        {"number": 1, "rotation": 0, "text": "\n".join(page_one)},
        {"number": 2, "rotation": 90, "text": "\n".join(page_two)},
    ]}


def write_ocr_sample(pages: list[dict]) -> dict:
    source = next(
        page for document in pages if document["name"] == "nachtrag-n01-wv-2026-031.pdf"
        for page in document["pages"] if page["number"] == 2
    )
    if AMOUNT not in source["text"]:
        raise SystemExit("change order page 2 no longer contains the approved amount")
    ocr_text = source["text"].replace(AMOUNT, MISREAD)
    return {
        "_comment": "FIKTIVE DATEN. Simulated OCR output of nachtrag-n01-wv-2026-031.pdf page 2 with one misread digit "
                    "(48.730,00 for 48.780,00). The source page text is in fixtures/search/dossier-pages.json.",
        "source": {"documentName": "nachtrag-n01-wv-2026-031.pdf", "page": 2},
        "ocrText": ocr_text,
        "expectedMismatch": {"ocr": MISREAD, "source": AMOUNT},
    }


def photo_metadata(name: str) -> dict:
    data = (PHOTOS / name).read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"{name} is not a PNG")
    width, height = struct.unpack(">II", data[16:24])
    return {"file": name, "mimeType": "image/png", "width": width, "height": height,
            "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    pdf_path = OUTPUT / PDF_NAME
    text = build_pdf(pdf_path)
    (OUTPUT / "rotated-repeated-value.text.json").write_text(
        json.dumps({"_comment": "FIKTIVE DATEN. Text of rotated-repeated-value.pdf, read back from the generated pages.",
                    "file": PDF_NAME, **text}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    pages = json.loads(PAGES.read_text(encoding="utf-8"))["documents"]
    (OUTPUT / "ocr-misread.sample.json").write_text(
        json.dumps(write_ocr_sample(pages), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    images = [photo_metadata("foto-f-01.png"), photo_metadata("foto-f-02.png")]
    (OUTPUT / "images.json").write_text(
        json.dumps({"_comment": "FIKTIVE DATEN. Metadata read from the PNG headers of the two acceptance photos.",
                    "images": images}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    files = {name: {"sha256": sha256(OUTPUT / name), "bytes": (OUTPUT / name).stat().st_size}
             for name in sorted([PDF_NAME, "rotated-repeated-value.text.json", "ocr-misread.sample.json", "images.json"])}
    (OUTPUT / "manifest.json").write_text(json.dumps({
        "version": "ai103-capability-fixtures-v1",
        "license": LICENSE,
        "provenance": "Generated by scripts/prepare-ai103-capability-fixtures.py from fictional text only.",
        "files": files,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(files)} fixtures to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
