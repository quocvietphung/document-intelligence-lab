package dev.creditlab.trust;

import java.util.*;

/** App-owned tasks, not user-programmable agents. No write/payment tools. */
public final class TrustCatalog {
  private TrustCatalog() {}
  public static final String PROMPT_VERSION="nova-document-domains-2026-10-v7";
  public static final String TASK_PATTERN="summary|reconcile|explain|request-documents|review-checklist|terminology|bilingual-summary|timeline|obligations|privacy-review";
  public static final List<String> TASKS=List.of("summary","reconcile","explain","request-documents","review-checklist","terminology","bilingual-summary","timeline","obligations","privacy-review");
  public static List<Map<String,Object>> features() {
    var result=new ArrayList<Map<String,Object>>();
    var ids=new ArrayList<>(TASKS);ids.addFirst("nova");
    for(String id:ids)result.add(Map.of(
        "id",id,"owner","PLATFORM_ADMIN","scope","case","promptVersion",PROMPT_VERSION,
        "inputs",List.of("current case","authorized evidence"),"tools",List.of("read case","read evidence"),
        "humanReview",true,"payments",false,"limits","Existing shared request/token limits; max 2,000-character question",
        "testSuite","TrustWorkflowTest + CreditAssistantServiceTest"));
    return List.copyOf(result);
  }
  public static String question(String id,String locale) {
    if(!TASKS.contains(id))throw new IllegalArgumentException("Unknown task");
    if(id.equals("timeline"))return locale.equals("vi")?
      "Lập dòng thời gian từ PDF gốc: ngày ghi trên tài liệu, sự kiện tương ứng, trang nguồn và điều chưa rõ. Giữ nguyên chuỗi ngày gốc, không đoán múi giờ hay ngày còn thiếu; phân biệt ngày xuất bản, kỳ tài liệu và hạn được ghi rõ. Không suy ra ngày hết hạn có tính pháp lý. Tối đa 6 mục; đây là bản nháp cần người kiểm tra.":locale.equals("de")?
      "Erstelle eine Zeitleiste aus den Original-PDFs: originales Datum, zugehöriges Ereignis, Quellseite und Unklarheiten. Unterscheide Veröffentlichungsdatum, Dokumentzeitraum und ausdrücklich genannte Fristen. Keine fehlenden Daten oder Zeitzonen erfinden und keine rechtliche Frist berechnen. Höchstens sechs Punkte; Entwurf zur manuellen Prüfung.":
      "Build a chronology from the original PDFs: verbatim date, associated event, source page and uncertainty. Distinguish publication dates, document periods and explicitly stated deadlines. Do not invent missing dates or time zones or calculate a legally binding deadline. At most six entries; draft for human review.";
    if(id.equals("obligations"))return locale.equals("vi")?
      "Chỉ từ các điều khoản thực sự có trong PDF gốc, liệt kê tối đa 5 nghĩa vụ, điều kiện hoặc loại trừ: chủ thể nếu ghi rõ, hành động, thời hạn được viết rõ, đoạn trích ngắn và nguồn trang. Đánh dấu phần thiếu/ngữ cảnh bị cắt. Không tự áp luật, xác định hiệu lực hợp đồng, quyền được bảo hiểm hay số tiền bồi thường. Đây là danh mục để chuyên viên kiểm tra, không phải tư vấn pháp lý.":locale.equals("de")?
      "Erfasse höchstens fünf im Original-PDF tatsächlich genannte Pflichten, Bedingungen oder Ausschlüsse: ausdrücklich benannte Partei, Handlung, wörtliche Frist, kurzes Zitat und Quellseite. Fehlendes oder abgeschnittenen Kontext kennzeichnen. Keine Rechtsanwendung, Vertragswirksamkeit, Deckungszusage oder Entschädigung bestimmen. Nur Prüfliste für Fachpersonen, keine Rechtsberatung.":
      "List at most five obligations, conditions or exclusions actually stated in the original PDFs: explicitly named party, action, verbatim deadline, short quotation and source page. Flag missing or excerpted context. Do not apply external law, determine contract enforceability, insurance eligibility, binding coverage or claim payout. A clause-review draft, not legal advice.";
    if(id.equals("privacy-review"))return locale.equals("vi")?
      "Rà soát PDF gốc để chuẩn bị kiểm tra dữ liệu nhạy cảm: chỉ nêu loại thông tin có thể nhận diện (tên, địa chỉ, mã tài khoản, định danh), trang nguồn và bước kiểm tra/che thủ công. Không chép lại giá trị nhạy cảm, không đoán danh tính hay thuộc tính nhạy cảm. Đánh dấu nội dung là mẫu/giả lập nếu nguồn nói vậy. Không sửa PDF hoặc tuyên bố đã ẩn danh hay tuân thủ; có thể bỏ sót nên phải kiểm tra bản gốc.":locale.equals("de")?
      "Prüfe die Original-PDFs auf mögliche Identifikatoren: nur Kategorien (Name, Anschrift, Kontokennung, Identifikator), Quellseite und manuelle Prüf-/Schwärzungsschritte nennen. Sensible Werte nicht wiederholen und keine Identität oder sensiblen Merkmale ableiten. Musterstatus nur nennen, wenn belegt. PDF nicht ändern und keine Anonymisierung oder Compliance behaupten; Vollständigkeit ist nicht garantiert.":
      "Review original PDFs for possible identifiers: report only categories (name, address, account identifier, identity reference), source page and manual inspection/redaction steps. Do not repeat sensitive values, infer identity or sensitive traits, or modify the PDF. Label synthetic/sample status only when evidenced. Do not claim anonymization, compliance or complete detection; a human must inspect the original.";
    if(id.equals("review-checklist"))return locale.equals("vi")?
      "Lập checklist kiểm tra chứng cứ cho hồ sơ giả lập đang chọn. Chia thành: chứng cứ đã có, tài liệu thiếu và việc con người cần kiểm tra. Mỗi mục ghi nguồn, thông tin chưa biết và bước kiểm tra cụ thể. Không tự xác nhận tài liệu, kết luận gian lận hay quyết định tín dụng.":locale.equals("de")?
      "Erstelle eine Belegprüf-Checkliste für diesen fiktiven Vorgang: vorhandene Belege, fehlende Unterlagen und manuelle Prüfschritte. Nenne je Punkt Quelle, unbekannte Angaben und konkrete nächste Prüfung. Keine automatische Belegfreigabe, Betrugsunterstellung oder Kreditentscheidung.":
      "Create an evidence-review checklist for this fictional case: available evidence, missing documents and human checks. Give the source, unknowns and a concrete verification step for each item. Do not approve documents, infer fraud or make a credit decision.";
    if(id.equals("terminology"))return locale.equals("vi")?
      "Giải thích các nhãn Đức thực sự có trong bảng lương/chứng cứ của hồ sơ này, đặc biệt Netto-Verdienst và Auszahlungsbetrag nếu có. Giữ nguyên nhãn Đức, nêu giá trị và trang nguồn khi thấy; giải thích khác biệt chỉ khi được chứng cứ hỗ trợ. Nhãn không có phải nói chưa tìm thấy. Không bịa nguyên nhân khấu trừ, định nghĩa pháp lý, luật thuế hay tư vấn tài chính.":locale.equals("de")?
      "Erkläre die tatsächlich vorhandenen deutschen Begriffe in Gehalts- und Dokumentbelegen dieses Vorgangs, insbesondere Netto-Verdienst und Auszahlungsbetrag falls vorhanden. Behalte Originalbegriffe, Werte und Seitenquellen bei. Unterschiede nur belegt erklären; fehlende Begriffe als nicht gefunden kennzeichnen. Keine erfundenen Abzüge, Rechtsdefinitionen oder Steuerberatung.":
      "Explain German labels actually present in this case's payroll/document evidence, especially Netto-Verdienst and Auszahlungsbetrag if found. Preserve German terms, values and page sources. Explain differences only when supported by evidence; explicitly mark absent terms. Do not invent deductions, legal definitions, tax rules or financial advice.";
    if(id.equals("bilingual-summary"))return "Create a side-by-side German–Vietnamese summary of this fictional case's document evidence, regardless of the interface language. Use paired DE / VI paragraphs with the same source citations and preserve names, dates, German monetary notation and amounts exactly. Separate observed facts from missing evidence and manual review steps. Do not invent missing values or legal advice, approve credit, or claim a certified translation. This is a draft for human review.";
    String[] en={"Summarize this fictional case: available evidence, missing documents, contradictions and next evidence-review steps. Cite a source for each factual statement; do not assess creditworthiness.",
      "Compare the payroll evidence with the statement evidence in this fictional case. Check person, period and payout versus salary entry. Say explicitly when any of these is unknown; an amount-only match is not confirmation. Cite each source.",
      "Explain the recorded evidence inconsistencies in this fictional case. Separate facts, deterministic rules and interpretation. Cite sources and list what a reviewer must check; do not label a person as fraudulent.",
      "Draft an email requesting only the missing or unclear evidence in this fictional case. Keep references in a separate reviewer note, not in the customer email. This is an editable draft only; do not send it or promise credit approval."};
    String[] de={"Fasse diesen fiktiven Vorgang zusammen: vorhandene Belege, fehlende Unterlagen, Widersprüche und nächste Prüfschritte. Belege jede Tatsachenangabe mit einer Quelle; bewerte keine Kreditwürdigkeit.",
      "Vergleiche Gehaltsabrechnung und Kontoauszug dieses fiktiven Vorgangs. Prüfe Person, Zeitraum und Auszahlungsbetrag gegenüber Gehaltseingang. Benenne unbekannte Angaben; ein reiner Betragsvergleich ist keine Bestätigung. Zitiere die Quellen.",
      "Erkläre die erfassten Belegabweichungen dieses fiktiven Vorgangs. Trenne Fakten, Regeln und Interpretation. Zitiere Quellen und nenne die manuellen Prüfschritte; unterstelle keinen Betrug.",
      "Entwirf eine E-Mail zur Anforderung ausschließlich fehlender oder unklarer Belege dieses fiktiven Vorgangs. Quellen gehören in eine getrennte Prüfernotiz, nicht in die Kunden-E-Mail. Nur bearbeitbarer Entwurf; nichts versenden und keine Kreditzusage machen."};
    String[] vi={"Tóm tắt hồ sơ giả lập này: chứng cứ hiện có, tài liệu thiếu, mâu thuẫn và các bước kiểm tra tiếp theo. Dẫn nguồn cho từng thông tin thực tế; không đánh giá khả năng được cấp tín dụng.",
      "Đối chiếu bảng lương và sao kê trong hồ sơ giả lập này. Kiểm tra người, kỳ và khoản thực chi với tiền lương vào tài khoản. Nói rõ thông tin chưa biết; trùng số tiền chưa đủ xác nhận. Dẫn từng nguồn.",
      "Giải thích các mâu thuẫn chứng cứ đã ghi nhận trong hồ sơ giả lập này. Tách sự kiện, quy tắc và diễn giải. Dẫn nguồn và liệt kê việc người kiểm duyệt cần kiểm tra; không kết luận người nào gian lận.",
      "Soạn email yêu cầu bổ sung đúng các chứng cứ thiếu hoặc chưa rõ trong hồ sơ giả lập này. Để nguồn trong ghi chú riêng cho người kiểm duyệt, không trong email khách hàng. Chỉ là bản nháp để sửa; không gửi và không hứa duyệt tín dụng."};
    return (locale.equals("vi")?vi:locale.equals("de")?de:en)[TASKS.indexOf(id)];
  }
  public static String question(String id,String locale,String domain) {
    if(!TASKS.contains(id))throw new IllegalArgumentException("Unknown task");
    if(domain.equals("banking"))return question(id,locale);
    String intro=locale.equals("vi")?"Chỉ dùng tài liệu gốc của hồ sơ "+domain+" đang chọn. Dẫn trang nguồn; ghi rõ điều chưa biết. Không yêu cầu bảng lương hay sao kê nếu không liên quan. Không quyết định tín dụng, phạm vi bảo hiểm hay bồi thường. ":locale.equals("de")?"Nutze nur die Originalbelege des ausgewählten Bereichs "+domain+". Zitiere Quellseiten und benenne Unbekanntes. Keine sachfremden Gehalts- oder Kontoauszüge verlangen. Keine Kredit-, Deckungs- oder Regulierungsentscheidung. ":"Use only the selected "+domain+" dossier's originals. Cite page sources and state unknowns. Do not require unrelated payroll or bank statements. No lending, insurance coverage or settlement decisions. ";
    String task=switch(id) {
      case "reconcile" -> locale.equals("vi")?"Đối chiếu các tài liệu: mã tham chiếu, người, ngày và số tiền. Nếu là bảo hiểm, phân biệt phí, mức tự chịu và số tiền bảo hiểm; không coi chúng là khoản được bồi thường.":locale.equals("de")?"Vergleiche Dokumentreferenzen, Personen, Daten und Beträge. Unterscheide bei Versicherungen Beitrag, Selbstbeteiligung und Deckungssumme; diese sind keine zugesagte Entschädigung.":"Compare document references, people, dates and amounts. For insurance distinguish premium, deductible and coverage limit; none is a promised claim payout.";
      case "terminology" -> locale.equals("vi")?"Giải thích các thuật ngữ Đức thực sự có trong tài liệu, giữ nguyên nhãn gốc và giá trị. Không bịa định nghĩa pháp lý.":locale.equals("de")?"Erkläre die tatsächlich vorkommenden deutschen Dokumentbegriffe. Behalte Originalbezeichnungen und Werte bei. Keine erfundenen Rechtsdefinitionen.":"Explain German terms actually present in the documents, preserving original labels and values. Do not invent legal definitions.";
      default -> question(id,locale);
    };
    return intro+task;
  }
}
