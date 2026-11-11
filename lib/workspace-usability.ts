import type {CreditDocument} from './credit-data';
import type {DocumentJob} from './document-results';
import {latestDocumentJobs,orderedResultDocuments} from './document-results';
import {dashboardFeatures,dashboardGroups} from './ai-dashboard';
import {trustSections,type TrustSection} from './nova-trust';
import {classificationLabels} from './document-classification';
import {documentClassName} from './document-classification-language';
import {batchText,extractionProfiles} from './document-batches';
import {languageTables} from './workspace-language';

/** Strings added by the workspace usability pass. Every key exists in English, German and Vietnamese. */
const en={
  attentionTitle:'Needs attention',failedTitle:'Processing failed',reviewTitle:'Awaiting review',
  allClear:'Nothing waits for you in this dossier. Add documents or ask a question to continue.',
  openProcessing:'Open processing',reviewNow:'Review now',
  recentTitle:'Recent documents',recentEmpty:'No documents in this dossier yet.',allDocuments:'All documents',
  startTitle:'Start a task',startAddHint:'Upload or import PDFs into the processing queue.',
  startAskHint:'Search the evidence and get answers with page citations.',startQualityHint:'Measure extraction and retrieval against checked labels.',
  catalogCount:'{count} features in the catalog',catalogShow:'Show all features',catalogHide:'Hide feature list',
  technology:'Technology in use',
  colDocument:'Document',colType:'Type',colStatus:'Review status',colActions:'Actions',moreActions:'More actions',
  actionReview:'Review',actionView:'View',askNova:'Ask Nova about this document',draftAction:'Create Gmail draft…',aiAssisted:'AI-assisted',
  reportScope:'Only confirmed fields, evidence pages and sources are exported.',
  draftNotConnected:'Gmail drafts are not connected for your account. Connect them under {page}. Nothing is ever sent automatically.',
  openPage:'Open {page}',
  notConfigured:'Not configured',
  setupGoogle:'Needs your own Google OAuth client: add it to .env.google.local and start the stack with --with-google-connectors (see docs/CONNECTORS.md).',
  setupGeneric:'Not available in this environment. An operator can enable it; see docs/CONNECTORS.md.',
  connectNotice:'Google opens next. You grant read-only access to Gmail and Drive. Tokens stay on the server, and nothing is imported until you choose documents.',
  draftsNotice:'Separate permission: lets the app create a Gmail draft after you approve its exact text. It never sends mail.',
  outputsHint:'Reports and Gmail drafts are created next to reviewed results in {page}.',
  movedHint:'Sample scenarios are now in {datasets}; the CSV project assessment is in {domain}.',
  useCasesTitle:'Sample scenarios',
  useCasesIntro:'Eight fictional PDFs, each with expected checks plus one answerable and one unanswerable question. Import the PDFs under {page} (local files), then run a check here.',
  importSamples:'Import sample PDFs',
  assessmentIntro:'Deterministic figures from an exported CSV: totals, variance, cost per m², margins and schedule. A language model may explain them; it never computes them.',
};
type Copy=typeof en;
const de:Copy={
  attentionTitle:'Braucht Aufmerksamkeit',failedTitle:'Verarbeitung fehlgeschlagen',reviewTitle:'Prüfung ausstehend',
  allClear:'In diesem Vorgang wartet nichts auf dich. Füge Dokumente hinzu oder stelle eine Frage, um weiterzumachen.',
  openProcessing:'Verarbeitung öffnen',reviewNow:'Jetzt prüfen',
  recentTitle:'Neueste Dokumente',recentEmpty:'Noch keine Dokumente in diesem Vorgang.',allDocuments:'Alle Dokumente',
  startTitle:'Aufgabe starten',startAddHint:'PDFs hochladen oder importieren und verarbeiten lassen.',
  startAskHint:'Belege durchsuchen und Antworten mit Seitenzitaten erhalten.',startQualityHint:'Extraktion und Suche an geprüften Referenzen messen.',
  catalogCount:'{count} Funktionen im Katalog',catalogShow:'Alle Funktionen anzeigen',catalogHide:'Funktionsliste ausblenden',
  technology:'Eingesetzte Technik',
  colDocument:'Dokument',colType:'Typ',colStatus:'Prüfstatus',colActions:'Aktionen',moreActions:'Weitere Aktionen',
  actionReview:'Prüfen',actionView:'Ansehen',askNova:'Nova zu diesem Dokument fragen',draftAction:'Gmail-Entwurf erstellen…',aiAssisted:'KI-gestützt',
  reportScope:'Exportiert werden nur bestätigte Felder, Belegseiten und Quellen.',
  draftNotConnected:'Gmail-Entwürfe sind für dein Konto nicht verbunden. Verbinde sie unter {page}. Es wird nie automatisch etwas gesendet.',
  openPage:'{page} öffnen',
  notConfigured:'Nicht eingerichtet',
  setupGoogle:'Braucht einen eigenen Google-OAuth-Client: in .env.google.local eintragen und den Stack mit --with-google-connectors starten (siehe docs/CONNECTORS.md).',
  setupGeneric:'In dieser Umgebung nicht verfügbar. Eine betreibende Person kann es aktivieren; siehe docs/CONNECTORS.md.',
  connectNotice:'Als Nächstes öffnet sich Google. Du gibst nur Lesezugriff auf Gmail und Drive. Tokens bleiben auf dem Server; importiert wird erst, wenn du Dokumente auswählst.',
  draftsNotice:'Eigene Berechtigung: Die App darf einen Gmail-Entwurf anlegen, nachdem du den genauen Text freigegeben hast. Sie sendet nie E-Mails.',
  outputsHint:'Berichte und Gmail-Entwürfe entstehen neben geprüften Ergebnissen unter {page}.',
  movedHint:'Beispielszenarien liegen jetzt unter {datasets}, die CSV-Projektbewertung unter {domain}.',
  useCasesTitle:'Beispielszenarien',
  useCasesIntro:'Acht fiktive PDFs mit erwarteten Prüfungen sowie je einer beantwortbaren und einer nicht beantwortbaren Frage. PDFs unter {page} (lokale Dateien) importieren, dann hier prüfen.',
  importSamples:'Beispiel-PDFs importieren',
  assessmentIntro:'Deterministische Werte aus einer exportierten CSV: Summen, Abweichung, Kosten je m², Margen und Termine. Ein Sprachmodell darf sie erklären, berechnet sie aber nie.',
};
const vi:Copy={
  attentionTitle:'Cần xử lý',failedTitle:'Xử lý lỗi',reviewTitle:'Chờ kiểm duyệt',
  allClear:'Hồ sơ này không còn việc nào chờ bạn. Thêm tài liệu hoặc đặt câu hỏi để tiếp tục.',
  openProcessing:'Mở xử lý',reviewNow:'Kiểm duyệt ngay',
  recentTitle:'Tài liệu gần đây',recentEmpty:'Hồ sơ chưa có tài liệu.',allDocuments:'Tất cả tài liệu',
  startTitle:'Bắt đầu công việc',startAddHint:'Tải lên hoặc nhập PDF vào hàng đợi xử lý.',
  startAskHint:'Tìm chứng cứ và nhận câu trả lời có trích dẫn trang.',startQualityHint:'Đo trích xuất và truy xuất bằng nhãn đã kiểm tra.',
  catalogCount:'{count} tính năng trong danh mục',catalogShow:'Hiện tất cả tính năng',catalogHide:'Ẩn danh sách tính năng',
  technology:'Công nghệ đang dùng',
  colDocument:'Tài liệu',colType:'Loại',colStatus:'Trạng thái kiểm duyệt',colActions:'Thao tác',moreActions:'Thao tác khác',
  actionReview:'Kiểm duyệt',actionView:'Xem',askNova:'Hỏi Nova về tài liệu này',draftAction:'Tạo bản nháp Gmail…',aiAssisted:'Có AI hỗ trợ',
  reportScope:'Chỉ xuất trường đã xác nhận, trang chứng cứ và nguồn.',
  draftNotConnected:'Tài khoản của bạn chưa kết nối bản nháp Gmail. Kết nối tại {page}. Ứng dụng không bao giờ tự gửi thư.',
  openPage:'Mở {page}',
  notConfigured:'Chưa cấu hình',
  setupGoogle:'Cần Google OAuth client của riêng bạn: thêm vào .env.google.local và chạy stack với --with-google-connectors (xem docs/CONNECTORS.md).',
  setupGeneric:'Chưa có trong môi trường này. Người vận hành có thể bật; xem docs/CONNECTORS.md.',
  connectNotice:'Bước tiếp theo mở trang Google. Bạn chỉ cấp quyền đọc Gmail và Drive. Token nằm trên máy chủ và chưa nhập gì cho đến khi bạn chọn tài liệu.',
  draftsNotice:'Quyền riêng: cho phép tạo bản nháp Gmail sau khi bạn duyệt đúng nội dung. Ứng dụng không bao giờ gửi thư.',
  outputsHint:'Báo cáo và bản nháp Gmail được tạo cạnh kết quả đã duyệt trong {page}.',
  movedHint:'Tình huống mẫu nay nằm ở {datasets}; tính toán CSV đánh giá dự án nằm ở {domain}.',
  useCasesTitle:'Tình huống mẫu',
  useCasesIntro:'Tám PDF giả lập, mỗi tệp có kết quả kiểm tra dự kiến cùng một câu hỏi trả lời được và một câu không trả lời được. Nhập PDF tại {page} (tệp cục bộ), rồi chạy kiểm tra ở đây.',
  importSamples:'Nhập PDF mẫu',
  assessmentIntro:'Số liệu xác định từ CSV đã xuất: tổng, chênh lệch, chi phí trên m², biên lợi nhuận và tiến độ. Mô hình ngôn ngữ chỉ được giải thích, không bao giờ tự tính.',
};
export const usabilityLanguages={en,de,vi};
export function usabilityText(locale:string){return usabilityLanguages[locale==='vi'?'vi':locale==='de'?'de':'en'];}
export function fill(template:string,values:Record<string,string|number>){return template.replace(/\{(\w+)\}/g,(match,key:string)=>key in values?String(values[key]):match);}

/** Trust page deep links: `?trust=<section>&answer=<id>#trust`. Unknown values fall back safely. */
const answerId=/^[A-Za-z0-9_.:-]{1,80}$/;
export function trustSectionFromSearch(search:string):TrustSection|undefined{
  const value=new URLSearchParams(search).get('trust');
  return trustSections.find(section=>section===value);
}
export function trustAnswerFromSearch(search:string){
  const value=new URLSearchParams(search).get('answer');
  return value&&answerId.test(value)?value:undefined;
}
export function trustHref(href:string,section:TrustSection,answer?:string){
  const url=new URL(href);url.searchParams.set('trust',section);
  if(answer&&answerId.test(answer))url.searchParams.set('answer',answer);else url.searchParams.delete('answer');
  url.hash='trust';return `${url.pathname}${url.search}${url.hash}`;
}

/** AI catalog deep links: `?feature=<id>#overview` opens the catalog at the group that holds the feature. */
export function featureFromSearch(search:string){
  const value=new URLSearchParams(search).get('feature');
  return dashboardFeatures.find(feature=>feature.id===value)?.id;
}
export function catalogGroupOf(feature:string){
  return dashboardGroups.find(group=>(group.features as readonly string[]).includes(feature))?.id;
}

/** What the task page shows first: failed processing, then documents awaiting review. */
export function overviewTasks(documents:readonly CreditDocument[],jobs:readonly DocumentJob[]){
  const failed=latestDocumentJobs(jobs).filter(job=>job.status==='FAILED'||job.status==='EXPIRED');
  const review=documents.filter(doc=>doc.status==='review');
  return {failed,review};
}
export function recentDocuments(documents:readonly CreditDocument[],jobs:readonly DocumentJob[],limit=5){
  return orderedResultDocuments(documents.filter(doc=>doc.status!=='missing'),jobs).slice(0,limit);
}

/** A readable name for a document type code; unknown codes are shown as stored. */
export function documentTypeLabel(type:string|undefined,locale:string){
  if(!type)return '—';
  if((classificationLabels as readonly string[]).includes(type))return documentClassName(type as typeof classificationLabels[number],locale);
  if((extractionProfiles as readonly string[]).includes(type))return batchText(locale)[type as typeof extractionProfiles[number]];
  const table=languageTables[locale==='vi'?'vi':locale==='de'?'de':'en'] as Record<string,string>;
  return ['income','statement','identity','valuation','disclosure','unknown'].includes(type)?table[type]:type;
}
/** The profile list and its labels come from batch intake, so both pickers say the same thing. */
export function profileOptions(locale:string){
  const t=batchText(locale);
  return extractionProfiles.map(value=>({value,label:t[value]}));
}
