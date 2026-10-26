"""Create a fully synthetic PDF for repeated-source and OCR-mismatch inspection.

Usage: python scripts/build-evidence-regression.py /private/path/evidence-regression.pdf
No customer data, cloud requests, OCR, or model calls. OCR 3,500 is an intentionally
injected test observation, not an assertion that a real OCR engine misread this PDF.
"""
import sys
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle
from reportlab.lib import colors
from pypdf import PdfReader, PdfWriter

target = Path(sys.argv[1])
target.parent.mkdir(parents=True, exist_ok=True)
if target.exists():
    raise SystemExit("Refusing to overwrite an existing fixture")
raw = target.with_suffix('.unrotated.pdf')
c = canvas.Canvas(str(raw), pagesize=(600, 800), invariant=1)
for page in range(2):
    c.setFont('Helvetica-Bold', 17)
    c.drawString(50, 745, 'Synthetic evidence inspection regression')
    c.setFont('Helvetica', 12)
    c.drawString(50, 715, 'Not a real invoice. No payment, tax or insurance decision.')
    for i, y in enumerate([640, 570, 500, 430]):
        c.drawString(50, y, f'Section {i + 1} / duplicate occurrence {i + 1}')
        c.drawString(50, y - 24, 'Total: $500')
    c.drawString(50, 340, 'Original amount: 8,500 USD')
    c.drawString(50, 310, 'Test-only OCR observation: 3,500 USD (deliberately injected)')
    c.drawString(50, 280, 'Quote matching alone cannot validate the original amount.')
    table = Table([['Item', 'Gross total', 'Currency'], ['Inspection example', '8,500', 'USD']], colWidths=[210, 150, 120], rowHeights=[32, 32])
    table.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), 1, colors.black), ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#edf4f1')), ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 12), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
    table.wrapOn(c, 480, 64)
    table.drawOn(c, 50, 160)
    c.drawString(50, 100, 'Page 2 has an intrinsic PDF rotation of 90 degrees.' if page else 'Page 1 is upright; use each occurrence separately.')
    c.showPage()
c.save()
reader = PdfReader(raw)
writer = PdfWriter()
for i, page in enumerate(reader.pages):
    if i == 1:
        page.rotate(90)
    writer.add_page(page)
with target.open('xb') as output:
    writer.write(output)
raw.unlink()
print(f'Created synthetic two-page fixture: {target}')
