"""Rebuild the labelled, fictional PDF corpus. Never downloads customer documents.

Labels and template-family splits are authored before model evaluation. The PDF
body contains no class/split identifier, and filenames are not model features.
Requires reportlab only; runtime extraction is performed by Java PDFBox.
"""
from pathlib import Path
import hashlib
import json
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'services/credit-api/src/main/resources/classification'
LABELS = ['insurance-claim', 'insurance-policy', 'invoice', 'other']
# Five independently authored template families per class. All variants of a
# family stay together: three training families, one validation, one test.
TEMPLATES = {
 'insurance-claim': [
  ('Schadenmeldung', 'Nach einem Leitungswasserschaden bitten wir um Regulierung. Der Boden wurde beschädigt. Fotos und ein Reparaturangebot liegen bei. Bitte prüfen Sie die Schadenunterlagen.', 'Schadennummer;Schadendatum;Beschädigter Gegenstand'),
  ('Mitteilung über einen Schadenfall', 'Wir melden ein versichertes Ereignis an einem Fenster. Das Glas ist nach einem Sturm gebrochen. Der Kostenvoranschlag dient zur Prüfung des Schadenersatzes.', 'Aktenzeichen;Ereignistag;Beschädigtes Bauteil'),
  ('Claim notification', 'Der Unfall hat Sachschäden verursacht. Wir beantragen die Bearbeitung des Schadenfalls und senden eine Beschreibung des Hergangs. Eine Auszahlung wurde noch nicht zugesagt.', 'Claim number;Date of loss;Hergang'),
  ('Anzeige eines versicherten Ereignisses', 'Am Gebäude ist ein Wasserschaden entstanden. Wir bitten um Prüfung und Regulierung des gemeldeten Schadens. Fotos zeigen die beschädigte Wand. Eine Reparatur ist noch nicht beauftragt.', 'Schadenakte;Tag des Vorfalls;Betroffene Sache'),
  ('Schadenfall zur Bearbeitung', 'Ein Sturm hat das Dach beschädigt. Mit dieser Meldung reichen wir die Schadenunterlagen ein und beantragen die Prüfung des Ersatzanspruchs. Ein Gutachten und Fotos werden nachgereicht.', 'Vorgangszeichen;Ereignisdatum;Schadenbeschreibung'),
 ],
 'insurance-policy': [
  ('Versicherungsschein', 'Dieser Vertrag bestätigt den vereinbarten Versicherungsschutz für eine fiktive Hausratversicherung. Beitrag, versicherte Risiken und Laufzeit sind unten aufgeführt. Es handelt sich nicht um eine Schadenmeldung.', 'Versicherungsnummer;Jahresbeitrag;Versicherungsbeginn'),
  ('Insurance policy', 'Der Versicherungsschutz umfasst die vereinbarten Risiken am Versicherungsort. Der jährliche Beitrag und die Selbstbeteiligung gehören zu dieser Vertragsbestätigung. Ein eingetretener Schaden wird hier nicht gemeldet.', 'Policy number;Annual premium;Coverage start'),
  ('Bestätigung des Versicherungsschutzes', 'Die Policennummer bezeichnet den geschlossenen Versicherungsvertrag. Für die Vertragslaufzeit gelten die ausgewiesene Deckungssumme und der vereinbarte Beitrag. Die Bescheinigung bestätigt den bestehenden Schutz.', 'Policennummer;Versicherungsbeitrag;Versicherungsbeginn'),
  ('Nachweis zum Versicherungsvertrag', 'Die Versicherungsschein-Nr. ordnet diesen Nachweis einem konkreten Vertrag zu. Wir bestätigen den Versicherungsschutz einschließlich Laufzeit, Selbstbeteiligung und jährlichem Beitrag.', 'Versicherungsschein-Nr.;Jahresbeitrag;Versicherungsbeginn'),
  ('Vertragliche Deckungsbestätigung', 'Für den versicherten Hausrat besteht der hier vereinbarte Schutz. Beitrag und Selbstbeteiligung sind Bestandteil des Vertrages. Die Vertragslaufzeit und der Beginn des Versicherungsschutzes sind dokumentiert.', 'Vertragsreferenz;Beitrag pro Jahr;Beginn des Schutzes'),
 ],
 'invoice': [
  ('Rechnung', 'Wir berechnen die ausgeführten Reparaturarbeiten. Die Rechnung enthält Arbeitszeit und Material. Bitte vergleichen Sie die Positionen mit dem Auftrag. Dieses Dokument bestätigt keine Versicherungsdeckung.', 'Rechnungsnummer;Gesamtbetrag;Leistungsdatum'),
  ('Invoice', 'Die erbrachte Dienstleistung wird mit dieser Abrechnung in Rechnung gestellt. Der ausgewiesene Betrag umfasst Material und Arbeitsleistung. Für Rückfragen verwenden Sie die Belegreferenz.', 'Invoice number;Invoice total;Service date'),
  ('Abrechnung der Reparaturleistung', 'Die nachstehenden Positionen dokumentieren die ausgeführte Wartung und deren Kosten. Der Gesamtbetrag ist eine Forderung für die erbrachte Leistung, keine Schadenentscheidung.', 'Invoice no;Rechnungsbetrag;Ausführungsdatum'),
  ('Werkstattrechnung', 'Für die Reparatur berechnen wir die aufgeführten Ersatzteile und Arbeitsstunden. Der Gesamtbetrag ergibt sich aus den Positionen. Ein Versicherungsvertrag wird hierdurch nicht abgeschlossen.', 'Rechnungsnummer;Gesamtbetrag;Reparaturdatum'),
  ('Reparaturkostenabrechnung', 'Die erbrachten Handwerkerleistungen werden nach Material und Arbeitszeit abgerechnet. Diese Rechnung bezieht sich auf einen abgeschlossenen Reparaturauftrag. Die Rechnungsnummer dient zur Zuordnung der Forderung.', 'Rechnungsnummer;Rechnungsbetrag;Leistungsdatum'),
 ],
 'other': [
  ('Allgemeines Informationsblatt', 'Dieses Merkblatt erläutert die Kontaktwege und unsere Bearbeitungszeiten. Es enthält keine individuelle Vertragsbestätigung, keine Zahlungsforderung und keinen Antrag zur Schadenregulierung.', 'Informationsreferenz;Ausgabestand;Kontaktweg'),
  ('Datenschutzhinweis', 'Wir erläutern die Verarbeitung von Daten und die Auskunftsrechte. Das Schreiben informiert über Aufbewahrung und Kontaktmöglichkeiten. Es dokumentiert weder einen Schadenfall noch einen neuen Versicherungsvertrag.', 'Dokumentreferenz;Informationsdatum;Anlaufstelle'),
  ('Terminmitteilung', 'Die Beratungsstelle informiert über die Öffnungszeiten und einen unverbindlichen Beratungstermin. Bringen Sie bei Bedarf Unterlagen mit. Dieses Schreiben dient ausschließlich der Organisation.', 'Terminreferenz;Termintag;Ort'),
  ('Hinweise zur sicheren Kommunikation', 'Dieses allgemeine Rundschreiben beschreibt den sicheren Versand von Unterlagen. Es enthält keine individuelle Deckungszusage und keine Forderung. Nutzen Sie die veröffentlichten Kontaktwege.', 'Merkblattreferenz;Stand;Rückfrageweg'),
  ('Erläuterung zum Dokumentenversand', 'In diesem Informationsschreiben erläutern wir, wie Unterlagen eingereicht werden können. Es stellt keine persönliche Police, keine Rechnung und keine Meldung eines eingetretenen Schadens dar.', 'Schreibenreferenz;Ausgabedatum;Kontakt'),
 ],
}
CHALLENGES = [
 ('Merkblatt zu Schadenmeldungen', 'Dieses allgemeine Merkblatt nennt die Begriffe Schadenmeldung und Versicherungsschein als Beispiele. Es meldet keinen konkreten Schaden und bestätigt keinen persönlichen Vertrag.', 'other'),
 ('Unterlagenpaket', 'Schadenmeldung: Ein Fenster wurde beschädigt. Versicherungsschein: Der jährliche Schutz wird bestätigt. Invoice number: 99831. Dieses zusammengesetzte Paket hat mehrere Dokumentarten.', None),
 ('Kaum lesbarer Ausschnitt', 'Betrag unbekannt. Seite fehlt.', None),
 ('Nicht unterstützte Sprache', 'La documentación recibida requiere una revisión manual del contenido y de su finalidad. No se dispone de un conjunto representativo para este idioma.', None),
 ('Preisübersicht', 'Unverbindliche Preisinformation. Material und Arbeitszeit sind Beispielpreise für eine spätere Beratung. Es ist keine Rechnung für eine bereits erbrachte Leistung.', 'other'),
 ('Anschreiben ohne Anlage', 'Anbei erhalten Sie die angekündigten Unterlagen. Die genannten Anlagen fehlen in diesem Ausschnitt. Der Inhalt lässt keine sichere Zuordnung zu.', None),
]


def write_pdf(path, heading, paragraphs, fields):
    body = ParagraphStyle('body', fontName='Helvetica', fontSize=10.5, leading=16, textColor=colors.HexColor('#263b43'), alignment=TA_LEFT)
    title = ParagraphStyle('title', parent=body, fontName='Helvetica-Bold', fontSize=20, leading=26, spaceAfter=18)
    muted = ParagraphStyle('muted', parent=body, fontSize=8.5, leading=12, textColor=colors.HexColor('#59717a'))
    document = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=52, rightMargin=52, topMargin=48, bottomMargin=52,
                                 title='Fictional research document', author='Viet Phung', subject='Synthetic benchmark fixture - MIT', invariant=1)
    story = [Paragraph('DOCUMENT INTELLIGENCE LAB', muted), Spacer(1, 10), Paragraph(escape(heading), title)]
    for paragraph in paragraphs:
        story.extend([Paragraph(escape(paragraph), body), Spacer(1, 16)])
    if fields:
        table = Table([[Paragraph(escape(k), body), Paragraph(escape(v), body)] for k, v in fields], colWidths=[210, 280])
        table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP'), ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f0f5f4')),
                                  ('LEFTPADDING',(0,0),(-1,-1),10), ('RIGHTPADDING',(0,0),(-1,-1),10),
                                  ('TOPPADDING',(0,0),(-1,-1),10), ('BOTTOMPADDING',(0,0),(-1,-1),10)]))
        story.extend([table, Spacer(1, 20)])
    story.append(Paragraph('SYNTHETIC RESEARCH DOCUMENT. Fictional data only. Not a real contract, claim, invoice or payment request. Author-defined benchmark label; no model-generated ground truth.', muted))
    def footer(canvas, _):
        canvas.setStrokeColor(colors.HexColor('#d7e2e3')); canvas.line(52, 42, A4[0]-52, 42)
        canvas.setFont('Helvetica', 8); canvas.setFillColor(colors.HexColor('#59717a'))
        canvas.drawString(52, 28, 'Document Intelligence Lab | MIT | Synthetic benchmark')
        canvas.drawRightString(A4[0]-52, 28, str(canvas.getPageNumber()))
    document.build(story, onFirstPage=footer, onLaterPages=footer)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for label in LABELS:
        for family, (heading, paragraph, keys) in enumerate(TEMPLATES[label]):
            split = 'train' if family < 3 else 'validation' if family == 3 else 'test'
            for variant in range(3):
                number = int(hashlib.sha256(f'{label}:{family}:{variant}:fixture'.encode()).hexdigest()[:6], 16)
                values = [f'F-{number}', f'{180+number%900},00 EUR' if label in ('invoice','insurance-policy') else '15.04.2025',
                          'Fenster und Innenwand' if label=='insurance-claim' else 'Dokumentenservice' if label=='other' else '01.05.2025']
                fields = list(zip(keys.split(';'), values, strict=True))
                rows.append((label, f'{label}-family-{family+1}', split, heading,
                             [paragraph, 'Alle Angaben sind frei erfunden. Referenz für Rückfragen: '+str(number)+'.'], fields))
    for index, (heading, text, label) in enumerate(CHALLENGES):
        rows.append((label, f'challenge-family-{index+1}', 'challenge', heading, [text], []))
    samples = []
    for index, (label, family, split, heading, paragraphs, fields) in enumerate(rows, 1):
        identity=f'bench-{index:04d}'; path=OUTPUT/(identity+'.pdf')
        write_pdf(path, heading, paragraphs, fields)
        samples.append({'id':identity,'file':path.name,'label':label,'group':family,'split':split,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'page':1,'expectedReview':split=='challenge'})
    manifest={'version':'insurance-classification-pdf-v2','license':'MIT','provenance':'Authored fictional PDF fixtures; not customer data or a representative insurance dataset. v2 corrects the damaged-object example field; it is not a new independent test set.',
              'labels':LABELS,'splits':{'train':36,'validation':12,'test':12,'challenge':6},
              'splitUnit':'template-family','language':'German-dominant, with a few English labels; no validated multilingual claim',
              'samples':samples}
    (OUTPUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(f'Prepared {len(samples)} actual one-page PDFs; 36 train / 12 validation / 12 test / 6 challenge. Labels predate evaluation.')


if __name__=='__main__':
    main()
