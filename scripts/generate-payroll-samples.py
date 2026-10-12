"""Create clearly marked, fictitious German payslips for Document AI testing."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"public"/"demo"
CASES=[
    ("gehaltsabrechnung-2026-09-muster.pdf","September 2026","30.09.2026","Dr. Lea Muster","9200","2960","6240"),
    ("gehaltsabrechnung-2026-10-muster.pdf","Oktober 2026","31.10.2026","Dr. Lea Muster","9400","3020","6380"),
    ("gehaltsabrechnung-teilzeit-muster.pdf","Oktober 2026 / Teilzeit","31.10.2026","Alex Beispiel","4800","1600","3200"),
]

def create(record):
    filename,period,date,name,gross,deductions,net=record
    OUT.mkdir(parents=True,exist_ok=True)
    pdf=canvas.Canvas(str(OUT/filename),pagesize=A4)
    pdf.setTitle("Synthetische Gehaltsabrechnung - "+period)
    pdf.setAuthor("Credit Intelligence Lab - synthetic fixtures")
    width,height=A4
    pdf.setFillColor(HexColor("#0b534d"));pdf.rect(0,height-145,width,145,fill=1,stroke=0)
    pdf.setFillColor(HexColor("#d6f2e8"));pdf.setFont("Helvetica-Bold",10)
    pdf.drawString(42,height-40,"CREDIT INTELLIGENCE LAB  /  MUSTERDOKUMENT")
    pdf.setFillColor(HexColor("#ffffff"));pdf.setFont("Helvetica-Bold",25)
    pdf.drawString(42,height-84,"Gehaltsabrechnung")
    pdf.setFont("Helvetica",13);pdf.drawString(42,height-112,period)
    pdf.setFillColor(HexColor("#8c551e"));pdf.setFont("Helvetica-Bold",10)
    pdf.drawString(42,height-176,"SYNTHETISCHE DATEN - KEIN GUELTIGER EINKOMMENSNACHWEIS")
    pdf.setFillColor(HexColor("#173832"));pdf.setFont("Helvetica-Bold",12)
    pdf.drawString(42,height-215,"Arbeitgeber: Musterklinikum GmbH")
    pdf.setFont("Helvetica",11)
    for y,text in [(height-240,"Mitarbeiter: "+name),(height-262,"Personalnummer: DEMO-1048"),(height-284,"Datum: "+date),(height-306,"Abrechnungszeitraum: "+period)]:pdf.drawString(42,y,text)
    pdf.setFillColor(HexColor("#edf6f1"));pdf.roundRect(42,342,width-84,135,12,fill=1,stroke=0)
    pdf.setFillColor(HexColor("#173832"));pdf.setFont("Helvetica-Bold",11)
    pdf.drawString(58,451,"ENTGELTUEBERSICHT (ILLUSTRATIVE BETRAEGE)")
    pdf.setFont("Helvetica",12)
    pdf.drawString(58,418,"Bruttoentgelt: "+gross+" EUR")
    pdf.drawString(58,387,"Abzuege gesamt: "+deductions+" EUR")
    pdf.setFillColor(HexColor("#0b534d"));pdf.roundRect(42,267,width-84,58,10,fill=1,stroke=0)
    pdf.setFillColor(HexColor("#ffffff"));pdf.setFont("Helvetica-Bold",18)
    pdf.drawString(58,290,"Nettoeinkommen: "+net+" EUR")
    pdf.setFillColor(HexColor("#536e67"));pdf.setFont("Helvetica",10)
    for y,text in [(233,"Auszahlungskonto: DEMO - NICHT ZAHLUNGSFAEHIG"),(204,"Diese Zahlen sind frei erfunden. Keine reale Person oder Institution ist betroffen."),(186,"Steuern und Sozialabgaben werden hier nicht nach geltendem Recht berechnet."),(168,"Nur zum Testen von OCR, Feldern, Quellenansicht und manueller Pruefung.")]:pdf.drawString(42,y,text)
    pdf.setStrokeColor(HexColor("#d6e5df"));pdf.line(42,84,width-42,84)
    pdf.setFont("Helvetica",9);pdf.drawString(42,62,"MUSTER / NOT A REAL PAYSLIP / SYNTHETIC DATA")
    pdf.drawRightString(width-42,62,"Seite 1 / 1")
    pdf.showPage();pdf.save()
    print(filename)

if __name__=="__main__":
    for record in CASES:create(record)
