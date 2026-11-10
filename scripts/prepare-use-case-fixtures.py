"""Build the fictional use-case fixtures and the use-case catalog for the provider-neutral workspace.

Every document is authored for this repository, labelled FIKTIVE DATEN and contains no employer,
customer, vendor or property-developer material. Output is deterministic (reportlab invariant mode),
so hashes stay stable; changing any text requires reviewing the catalog and its tests.

Run with an environment that has reportlab, for example the M365 PoC development venv:
    services/m365-mcp-poc/.venv/bin/python scripts/prepare-use-case-fixtures.py
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
RESOURCES = ROOT / "services/credit-api/src/main/resources"
OUTPUT = RESOURCES / "use-cases"
FOOTER = ("FIKTIVES FORSCHUNGSDOKUMENT · FIKTIVE DATEN · Keine reale Firma, Immobilie, Rechnung, Freigabe, "
          "Rechts-, Investitions- oder ESG-Bewertung. Alle Namen, Nummern, Beträge und Daten sind frei erfunden.")
PROJECT = "Musterquartier Lindenhof (fiktiv)"

# Each page: (heading, [(label, value)], body text)
DOCUMENTS: dict[str, dict] = {
    "projektbewertung-musterquartier.pdf": {
        "title": "Projektbewertung Musterquartier (fiktiv)",
        "pages": [
            ("Projektbewertung – Kosten (FIKTIVE DATEN)", [
                ("Projekt", PROJECT), ("Projektnummer", "MQ-2026-015"),
                ("KG 100 Grundstück", "Plan 4.200.000,00 EUR · Prognose 4.200.000,00 EUR"),
                ("KG 200 Herrichten und Erschließen", "Plan 350.000,00 EUR · Prognose 380.000,00 EUR"),
                ("KG 300/400 Bauwerk", "Plan 9.800.000,00 EUR · Prognose 10.450.000,00 EUR"),
                ("KG 700 Baunebenkosten", "Plan 1.650.000,00 EUR · Prognose 1.720.000,00 EUR"),
                ("Gesamtkosten Plan", "16.000.000,00 EUR"), ("Gesamtkosten Prognose", "16.750.000,00 EUR"),
                ("Wohnfläche", "6.500 m²"),
            ], "Die Werte dienen ausschließlich der deterministischen Testberechnung. Kennzahlen werden im Code berechnet, nicht von einem Sprachmodell."),
            ("Projektbewertung – Erlöse und Termine (FIKTIVE DATEN)", [
                ("Erlösszenario Basis", "21.450.000,00 EUR"), ("Erlösszenario Vorsichtig", "18.200.000,00 EUR"),
                ("Baubeginn", "Plan 01.03.2026 · Prognose 01.03.2026"), ("Fertigstellung", "Plan 30.09.2027 · Prognose 15.12.2027"),
            ], "Szenarien sind Annahmen für den Test. Es wird keine Investitions-, Bewertungs- oder Finanzierungsentscheidung getroffen."),
        ],
    },
    "email-nachtragsangebot-musterquartier.pdf": {
        "title": "Nachtragsangebot NA-2026-007 (fiktiv)",
        "pages": [("Nachtragsangebot (FIKTIVE DATEN)", [
            ("Projekt", PROJECT), ("Nachtragsnummer", "NA-2026-007"), ("Bezug Auftrag", "AUF-2026-112"),
            ("Auftragnehmer", "Musterbau Ausbau GmbH (fiktiv)"), ("Leistung", "Zusätzliche Schallschutzdecke Haus B"),
            ("Nachtragssumme", "18.400,00 EUR netto"), ("Gültig bis", "30.11.2026"),
        ], "Dieses Angebot wurde als Anhang einer fiktiven E-Mail versendet. Eine Beauftragung ist in diesem Dokument nicht enthalten.")],
    },
    "eingangsrechnung-musterquartier.pdf": {
        "title": "Rechnung RE-2026-0311 (fiktiv)",
        "pages": [("Rechnung (FIKTIVE DATEN)", [
            ("Rechnungsnummer", "RE-2026-0311"), ("Rechnungssteller", "Musterbau Ausbau GmbH (fiktiv)"),
            ("Projekt", PROJECT), ("Rechnungsdatum", "12.10.2026"), ("Leistungszeitraum", "September 2026"),
            ("Nettobetrag", "42.000,00 EUR"), ("Umsatzsteuer 19 %", "7.980,00 EUR"), ("Bruttobetrag", "49.980,00 EUR"),
            ("Zahlungsziel", "30 Tage"),
        ], "Eine Zahlungsfreigabe ist nicht Teil dieses Dokuments. Prüfung und Freigabe erfolgen getrennt durch Menschen.")],
    },
    "projektstatus-musterquartier.pdf": {
        "title": "Projektstatusbericht Q3/2026 (fiktiv)",
        "pages": [
            ("Projektstatusbericht Q3/2026 (FIKTIVE DATEN)", [
                ("Projektname", PROJECT), ("Projektnummer", "MQ-2026-015"), ("Projektphase", "Rohbau"),
                ("Status", "Im Plan mit Terminrisiko"), ("Fertigstellungsgrad Rohbau", "62 %"),
                ("Nächster Meilenstein", "Richtfest am 14.11.2026"),
                ("Offene Risiken", "Lieferverzug Fenster (6 Wochen); Personalengpass Elektro"),
                ("Verantwortlich", "Projektleitung Süd (fiktiv)"),
            ], "Der Bericht fasst nur dokumentierte Angaben zusammen."),
            ("Lenkungsrunde (FIKTIVE DATEN)", [
                ("Entscheidung 1", "Beschleunigungsmaßnahme Fenster prüfen"), ("Entscheidung 2", "Keine Budgetfreigabe beantragt"),
            ], "Weitere Entscheidungen wurden nicht protokolliert."),
        ],
    },
    "bauvertrag-musterquartier.pdf": {
        "title": "Bauvertrag Auszug (fiktiv)",
        "pages": [("Bauvertrag – Auszug (FIKTIVE DATEN)", [
            ("Projekt", PROJECT), ("Vertragsnummer", "BV-2026-004"), ("Vertragssumme", "10.450.000,00 EUR netto"),
            ("Vertragsstrafe je Werktag", "0,3 % der Auftragssumme"), ("Vertragsstrafe Obergrenze", "5 % der Auftragssumme"),
            ("Gewährleistungsfrist", "5 Jahre ab Abnahme"), ("Sicherheitseinbehalt", "5 % für die Gewährleistung"),
            ("Zahlungsplan", "Abschlagszahlungen nach Baufortschritt"),
        ], "Der Auszug enthält keine rechtliche Bewertung. Hinweise der Software sind Prüfhinweise, keine Rechtsberatung.")],
    },
    "esg-nachweise-musterquartier.pdf": {
        "title": "ESG-Nachweisübersicht (fiktiv)",
        "pages": [("ESG-Nachweisübersicht (FIKTIVE DATEN)", [
            ("Energieausweis", "vorhanden, gültig bis 2036"), ("GEG-Nachweis", "vorhanden"),
            ("Ökobilanz Tragwerk", "fehlt"), ("Regenwassermanagement", "vorhanden"),
            ("Barrierefreiheit", "in Prüfung"), ("Taxonomie-Screening", "nicht beauftragt"),
        ], "Die Übersicht prüft nur, ob Nachweise vorliegen. Sie ist keine ESG-, Taxonomie- oder Nachhaltigkeitszertifizierung.")],
    },
}


def write_pdf(path: Path, document: dict) -> int:
    body = ParagraphStyle("body", fontName="Helvetica", fontSize=10.2, leading=15, textColor=colors.HexColor("#243b40"))
    title = ParagraphStyle("title", parent=body, fontName="Helvetica-Bold", fontSize=18, leading=24, spaceAfter=14)
    muted = ParagraphStyle("muted", parent=body, fontSize=8.4, leading=12, textColor=colors.HexColor("#587178"))
    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=52, rightMargin=52, topMargin=46, bottomMargin=52,
                            title=document["title"], author="Document Intelligence Lab",
                            subject="Fictional use-case fixture - MIT", invariant=1)
    story = []
    for index, (heading, fields, text) in enumerate(document["pages"]):
        if index:
            story.append(PageBreak())
        rows = [[Paragraph(escape(label + ":"), body), Paragraph(escape(value), body)] for label, value in fields]
        table = Table(rows, colWidths=[190, 300])
        table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"), ("GRID", (0, 0), (-1, -1), .35, colors.HexColor("#d4e2e0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#edf5f2")),
            ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
            ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))
        story += [Paragraph("DOCUMENT INTELLIGENCE LAB · FICTIONAL USE-CASE FIXTURE", muted), Spacer(1, 8),
                  Paragraph(escape(heading), title), table, Spacer(1, 16), Paragraph(escape(text), body),
                  Spacer(1, 20), Paragraph(escape(FOOTER), muted)]
    doc.build(story)
    return len(document["pages"])


CSV = """type,name,planned,forecast
cost,KG 100 Grundstück,4200000.00,4200000.00
cost,KG 200 Herrichten und Erschließen,350000.00,380000.00
cost,KG 300/400 Bauwerk,9800000.00,10450000.00
cost,KG 700 Baunebenkosten,1650000.00,1720000.00
area,Wohnfläche m²,6500,
revenue,Basis,21450000.00,
revenue,Vorsichtig,18200000.00,
milestone,Baubeginn,2026-03-01,2026-03-01
milestone,Fertigstellung,2027-09-30,2027-12-15
"""


def t(en: str, de: str, vi: str) -> dict:
    return {"en": en, "de": de, "vi": vi}


def fixture(path: str, pages: int, digest: str, label: str = "FIKTIVE DATEN") -> dict:
    return {"path": path, "sha256": digest, "pages": pages, "label": label}


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    digests: dict[str, str] = {}
    pages: dict[str, int] = {}
    for name, document in DOCUMENTS.items():
        target = OUTPUT / name
        pages[name] = write_pdf(target, document)
        digests[name] = hashlib.sha256(target.read_bytes()).hexdigest()
    (OUTPUT / "projektbewertung-musterquartier.csv").write_text(CSV, encoding="utf-8")
    attachment = OUTPUT / "email-nachtragsangebot-musterquartier.pdf"
    message = {
        "_comment": "Fictional Gmail API message (format=full) used by tests and offline demos. Not real mail.",
        "id": "18c2f0a1b2c3d4e5", "threadId": "18c2f0a1b2c3d4e5", "internalDate": "1793001600000",
        "labelIds": ["INBOX", "Label_Nachtraege"],
        "payload": {"partId": "", "mimeType": "multipart/mixed", "filename": "",
                    "headers": [{"name": "Subject", "value": "Nachtragsangebot NA-2026-007 (fiktiv)"},
                                {"name": "From", "value": "Angebote <angebote@musterbau.example>"},
                                {"name": "Date", "value": "Mon, 26 Oct 2026 09:30:00 +0100"}],
                    "body": {"size": 0},
                    "parts": [{"partId": "0", "mimeType": "text/plain", "filename": "",
                               "body": {"size": 120, "data": "SGllciBkYXMgZmlrdGl2ZSBOYWNodHJhZ3NhbmdlYm90LiBCaXR0ZSBwcsO8ZmVuLg"}},
                              {"partId": "1", "mimeType": "application/pdf", "filename": "Nachtragsangebot-NA-2026-007.pdf",
                               "body": {"attachmentId": "ANGjdJ-fixture-attachment-001", "size": attachment.stat().st_size}}]},
    }
    (OUTPUT / "email-intake-message.json").write_text(json.dumps(message, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    real_estate = json.loads((RESOURCES / "real-estate/manifest.json").read_text(encoding="utf-8"))
    re_fixtures = [fixture("real-estate/" + s["file"], 1, s["sha256"], "FIKTIV") for s in real_estate["samples"]]
    uc = "use-cases/"
    boundary = t("Research support only. No legal, investment, payment, valuation or ESG certification decision.",
                 "Nur Forschungsunterstützung. Keine Rechts-, Investitions-, Zahlungs-, Bewertungs- oder ESG-Zertifizierungsentscheidung.",
                 "Chỉ hỗ trợ nghiên cứu. Không đưa ra quyết định pháp lý, đầu tư, thanh toán, định giá hay chứng nhận ESG.")
    catalog = {
        "version": "use-cases-v1",
        "license": "MIT",
        "provenance": "Authored fictional documents; no employer, customer, vendor or property-developer material.",
        "useCases": [
            {"id": "project-assessment",
             "title": t("Project and real-estate assessment", "Projekt- und Immobilienbewertung", "Đánh giá dự án và bất động sản"),
             "summary": t("Totals, cost variance, revenue scenarios, margin, cost per m² and schedule variance are computed in code from the CSV; a model may only explain them.",
                          "Summen, Kostenabweichung, Erlösszenarien, Marge, Kosten je m² und Terminabweichung werden im Code aus der CSV berechnet; ein Modell darf sie nur erläutern.",
                          "Tổng chi phí, chênh lệch chi phí, kịch bản doanh thu, biên lợi nhuận, chi phí/m² và chênh lệch tiến độ được tính bằng code từ CSV; mô hình chỉ được giải thích."),
             "fixtures": [fixture(uc + "projektbewertung-musterquartier.pdf", pages["projektbewertung-musterquartier.pdf"], digests["projektbewertung-musterquartier.pdf"])],
             "businessData": uc + "projektbewertung-musterquartier.csv", "businessDataSample": CSV,
             "fields": ["totalPlannedCost", "totalForecastCost", "areaSqm", "revenueScenarios", "milestones"],
             "expectedValidation": [
                 {"check": "costs.planned", "expected": "16000000.00"}, {"check": "costs.forecast", "expected": "16750000.00"},
                 {"check": "costs.variance", "expected": "750000.00"}, {"check": "costs.variancePercent", "expected": "4.69"},
                 {"check": "costPerSqm.planned", "expected": "2461.54"}, {"check": "costPerSqm.forecast", "expected": "2576.92"},
                 {"check": "margin.Basis", "expected": "4700000.00"}, {"check": "marginPercent.Basis", "expected": "21.91"},
                 {"check": "margin.Vorsichtig", "expected": "1450000.00"}, {"check": "marginPercent.Vorsichtig", "expected": "7.97"},
                 {"check": "varianceDays.Fertigstellung", "expected": "76"}, {"check": "humanReviewRequired", "expected": "true"}],
             "answerable": {"question": t("What total forecast cost does the assessment state?", "Welche prognostizierten Gesamtkosten nennt die Bewertung?", "Bản đánh giá nêu tổng chi phí dự báo là bao nhiêu?"),
                            "answer": "16.750.000,00 EUR", "evidence": {"path": uc + "projektbewertung-musterquartier.pdf", "page": 1, "quote": "16.750.000,00 EUR"}},
             "unanswerable": {"question": t("What is the appraised market value?", "Wie hoch ist der Verkehrswert laut Gutachten?", "Giá trị thị trường theo thẩm định là bao nhiêu?"),
                              "absentTerms": ["Verkehrswert", "Gutachten"], "expected": "abstain"},
             "boundary": boundary},
            {"id": "email-intake",
             "title": t("Document intake from email", "Dokumenteneingang per E-Mail", "Tiếp nhận tài liệu từ email"),
             "summary": t("A fictional Gmail message with a PDF attachment enters the shared pipeline; offline it is served by a mock, never by real mail.",
                          "Eine fiktive Gmail-Nachricht mit PDF-Anhang läuft durch die gemeinsame Pipeline; offline liefert ein Mock sie, nie echte Post.",
                          "Một email Gmail giả lập có PDF đính kèm đi vào pipeline chung; khi offline do mock cung cấp, không dùng thư thật."),
             "fixtures": [fixture(uc + "email-nachtragsangebot-musterquartier.pdf", 1, digests["email-nachtragsangebot-musterquartier.pdf"])],
             "mockMessage": uc + "email-intake-message.json",
             "fields": ["changeOrderNumber", "relatedOrder", "changeOrderAmount", "validUntil"],
             "expectedValidation": [{"check": "attachments", "expected": "1"}, {"check": "Nachtragsnummer", "expected": "NA-2026-007"},
                                    {"check": "Bezug Auftrag", "expected": "AUF-2026-112"}, {"check": "Nachtragssumme", "expected": "18.400,00 EUR netto"}],
             "answerable": {"question": t("Which change-order amount does the offer state?", "Welche Nachtragssumme nennt das Angebot?", "Đề nghị nêu giá trị bổ sung là bao nhiêu?"),
                            "answer": "18.400,00 EUR netto", "evidence": {"path": uc + "email-nachtragsangebot-musterquartier.pdf", "page": 1, "quote": "18.400,00 EUR netto"}},
             "unanswerable": {"question": t("Has the change order already been commissioned?", "Wurde der Nachtrag bereits beauftragt?", "Phần bổ sung đã được giao thầu chưa?"),
                              "absentTerms": ["beauftragt am", "Beauftragungsdatum"], "expected": "abstain"},
             "boundary": boundary},
            {"id": "classification-extraction",
             "title": t("Classification and extraction", "Klassifikation und Extraktion", "Phân loại và trích xuất tài liệu"),
             "summary": t("Detect the document type and extract invoice fields; net plus VAT must equal gross. The insurance classification benchmark measures classification separately.",
                          "Dokumenttyp erkennen und Rechnungsfelder extrahieren; Netto plus USt muss Brutto ergeben. Der Versicherungs-Benchmark misst Klassifikation getrennt.",
                          "Nhận diện loại tài liệu và trích xuất trường hóa đơn; tiền trước thuế cộng VAT phải bằng tổng. Benchmark phân loại bảo hiểm đo riêng phần phân loại."),
             "fixtures": [fixture(uc + "eingangsrechnung-musterquartier.pdf", 1, digests["eingangsrechnung-musterquartier.pdf"])],
             "fields": ["documentType", "invoiceNumber", "netAmount", "vatAmount", "grossAmount"],
             "expectedValidation": [{"check": "documentType", "expected": "invoice"}, {"check": "net+vat=gross", "expected": "42000.00+7980.00=49980.00"}],
             "answerable": {"question": t("What gross amount does the invoice state?", "Welchen Bruttobetrag nennt die Rechnung?", "Hóa đơn nêu tổng tiền sau thuế là bao nhiêu?"),
                            "answer": "49.980,00 EUR", "evidence": {"path": uc + "eingangsrechnung-musterquartier.pdf", "page": 1, "quote": "49.980,00 EUR"}},
             "unanswerable": {"question": t("Has the invoice been paid?", "Wurde die Rechnung bereits bezahlt?", "Hóa đơn đã được thanh toán chưa?"),
                              "absentTerms": ["bezahlt am", "Zahlungseingang"], "expected": "abstain"},
             "boundary": boundary},
            {"id": "project-status",
             "title": t("Project status summary", "Zusammenfassung des Projektstatus", "Tổng hợp trạng thái dự án"),
             "summary": t("Labelled status lines are extracted deterministically; a model may draft wording only from those cited lines.",
                          "Beschriftete Statuszeilen werden deterministisch extrahiert; ein Modell darf nur aus diesen zitierten Zeilen formulieren.",
                          "Các dòng trạng thái có nhãn được trích xuất xác định; mô hình chỉ được soạn câu từ chính các dòng đã trích dẫn."),
             "fixtures": [fixture(uc + "projektstatus-musterquartier.pdf", pages["projektstatus-musterquartier.pdf"], digests["projektstatus-musterquartier.pdf"])],
             "fields": ["Projektphase", "Status", "Fertigstellungsgrad Rohbau", "Nächster Meilenstein", "Offene Risiken"],
             "expectedValidation": [{"check": "Projektphase", "expected": "Rohbau"}, {"check": "Status", "expected": "Im Plan mit Terminrisiko"},
                                    {"check": "Fertigstellungsgrad Rohbau", "expected": "62 %"}, {"check": "risks", "expected": "2"}],
             "answerable": {"question": t("When is the topping-out ceremony planned?", "Wann ist das Richtfest geplant?", "Lễ cất nóc dự kiến vào ngày nào?"),
                            "answer": "14.11.2026", "evidence": {"path": uc + "projektstatus-musterquartier.pdf", "page": 1, "quote": "Richtfest am 14.11.2026"}},
             "unanswerable": {"question": t("What is the tenant occupancy rate?", "Wie hoch ist die Mieterauslastung?", "Tỷ lệ lấp đầy khách thuê là bao nhiêu?"),
                              "absentTerms": ["Mieterauslastung", "Vermietungsstand"], "expected": "abstain"},
             "boundary": boundary},
            {"id": "contract-risk",
             "title": t("Contract and risk check", "Vertrags- und Risikoprüfung", "Kiểm tra hợp đồng và rủi ro"),
             "summary": t("Clause values are extracted and compared with review thresholds; a triggered threshold asks a person to review, it is not legal advice.",
                          "Klauselwerte werden extrahiert und mit Prüfschwellen verglichen; eine ausgelöste Schwelle bittet um menschliche Prüfung und ist keine Rechtsberatung.",
                          "Giá trị điều khoản được trích xuất và so với ngưỡng cần xem xét; vượt ngưỡng chỉ yêu cầu người kiểm tra, không phải tư vấn pháp lý."),
             "fixtures": [fixture(uc + "bauvertrag-musterquartier.pdf", 1, digests["bauvertrag-musterquartier.pdf"])],
             "fields": ["contractSum", "penaltyPerWorkingDay", "penaltyCap", "warrantyPeriod", "securityRetention"],
             "expectedValidation": [{"check": "penaltyPerDayPercent", "expected": "0.3"}, {"check": "penaltyCapPercent", "expected": "5"},
                                    {"check": "warrantyYears", "expected": "5"}, {"check": "PENALTY_RATE_ABOVE_REVIEW_THRESHOLD", "expected": "true"},
                                    {"check": "PENALTY_CAP_ABOVE_REVIEW_THRESHOLD", "expected": "false"}, {"check": "WARRANTY_BELOW_REVIEW_THRESHOLD", "expected": "false"}],
             "answerable": {"question": t("How long is the warranty period?", "Wie lang ist die Gewährleistungsfrist?", "Thời hạn bảo hành là bao lâu?"),
                            "answer": "5 Jahre ab Abnahme", "evidence": {"path": uc + "bauvertrag-musterquartier.pdf", "page": 1, "quote": "5 Jahre ab Abnahme"}},
             "unanswerable": {"question": t("Is the penalty clause legally enforceable?", "Ist die Vertragsstrafenklausel wirksam?", "Điều khoản phạt có hiệu lực pháp lý không?"),
                              "absentTerms": ["wirksam", "unwirksam"], "expected": "abstain"},
             "boundary": boundary},
            {"id": "order-change-invoice-acceptance",
             "title": t("Order, change order, invoice and acceptance reconciliation", "Abgleich Auftrag – Nachtrag – Rechnung – Abnahme", "Đối chiếu Auftrag – Nachtrag – Rechnung – Abnahme"),
             "summary": t("The existing deterministic dossier review links references, flags the EUR 1,200 variance and carries two open defects into human review.",
                          "Die bestehende deterministische Dossierprüfung verknüpft Referenzen, markiert die Abweichung von 1.200 EUR und übergibt zwei offene Mängel an die menschliche Prüfung.",
                          "Bộ kiểm tra hồ sơ xác định hiện có liên kết các tham chiếu, đánh dấu chênh lệch 1.200 EUR và chuyển hai lỗi còn mở sang bước người kiểm tra."),
             "fixtures": re_fixtures,
             "fields": ["projectId", "orderNumber", "orderSum", "changeOrderSum", "invoiceTotal", "openDefects", "deadline"],
             "expectedValidation": [{"check": "variance", "expected": "1.200,00 EUR"}, {"check": "openDefects", "expected": "2"}],
             "answerable": {"question": t("What order sum does the construction order state?", "Welche Auftragssumme nennt der Bauauftrag?", "Hợp đồng thi công nêu giá trị đơn hàng là bao nhiêu?"),
                            "answer": "184.450,00 EUR", "evidence": {"path": "real-estate/fictional-construction-order.pdf", "page": 1, "quote": "184.450,00 EUR"}},
             "unanswerable": {"question": t("Was the invoice approved for payment?", "Wurde die Rechnung zur Zahlung freigegeben?", "Hóa đơn đã được duyệt thanh toán chưa?"),
                              "absentTerms": ["zur Zahlung freigegeben", "Zahlungsfreigabe erteilt"], "expected": "abstain"},
             "boundary": boundary},
            {"id": "esg-evidence",
             "title": t("ESG evidence completeness", "Vollständigkeit der ESG-Nachweise", "Kiểm tra mức độ đầy đủ của chứng cứ ESG"),
             "summary": t("Counts which required evidence items are present, missing or pending; it never certifies ESG, taxonomy or sustainability compliance.",
                          "Zählt, welche geforderten Nachweise vorliegen, fehlen oder in Prüfung sind; es wird nie eine ESG-, Taxonomie- oder Nachhaltigkeitskonformität bescheinigt.",
                          "Đếm các chứng cứ bắt buộc đã có, còn thiếu hoặc đang xét; không bao giờ chứng nhận tuân thủ ESG, taxonomy hay bền vững."),
             "fixtures": [fixture(uc + "esg-nachweise-musterquartier.pdf", 1, digests["esg-nachweise-musterquartier.pdf"])],
             "fields": ["Energieausweis", "GEG-Nachweis", "Ökobilanz Tragwerk", "Regenwassermanagement", "Barrierefreiheit", "Taxonomie-Screening"],
             "expectedValidation": [{"check": "present", "expected": "3"}, {"check": "missing", "expected": "2"}, {"check": "pending", "expected": "1"},
                                    {"check": "completenessPercent", "expected": "50"}],
             "answerable": {"question": t("Until when is the energy certificate valid?", "Bis wann ist der Energieausweis gültig?", "Chứng chỉ năng lượng có hiệu lực đến khi nào?"),
                            "answer": "2036", "evidence": {"path": uc + "esg-nachweise-musterquartier.pdf", "page": 1, "quote": "gültig bis 2036"}},
             "unanswerable": {"question": t("Does the project comply with the EU taxonomy?", "Erfüllt das Projekt die EU-Taxonomie?", "Dự án có tuân thủ EU Taxonomy không?"),
                              "absentTerms": ["taxonomiekonform", "erfüllt die EU-Taxonomie"], "expected": "abstain"},
             "boundary": boundary},
            {"id": "knowledge-assistant",
             "title": t("Knowledge assistant with citations", "Wissensassistent mit Quellenangaben", "Trợ lý tri thức có trích nguồn"),
             "summary": t("Questions across the status report, contract and ESG overview are answered only with cited evidence; unsupported questions are refused.",
                          "Fragen über Statusbericht, Vertrag und ESG-Übersicht werden nur mit zitierter Evidenz beantwortet; nicht belegte Fragen werden abgelehnt.",
                          "Câu hỏi trên báo cáo trạng thái, hợp đồng và tổng quan ESG chỉ được trả lời kèm chứng cứ trích dẫn; câu hỏi không có căn cứ bị từ chối."),
             "fixtures": [fixture(uc + "projektstatus-musterquartier.pdf", pages["projektstatus-musterquartier.pdf"], digests["projektstatus-musterquartier.pdf"]),
                          fixture(uc + "bauvertrag-musterquartier.pdf", 1, digests["bauvertrag-musterquartier.pdf"]),
                          fixture(uc + "esg-nachweise-musterquartier.pdf", 1, digests["esg-nachweise-musterquartier.pdf"])],
             "fields": ["citations", "abstention"],
             "expectedValidation": [{"check": "answerCitesSourcePage", "expected": "true"}, {"check": "unsupportedQuestionAbstains", "expected": "true"}],
             "answerable": {"question": t("Which warranty period does the construction contract state?", "Welche Gewährleistungsfrist nennt der Bauvertrag?", "Hợp đồng thi công nêu thời hạn bảo hành nào?"),
                            "answer": "5 Jahre ab Abnahme", "evidence": {"path": uc + "bauvertrag-musterquartier.pdf", "page": 1, "quote": "5 Jahre ab Abnahme"}},
             "unanswerable": {"question": t("How high is the property tax for the project?", "Wie hoch ist die Grundsteuer für das Projekt?", "Thuế bất động sản của dự án là bao nhiêu?"),
                              "absentTerms": ["Grundsteuer"], "expected": "abstain"},
             "boundary": boundary},
        ],
    }
    (OUTPUT / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(DOCUMENTS)} fictional PDFs, a CSV, a mock Gmail message and {len(catalog['useCases'])} use cases in {OUTPUT}")


if __name__ == "__main__":
    main()
