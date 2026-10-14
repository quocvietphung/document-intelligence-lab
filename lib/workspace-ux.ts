import {workspaceTarget} from "./nova-guide";

export function workspaceCaseFromSearch(search: string) {
  const id = new URLSearchParams(search).get("case");
  return id && /^CR-[a-zA-Z0-9-]{1,80}$/.test(id) ? id : undefined;
}

export function workspaceLocalePath(hash: string, caseId?: string) {
  const target = workspaceTarget(hash);
  const query = caseId && /^CR-[a-zA-Z0-9-]{1,80}$/.test(caseId)
    ? `?case=${encodeURIComponent(caseId)}` : "";
  return `/${query}${target ? `#${target}` : ""}`;
}

export function workspaceErrorKey(status: number) {
  if (status === 401) return "sessionExpired";
  if (status === 403) return "accessDenied";
  if (status === 409) return "conflict";
  if (status === 429) return "limit";
  if (status === 422) return "fileRejected";
  if (status >= 500) return "serviceUnavailable";
  return "error";
}

export function showCaseEmpty(count: number, loading: boolean, error: string) {
  return count === 0 && !loading && !error;
}

const en = {
  title: "Your AI tools, at a glance",
  hint: "Start with a source document. AI helps inspect and explain; a person verifies the result.",
  documents: "Analyze a payslip",
  documentHint: "Preview a fictional DATEV reference or upload a sample. Compare extracted fields and tables with the original PDF.",
  azure: "Azure Document Intelligence configured",
  local: "Local PDFBox / Tesseract extraction",
  demo: "Read-only sample evidence",
  unknown: "Extraction provider not yet confirmed",
  documentAction: "Open documents",
  retrieval: "Search the evidence",
  retrievalHint: "Find case-scoped passages and inspect their sources. Retrieval scores are relevance indicators, not accuracy percentages.",
  retrievalAction: "Open AI Studio",
  nova: "Ask Nova",
  novaHint: "Ask a complete question about this case. Each reply identifies its mode: app guide, guard or Azure AI.",
  novaAction: "Chat with Nova",
  documentsSubtitle: "Preview sources, analyze fictional payroll documents and verify every extracted field.",
  bankingSubtitle: "Inspect statements and invoices from uploaded PDFs. No generated accounts or transactions.",
  auditSubtitle: "Follow saved workflow changes and reviewer confirmations for the selected case.",
};
const de: typeof en = {
  title: "Deine KI-Werkzeuge auf einen Blick",
  hint: "Beginne mit einem Quelldokument. KI hilft beim Prüfen und Erklären; ein Mensch bestätigt das Ergebnis.",
  documents: "Gehaltsabrechnung analysieren",
  documentHint: "Sieh dir ein fiktives DATEV-Muster an oder lade einen Beispielbeleg hoch. Vergleiche extrahierte Felder und Tabellen mit dem Original-PDF.",
  azure: "Azure Document Intelligence konfiguriert",
  local: "Lokale Extraktion mit PDFBox / Tesseract",
  demo: "Schreibgeschützte Beispielbelege",
  unknown: "Extraktionsdienst noch nicht bestätigt",
  documentAction: "Dokumente öffnen",
  retrieval: "Belege durchsuchen",
  retrievalHint: "Finde vorgangsbezogene Textstellen und prüfe ihre Quellen. Suchwerte zeigen Relevanz, keine prozentuale Genauigkeit.",
  retrievalAction: "AI Studio öffnen",
  nova: "Nova fragen",
  novaHint: "Stelle eine vollständige Frage zum Vorgang. Jede Antwort kennzeichnet ihren Modus: App-Hilfe, Schutzregel oder Azure-KI.",
  novaAction: "Mit Nova sprechen",
  documentsSubtitle: "Quellen ansehen, fiktive Gehaltsabrechnungen analysieren und jedes extrahierte Feld prüfen.",
  bankingSubtitle: "Kontoauszüge und Rechnungen aus hochgeladenen PDFs prüfen. Keine erzeugten Konten oder Umsätze.",
  auditSubtitle: "Gespeicherte Änderungen und manuelle Bestätigungen zum ausgewählten Vorgang nachvollziehen.",
};
const vi: typeof en = {
  title: "Các công cụ AI của bạn",
  hint: "Bắt đầu từ tài liệu nguồn. AI hỗ trợ kiểm tra và giải thích; con người xác nhận kết quả.",
  documents: "Phân tích bảng lương",
  documentHint: "Xem mẫu DATEV giả lập hoặc tải tài liệu mẫu lên. Đối chiếu các trường và bảng đã trích xuất với PDF gốc.",
  azure: "Đã cấu hình Azure Document Intelligence",
  local: "Trích xuất local bằng PDFBox / Tesseract",
  demo: "Chứng cứ mẫu chỉ để xem",
  unknown: "Chưa xác nhận dịch vụ trích xuất",
  documentAction: "Mở tài liệu",
  retrieval: "Tìm trong chứng cứ",
  retrievalHint: "Tìm đoạn văn thuộc hồ sơ và kiểm tra nguồn. Điểm truy xuất biểu thị mức liên quan, không phải phần trăm chính xác.",
  retrievalAction: "Mở AI Studio",
  nova: "Hỏi Nova",
  novaHint: "Đặt câu hỏi đầy đủ về hồ sơ. Mỗi câu trả lời ghi rõ chế độ: hướng dẫn app, bảo vệ hoặc Azure AI.",
  novaAction: "Trò chuyện với Nova",
  documentsSubtitle: "Xem nguồn, phân tích bảng lương giả lập và kiểm tra từng trường được trích xuất.",
  bankingSubtitle: "Kiểm tra sao kê và hóa đơn từ PDF đã nhập. Không tự tạo tài khoản hay giao dịch.",
  auditSubtitle: "Theo dõi thay đổi đã lưu và xác nhận kiểm duyệt của hồ sơ đang chọn.",
};
export const workspaceUxTables = {en, de, vi};
export function workspaceUxText(locale: string) {
  return workspaceUxTables[locale === "de" ? "de" : locale === "vi" ? "vi" : "en"];
}
