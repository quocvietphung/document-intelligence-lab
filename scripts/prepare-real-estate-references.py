"""Build the authored, fictional real-estate dossier used by the local lab.

The five PDFs form one internally consistent research fixture. They contain no
customer data and do not copy any employer or property developer documents.
Requires reportlab; output is deterministic and may be committed under MIT.
"""
from pathlib import Path
import hashlib
import json
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "services/credit-api/src/main/resources/real-estate"
PRIVATE = ROOT / ".local/reference-pdfs"

DOCUMENTS = [
    {
        "id": "real-estate-construction-order",
        "file": "fictional-construction-order.pdf",
        "title": "Construction order · shell fit-out",
        "heading": "Bauauftrag",
        "documentType": "construction-order",
        "fields": [
            ("Projekt-ID", "RE-2026-042"),
            ("Auftragsnummer", "AUF-2026-081"),
            ("Auftraggeber", "Nordblick Projektgesellschaft mbH (fiktiv)"),
            ("Auftragnehmer", "Musterbau Ausbau GmbH (fiktiv)"),
            ("Auftragssumme", "184.450,00 EUR"),
            ("Startdatum", "02.11.2026"),
            ("Enddatum", "18.12.2026"),
        ],
        "body": "Beauftragt werden Trockenbau, Bodenarbeiten und die dokumentierte Übergabe des Innenausbaus. Leistungen außerhalb dieses Umfangs benötigen einen schriftlichen Nachtrag.",
    },
    {
        "id": "real-estate-change-order",
        "file": "fictional-change-order.pdf",
        "title": "Change order · acoustic ceiling",
        "heading": "Nachtrag zum Bauauftrag",
        "documentType": "change-order",
        "fields": [
            ("Projekt-ID", "RE-2026-042"),
            ("Nachtragsnummer", "NTR-2026-014"),
            ("Auftragsnummer", "AUF-2026-081"),
            ("Nachtragssumme", "12.600,00 EUR"),
            ("Freigabestatus", "schriftlich freigegeben"),
            ("Freigabedatum", "12.11.2026"),
        ],
        "body": "Der Nachtrag ergänzt eine Akustikdecke im Besprechungsbereich. Die ursprüngliche Auftragssumme bleibt nachvollziehbar; die Nachtragssumme wird separat ausgewiesen.",
    },
    {
        "id": "real-estate-construction-invoice",
        "file": "fictional-construction-invoice.pdf",
        "title": "Construction invoice · deliberate variance",
        "heading": "Baurechnung",
        "documentType": "construction-invoice",
        "fields": [
            ("Projekt-ID", "RE-2026-042"),
            ("Rechnungsnummer", "RE-2026-311"),
            ("Auftragsnummer", "AUF-2026-081"),
            ("Rechnungsbetrag", "198.250,00 EUR"),
            ("Leistungszeitraum", "02.11.2026 - 18.12.2026"),
            ("Fälligkeitsdatum", "15.01.2027"),
        ],
        "body": "Schlussrechnung für den Innenausbau einschließlich dokumentierter Nachtragsleistung. Der Rechnungsbetrag liegt absichtlich 1.200,00 EUR über Auftrag plus freigegebenem Nachtrag und muss manuell geklärt werden.",
    },
    {
        "id": "real-estate-acceptance-report",
        "file": "fictional-acceptance-report.pdf",
        "title": "Acceptance report · open defects",
        "heading": "Abnahmeprotokoll",
        "documentType": "acceptance-report",
        "fields": [
            ("Projekt-ID", "RE-2026-042"),
            ("Abnahmenummer", "ABN-2026-027"),
            ("Auftragsnummer", "AUF-2026-081"),
            ("Abnahmedatum", "19.12.2026"),
            ("Offene Mängel", "2"),
            ("Mängelfrist", "09.01.2027"),
        ],
        "body": "Die Leistung wird mit Vorbehalt abgenommen. Offen sind eine beschädigte Sockelleiste und die fehlende Beschriftung einer Revisionsöffnung. Das Protokoll ist keine Zahlungsfreigabe.",
    },
    {
        "id": "real-estate-site-minutes",
        "file": "fictional-site-meeting-minutes.pdf",
        "title": "Site meeting minutes · assigned follow-up",
        "heading": "Baubesprechungsprotokoll",
        "documentType": "site-meeting-minutes",
        "fields": [
            ("Projekt-ID", "RE-2026-042"),
            ("Protokollnummer", "PRO-2026-019"),
            ("Besprechungsdatum", "21.12.2026"),
            ("Aufgabe", "Offene Mängel dokumentieren und beseitigen"),
            ("Verantwortlich", "Musterbau Ausbau GmbH (fiktiv)"),
            ("Frist", "09.01.2027"),
        ],
        "body": "Die Beteiligten bestätigen nur die protokollierte Aufgabe und Frist. Kosten, Abnahme und Zahlungsfreigabe bleiben getrennte Prüfschritte.",
    },
]


def write_pdf(path: Path, item: dict) -> None:
    body = ParagraphStyle("body", fontName="Helvetica", fontSize=10.2, leading=15, textColor=colors.HexColor("#243b40"))
    title = ParagraphStyle("title", parent=body, fontName="Helvetica-Bold", fontSize=21, leading=27, spaceAfter=16)
    muted = ParagraphStyle("muted", parent=body, fontSize=8.4, leading=12, textColor=colors.HexColor("#587178"))
    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=52, rightMargin=52, topMargin=46, bottomMargin=52,
                            title=item["title"], author="Viet Phung", subject="Synthetic real-estate document AI fixture - MIT", invariant=1)
    rows = [[Paragraph(escape(label + ":"), body), Paragraph(escape(value), body)] for label, value in item["fields"]]
    table = Table(rows, colWidths=[170, 320])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("GRID", (0, 0), (-1, -1), .35, colors.HexColor("#d4e2e0")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#edf5f2")),
        ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story = [Paragraph("DOCUMENT INTELLIGENCE LAB · REAL-ESTATE WORKFLOW", muted), Spacer(1, 10),
             Paragraph(escape(item["heading"]), title), table, Spacer(1, 18), Paragraph(escape(item["body"]), body),
             Spacer(1, 24), Paragraph("FIKTIVES FORSCHUNGSDOKUMENT · Keine reale Firma, Immobilie, Rechnung, Freigabe oder Rechtsberatung. Alle Namen, Nummern, Beträge und Daten sind frei erfunden.", muted)]
    doc.build(story)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    PRIVATE.mkdir(parents=True, exist_ok=True)
    samples = []
    for item in DOCUMENTS:
        target = OUTPUT / item["file"]
        write_pdf(target, item)
        data = target.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        private_target = PRIVATE / item["file"]
        # These bytes are authored by this deterministic generator, never downloaded.
        private_target.write_bytes(data)
        samples.append({"id": item["id"], "file": item["file"], "title": item["title"],
                        "documentType": item["documentType"], "sha256": digest, "page": 1})
    manifest = {
        "version": "real-estate-dossier-v1",
        "license": "MIT",
        "provenance": "Authored fictional PDF dossier; no employer, customer or property developer source material.",
        "projectId": "RE-2026-042",
        "expectedFindings": [
            "Invoice exceeds construction order plus approved change order by 1,200.00 EUR",
            "Acceptance report contains two open defects with a remediation deadline",
            "Site minutes assign the same remediation deadline and responsible party",
        ],
        "samples": samples,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"Prepared {len(samples)} fictional real-estate PDFs in resources and .local/reference-pdfs")


if __name__ == "__main__":
    main()
