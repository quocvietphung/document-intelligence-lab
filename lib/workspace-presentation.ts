import type {WorkspaceTab} from './nova-guide';

const en = {
  researchLab: "Research lab", reviewCenter: "Review & trust", sectionNavigation: "Sections in this workspace",
  experiments: "Experiments", domainInsights: "Domain insights", sourceInventory: "Document inventory",
  referenceLibrary: "Reference library", referenceHint: "Expand to preview or import permitted DATEV and Kaggle documents.",
  documentTools: "Document analysis", retrievalTools: "Evidence search", novaTools: "Nova assistance", pipelineTools: "Intake & processing", researchTools: "Research & evaluation", reviewTools: "Review & governance",
  research: "Research only",
  dossier: "Selected dossier",
  switchCase: "Switch dossier",
  details: "Dossier details",
  upload: "Add documents",
  batch: "Batch intake",
  batchHint: "Select up to four files, then review each result separately.",
  profile: "About this extraction profile",
  processing: "Processing, privacy & cloud details",
  processingSettings: "Processing & storage",
  repeated: "Repeat submissions",
  repeatedHint: "These receipts reused completed jobs. No history was deleted; open a receipt to inspect its source or result.",
  receipt: "Receipt",
  metadata: "Source & receipt details",
  cloud: "Cloud ingestion not connected",
  search: "Search", status: "Status", sort: "Sort", newest: "Newest first", oldest: "Oldest first", filename: "Filename",
  clear: "Reset filters", noMatches: "No documents match these filters.", shown: "shown", document: "Document", evidence: "Source checks", actions: "Actions",
  resultSearch: "Search filename or document type", allResults: "All results", awaitingReview: "Awaiting review", verified: "Human-verified",
  stages: "Processing stages", skip: "Skip to workspace content", trustSignIn: "AI transparency needs a signed-in lab account. Sign in to see answer history, review tasks and AI governance.",
  signInError: "Could not complete sign-in. Choose Sign in to retry.", sessionError: "The session action could not be completed. Retry your sign-in or sign-out action.",
};
const de: typeof en = {
  researchLab: "Forschungslabor", reviewCenter: "Prüfung & Vertrauen", sectionNavigation: "Bereiche dieses Arbeitsbereichs",
  experiments: "Experimente", domainInsights: "Fachliche Einblicke", sourceInventory: "Dokumentbestand",
  referenceLibrary: "Referenzbibliothek", referenceHint: "Für Vorschau oder Import erlaubter DATEV- und Kaggle-Dokumente aufklappen.",
  documentTools: "Dokumentanalyse", retrievalTools: "Belegsuche", novaTools: "Nova-Unterstützung", pipelineTools: "Import & Verarbeitung", researchTools: "Forschung & Evaluation", reviewTools: "Prüfung & Governance",
  research: "Nur Forschung",
  dossier: "Ausgewählter Vorgang",
  switchCase: "Vorgang wechseln",
  details: "Vorgangsdetails",
  upload: "Dokumente hinzufügen",
  batch: "Stapelimport",
  batchHint: "Bis zu vier Dateien auswählen und jedes Ergebnis einzeln prüfen.",
  profile: "Über dieses Extraktionsprofil",
  processing: "Verarbeitung, Datenschutz & Cloud",
  processingSettings: "Verarbeitung & Speicherung",
  repeated: "Erneute Einreichungen",
  repeatedHint: "Diese Belege nutzen abgeschlossene Aufträge. Der Verlauf bleibt erhalten; öffne einen Beleg für Quelle und Ergebnis.",
  receipt: "Beleg",
  metadata: "Quelle & Belegdetails",
  cloud: "Cloud-Import nicht verbunden",
  search: "Suchen", status: "Status", sort: "Sortieren", newest: "Neueste zuerst", oldest: "Älteste zuerst", filename: "Dateiname",
  clear: "Filter zurücksetzen", noMatches: "Keine Dokumente entsprechen diesen Filtern.", shown: "angezeigt", document: "Dokument", evidence: "Quellprüfung", actions: "Aktionen",
  resultSearch: "Dateiname oder Dokumenttyp suchen", allResults: "Alle Ergebnisse", awaitingReview: "Prüfung ausstehend", verified: "Menschlich bestätigt",
  stages: "Verarbeitungsschritte", skip: "Zum Arbeitsbereich springen", trustSignIn: "KI-Transparenz braucht ein angemeldetes Lab-Konto. Melde dich an, um Antwortverlauf, Prüfaufgaben und KI-Steuerung zu sehen.",
  signInError: "Anmeldung nicht abgeschlossen. Wähle Anmelden, um es erneut zu versuchen.", sessionError: "Die Sitzungsaktion konnte nicht abgeschlossen werden. Wiederhole die An- oder Abmeldung.",
};
const vi: typeof en = {
  researchLab: "Phòng nghiên cứu", reviewCenter: "Kiểm duyệt & minh bạch", sectionNavigation: "Các mục trong khu vực này",
  experiments: "Thí nghiệm", domainInsights: "Phân tích theo lĩnh vực", sourceInventory: "Danh mục tài liệu",
  referenceLibrary: "Thư viện tài liệu tham chiếu", referenceHint: "Mở để xem trước hoặc nhập tài liệu DATEV và Kaggle được phép sử dụng.",
  documentTools: "Phân tích tài liệu", retrievalTools: "Tìm chứng cứ", novaTools: "Trợ lý Nova", pipelineTools: "Tiếp nhận & xử lý", researchTools: "Nghiên cứu & đánh giá", reviewTools: "Kiểm duyệt & quản trị",
  research: "Chỉ dùng nghiên cứu",
  dossier: "Hồ sơ đang chọn",
  switchCase: "Đổi hồ sơ",
  details: "Chi tiết hồ sơ",
  upload: "Thêm tài liệu",
  batch: "Nhập theo lô",
  batchHint: "Chọn tối đa bốn tệp, sau đó kiểm tra riêng từng kết quả.",
  profile: "Về cấu hình trích xuất này",
  processing: "Xử lý, quyền riêng tư & cloud",
  processingSettings: "Xử lý & lưu trữ",
  repeated: "Các lần gửi lại",
  repeatedHint: "Các bản ghi này dùng lại tác vụ đã hoàn tất. Lịch sử vẫn được giữ; mở bản ghi để xem nguồn và kết quả.",
  receipt: "Bản ghi",
  metadata: "Nguồn & chi tiết tiếp nhận",
  cloud: "Chưa kết nối nhập nguồn cloud",
  search: "Tìm kiếm", status: "Trạng thái", sort: "Sắp xếp", newest: "Mới nhất trước", oldest: "Cũ nhất trước", filename: "Tên tệp",
  clear: "Đặt lại bộ lọc", noMatches: "Không có tài liệu phù hợp với bộ lọc.", shown: "đang hiện", document: "Tài liệu", evidence: "Kiểm tra nguồn", actions: "Thao tác",
  resultSearch: "Tìm tên tệp hoặc loại tài liệu", allResults: "Mọi kết quả", awaitingReview: "Chờ kiểm duyệt", verified: "Đã được người kiểm duyệt",
  stages: "Các bước xử lý", skip: "Đến nội dung chính", trustSignIn: "Minh bạch AI cần tài khoản lab đã đăng nhập. Đăng nhập để xem lịch sử câu trả lời, nhiệm vụ kiểm duyệt và quản trị AI.",
  signInError: "Chưa hoàn tất đăng nhập. Bấm Đăng nhập để thử lại.", sessionError: "Chưa hoàn tất thao tác phiên đăng nhập. Hãy thử đăng nhập hoặc đăng xuất lại.",
};
export const workspacePresentationLanguages = {en, de, vi};
export function workspacePresentation(locale: string) {
  return workspacePresentationLanguages[locale === "vi" ? "vi" : locale === "de" ? "de" : "en"];
}

/**
 * Navigation follows the work: take documents in, review them, analyse, then govern.
 * Every page is one click away; there are no hidden subpages and no page-level tab rows.
 * Hashes stay the same, so Nova links and page tours keep working.
 */
export const workspaceNavigation = [
  {title:'',pages:['overview']},
  {title:'intake',pages:['integrations','pipeline']},
  {title:'review',pages:['documents','controls','audit']},
  {title:'analysis',pages:['studio','experiments','banking','evaluation']},
  {title:'governance',pages:['trust','operations']},
] as const satisfies readonly {title:string;pages:readonly WorkspaceTab[]}[];
export type WorkspaceGroup=Exclude<typeof workspaceNavigation[number]['title'],''>;

type PageNames=Record<WorkspaceTab|WorkspaceGroup,string>;
/** The single name of each page and group. The sidebar, page title, page tour and Nova catalog all use it. */
export const workspacePageNameLanguages:Record<'en'|'de'|'vi',PageNames>={
  en:{overview:'Tasks',integrations:'Sources & integrations',pipeline:'Processing & data',documents:'Documents & evidence',controls:'Reconciliation',audit:'Activity log',
    studio:'AI Studio',experiments:'AI experiments',banking:'Domain insights',evaluation:'Document research',trust:'AI transparency',operations:'Operations',
    intake:'Intake',review:'Review',analysis:'Analysis',governance:'Governance'},
  de:{overview:'Aufgaben',integrations:'Quellen & Integrationen',pipeline:'Verarbeitung & Daten',documents:'Dokumente & Belege',controls:'Abgleich',audit:'Aktivitätsprotokoll',
    studio:'AI Studio',experiments:'KI-Experimente',banking:'Fachliche Einblicke',evaluation:'Dokumentrecherche',trust:'KI-Transparenz',operations:'Betrieb',
    intake:'Eingang',review:'Prüfung',analysis:'Analyse',governance:'Steuerung'},
  vi:{overview:'Việc cần làm',integrations:'Nguồn & tích hợp',pipeline:'Xử lý & dữ liệu',documents:'Tài liệu & chứng cứ',controls:'Đối chiếu dữ liệu',audit:'Nhật ký hoạt động',
    studio:'AI Studio',experiments:'Thí nghiệm AI',banking:'Phân tích theo lĩnh vực',evaluation:'Nghiên cứu tài liệu',trust:'Minh bạch AI',operations:'Vận hành',
    intake:'Nhận tài liệu',review:'Kiểm duyệt',analysis:'Phân tích',governance:'Quản trị'},
};
export function workspacePageName(locale:string,page:WorkspaceTab|WorkspaceGroup){
  return workspacePageNameLanguages[locale==='vi'?'vi':locale==='de'?'de':'en'][page];
}
