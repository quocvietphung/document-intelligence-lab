package dev.creditlab.trust;

import java.util.*;

/** App-owned tasks, not user-programmable agents. No write/payment tools. */
public final class TrustCatalog {
  private TrustCatalog() {}
  public static final String PROMPT_VERSION="nova-evidence-2026-10-v3";
  public static final String TASK_PATTERN="summary|reconcile|explain|request-documents|review-checklist|terminology|bilingual-summary";
  public static final List<String> TASKS=List.of("summary","reconcile","explain","request-documents","review-checklist","terminology","bilingual-summary");
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
}
