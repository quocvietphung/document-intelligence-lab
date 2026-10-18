"""Generate legacy regression fixtures only. Never publish these in the UI."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "services/credit-api/src/test/resources/legacy-research"
SAMPLES = [
    ("insurance-policy-fictional.pdf", "Versicherungsschein", "Versicherungsunterlagen / Laborbeispiel", [
        ("Versicherungsnummer", "LAB-V-2026-104"), ("Versicherer", "Muster Versicherung (fiktiv)"),
        ("Versicherungsnehmer", "Erika Beispiel (fiktiv)"), ("Versicherungsbeginn", "01.01.2026"),
        ("Versicherungsende", "31.12.2026"), ("Jahresbeitrag", "480,00 EUR"),
        ("Selbstbeteiligung", "250,00 EUR"), ("Deckungssumme", "50.000,00 EUR")],
        "Beitrag und Deckungssumme sind keine zugesagte Schadenentschaedigung."),
    ("insurance-claim-fictional.pdf", "Schadenmeldung", "Schadenunterlagen / Laborbeispiel", [
        ("Schadennummer", "LAB-S-2026-042"), ("Versicherungsnummer", "LAB-V-2026-104"),
        ("Versicherungsnehmer", "Erika Beispiel (fiktiv)"), ("Schadendatum", "10.10.2026"),
        ("Datum", "15.10.2026"), ("Beschreibung", "Fiktiver Wasserschaden am Arbeitsgeraet"),
        ("Gemeldeter Betrag", "1.280,00 EUR")],
        "Nur eine Meldung. Deckung, Haftung und Auszahlung sind nicht bestaetigt."),
    ("invoice-fictional.pdf", "Rechnung", "Allgemeine Dokumente / Laborbeispiel", [
        ("Rechnungsnummer", "LAB-R-2026-018"), ("Datum", "15.10.2026"),
        ("Aussteller", "Muster Dokumentenservice (fiktiv)"), ("Empfaenger", "Erika Beispiel (fiktiv)"),
        ("Leistung", "Dokumentenaufbereitung - frei erfunden"), ("Nettobetrag", "100,00 EUR"),
        ("Umsatzsteuer", "19,00 EUR"), ("Gesamtbetrag", "119,00 EUR")],
        "Keine echte Forderung. Kein Zahlungsauftrag und keine Bankverbindung."),
]

def generate():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, title, subtitle, fields, note in SAMPLES:
        pdf = canvas.Canvas(str(OUT / name), pagesize=A4)
        pdf.setTitle("FIKTIV - " + title)
        pdf.setAuthor("Document Intelligence Lab - original synthetic fixture")
        w, h = A4
        pdf.setFillColor(HexColor("#123f49")); pdf.rect(0, h-160, w, 160, fill=1, stroke=0)
        pdf.setFillColor(HexColor("#9edbd1")); pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(44, h-42, "DOCUMENT INTELLIGENCE LAB / SYNTHETIC RESEARCH")
        pdf.setFillColor(HexColor("#ffffff")); pdf.setFont("Helvetica-Bold", 28)
        pdf.drawString(44, h-91, title); pdf.setFont("Helvetica", 12); pdf.drawString(44, h-121, subtitle)
        pdf.setFillColor(HexColor("#975716")); pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(44, h-195, "FIKTIV - KEIN GUELTIGES DOKUMENT - NUR ZUM KI-TEST")
        y = h-241
        for index, (label, value) in enumerate(fields):
            if index % 2 == 0:
                pdf.setFillColor(HexColor("#eef5f4")); pdf.rect(36, y-15, w-72, 42, fill=1, stroke=0)
            pdf.setFillColor(HexColor("#24464b")); pdf.setFont("Helvetica", 11)
            pdf.drawString(46, y, label + ": " + value)
            y -= 44
        pdf.setFillColor(HexColor("#516d74")); pdf.setFont("Helvetica", 10)
        pdf.drawString(44, 145, note)
        pdf.drawString(44, 122, "Namen, Referenzen und Betraege sind erfunden. Keine fachliche Beratung.")
        pdf.setStrokeColor(HexColor("#c7dbd7")); pdf.line(44, 88, w-44, 88)
        pdf.setFont("Helvetica", 9); pdf.drawString(44, 65, "Original synthetic fixture / no personal customer data")
        pdf.drawRightString(w-44, 65, "Seite 1 / 1")
        pdf.showPage(); pdf.save()
        print(name)

if __name__ == "__main__":
    generate()
