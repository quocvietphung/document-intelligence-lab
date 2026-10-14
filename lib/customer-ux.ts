import type {BankingData} from "./banking";
import type {WorkspaceTab} from "./nova-guide";

export const customerUxTables = {
  en: {reset:"Clear filters",results:"Matching transactions",filtered:"For the current filters",details:"Transaction details",inspect:"View details",explain:"Explain this transaction",opening:"Opening balance",net:"Net movement",changeCase:"Switch case",hideCases:"Hide cases",cases:"available cases",suggestions:"Try asking",fillHint:"Choose a question, then press Send. Nothing is sent automatically.",copy:"Copy answer",copied:"Copied",copyFailed:"Copy unavailable — select the text instead",latest:"Latest messages",question:"Your previous question is kept below. You can edit it before sending again.",technical:"Technical details",HIGH:"High priority",MEDIUM:"Review needed",LOW:"Information",DUPLICATE_INVOICE:"Invoice already paid in sample data",UNVERIFIED_BENEFICIARY:"Recipient needs verification",UNREVIEWED_DOCUMENT:"Document not yet confirmed",duplicateHint:"A sample movement already covers this invoice. Inspect the evidence; this is not a fraud determination.",beneficiaryHint:"The sample recipient is unverified. A simulation must not be prepared for this recipient.",documentHint:"Open the original document and verify the extracted fields before confirming.",history:"Previous failed attempt — a newer job is available",noMatches:"No matches. Clear the filters or try a shorter search."},
  de: {reset:"Filter zurücksetzen",results:"Passende Umsätze",filtered:"Für die aktuellen Filter",details:"Umsatzdetails",inspect:"Details ansehen",explain:"Diesen Umsatz erklären",opening:"Anfangssaldo",net:"Nettobewegung",changeCase:"Vorgang wechseln",hideCases:"Vorgänge ausblenden",cases:"verfügbare Vorgänge",suggestions:"Frage zum Beispiel",fillHint:"Wähle eine Frage und klicke dann auf Senden. Nichts wird automatisch gesendet.",copy:"Antwort kopieren",copied:"Kopiert",copyFailed:"Kopieren nicht verfügbar — Text manuell auswählen",latest:"Neueste Nachrichten",question:"Deine vorherige Frage steht unten. Du kannst sie vor dem erneuten Senden bearbeiten.",technical:"Technische Details",HIGH:"Hohe Priorität",MEDIUM:"Prüfung erforderlich",LOW:"Information",DUPLICATE_INVOICE:"Rechnung in den Musterdaten bereits bezahlt",UNVERIFIED_BENEFICIARY:"Empfängerprüfung erforderlich",UNREVIEWED_DOCUMENT:"Dokument noch nicht bestätigt",duplicateHint:"Ein Musterumsatz deckt diese Rechnung bereits ab. Belege prüfen; dies ist keine Betrugsfeststellung.",beneficiaryHint:"Der Musterempfänger ist ungeprüft. Für ihn darf keine Simulation vorbereitet werden.",documentHint:"Original öffnen und extrahierte Felder vor der Bestätigung prüfen.",history:"Früherer Fehlversuch — ein neuerer Auftrag ist vorhanden",noMatches:"Keine Treffer. Filter zurücksetzen oder kürzer suchen."},
  vi: {reset:"Xóa bộ lọc",results:"Giao dịch phù hợp",filtered:"Theo bộ lọc hiện tại",details:"Chi tiết giao dịch",inspect:"Xem chi tiết",explain:"Giải thích giao dịch này",opening:"Số dư ban đầu",net:"Chênh lệch thu chi",changeCase:"Đổi hồ sơ",hideCases:"Ẩn danh sách hồ sơ",cases:"hồ sơ có sẵn",suggestions:"Bạn có thể hỏi",fillHint:"Chọn câu hỏi rồi nhấn Gửi. Không tự động gửi lên AI.",copy:"Sao chép câu trả lời",copied:"Đã sao chép",copyFailed:"Chưa sao chép được — hãy chọn văn bản để sao chép",latest:"Tin nhắn mới nhất",question:"Câu hỏi trước vẫn được giữ bên dưới. Bạn có thể sửa trước khi gửi lại.",technical:"Chi tiết kỹ thuật",HIGH:"Ưu tiên cao",MEDIUM:"Cần kiểm tra",LOW:"Thông tin",DUPLICATE_INVOICE:"Hóa đơn đã trả trong dữ liệu mẫu",UNVERIFIED_BENEFICIARY:"Cần xác minh người nhận",UNREVIEWED_DOCUMENT:"Tài liệu chưa được xác nhận",duplicateHint:"Đã có giao dịch mẫu cho hóa đơn này. Kiểm tra chứng cứ; đây không phải kết luận gian lận.",beneficiaryHint:"Người nhận trong dữ liệu mẫu chưa được xác minh. Không tạo mô phỏng cho người nhận này.",documentHint:"Mở tài liệu gốc và kiểm tra các trường trích xuất trước khi xác nhận.",history:"Lần thất bại trước — đã có lần xử lý mới hơn",noMatches:"Không có kết quả. Xóa bộ lọc hoặc tìm bằng từ ngắn hơn."},
};
export function customerUx(locale:string) {return customerUxTables[locale==="de"?"de":locale==="vi"?"vi":"en"];}
export function searchText(text:string) {return text.normalize("NFD").replace(/\p{M}/gu,"").toLowerCase().replaceAll("ß","ss").replaceAll("đ","d").trim();}
export type TransactionFilters={account:string;query:string;direction:string;from:string;to:string};
export function filterTransactions(rows:BankingData["transactions"],filter:TransactionFilters) {
  const query=searchText(filter.query);
  return rows.filter(row=>(filter.account==="all"||row.accountId===filter.account)&&searchText(`${row.counterparty} ${row.reference}`).includes(query)&&
    (filter.direction==="any"||(filter.direction==="in"?row.amountCents>0:row.amountCents<0))&&(!filter.from||row.date>=filter.from)&&(!filter.to||row.date<=filter.to))
    .toSorted((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
}
export function transactionTotals(rows:BankingData["transactions"]) {
  const incoming=rows.reduce((sum,row)=>sum+Math.max(row.amountCents,0),0);
  const outgoing=rows.reduce((sum,row)=>sum+Math.max(-row.amountCents,0),0);
  return {incoming,outgoing,net:incoming-outgoing,count:rows.length};
}
export function bankDate(value:string,locale:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value)))return value;
  return new Intl.DateTimeFormat(locale==="de"?"de-DE":locale==="vi"?"vi-VN":"en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T00:00:00Z`));
}
export function nearChatBottom(scrollTop:number,clientHeight:number,scrollHeight:number) {return scrollHeight-scrollTop-clientHeight<80;}
export function reviewAlertPresentation(alert:{code:string;severity:string;detail:string},locale:string,documents:readonly {id:string;name:string}[]) {
  const t=customerUx(locale),code=alert.code as keyof typeof t;
  const detail=alert.code==="DUPLICATE_INVOICE"?t.duplicateHint:alert.code==="UNVERIFIED_BENEFICIARY"?t.beneficiaryHint:
    alert.code==="UNREVIEWED_DOCUMENT"?`${documents.find(doc=>doc.id===alert.detail)?.name||alert.detail} · ${t.documentHint}`:alert.detail;
  return {title:t[code]||alert.code,detail,severity:t[alert.severity as keyof typeof t]||alert.severity};
}
export function novaSuggestions(locale:string,page:WorkspaceTab) {
  const labels=customerUx(locale);
  const language=locale==="vi"?"vi":locale==="de"?"de":"en";
  const questions={
    en:[`How do I use ${page==="studio"?"AI Studio":page==="banking"?"banking evidence":"this page"}?`,"What evidence is missing from this case?","Explain net earnings versus the payslip payout."],
    de:[`Wie nutze ich ${page==="studio"?"AI Studio":page==="banking"?"Bankbelege":"diese Seite"}?`,"Welche Belege fehlen in diesem Vorgang?","Erkläre Netto-Verdienst und Auszahlungsbetrag der Gehaltsabrechnung."],
    vi:[`Hướng dẫn sử dụng ${page==="studio"?"AI Studio":page==="banking"?"chứng cứ ngân hàng":"trang này"}.`,"Hồ sơ này còn thiếu chứng cứ nào?","Giải thích lương ròng và khoản thực chi trên bảng lương."],
  }[language];
  return {label:labels.suggestions,hint:labels.fillHint,questions};
}
