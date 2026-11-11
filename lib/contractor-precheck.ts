import {z} from 'zod';

/**
 * Read-only contractor pre-check (AI-103). The Java API computes every amount; the browser only
 * validates the shape, shows the cited pages and lets a person copy the draft. Nothing here approves,
 * pays or sends.
 */
const source=z.object({documentId:z.string(),documentName:z.string().optional(),page:z.number().int().min(1),quote:z.string().optional(),ref:z.string().optional(),regionId:z.string().nullable().optional()});
const finding=z.object({code:z.string(),severity:z.enum(['HIGH','MEDIUM','LOW','INFO']),message:z.string(),sources:z.array(z.unknown())});
export const precheckSchema=z.object({
  method:z.literal('contractor-precheck-v1'),
  caseId:z.string(),caseVersion:z.number(),readOnly:z.literal(true),dossierWrites:z.literal(0),
  documents:z.array(z.object({id:z.string(),name:z.string(),role:z.string(),reviewStatus:z.string(),pages:z.number()})),
  approved:z.object({amount:z.string().nullable(),basis:z.string(),literal:z.string().nullable(),source:source.nullable()}),
  invoice:z.object({amount:z.string().nullable(),basis:z.string(),literal:z.string().nullable(),source:source.nullable(),number:z.string().nullable().optional()}),
  variance:z.object({amount:z.string().nullable(),basis:z.string().nullable(),sameTaxBasis:z.boolean(),net:z.string().optional(),vat:z.string().optional()}),
  invoiceLines:z.array(z.object({position:z.number(),description:z.string(),reference:z.string(),net:z.string(),approved:z.boolean(),source:source})),
  evidence:z.object({
    acceptance:z.object({status:z.enum(['COMPLETE','PARTIAL','MISSING']),notAcceptedPositions:z.array(z.number()).optional(),openDefects:z.number().nullable().optional(),remediationDeadline:z.string().nullable().optional(),sources:z.array(source).optional()}),
    payment:z.object({status:z.enum(['FOUND','MISSING']),sources:z.array(source)}),
    photos:z.object({referenced:z.array(z.string()),missing:z.array(z.string()),provided:z.array(z.object({photoId:z.string(),documentId:z.string()}))}),
    retrieval:z.array(z.object({purpose:z.string(),backend:z.string(),hits:z.array(z.object({documentId:z.string(),page:z.number(),confirmed:z.boolean()}))})),
  }),
  findings:z.array(finding),
  embeddedInstructions:z.array(z.object({documentId:z.string(),documentName:z.string(),page:z.number(),quote:z.string()})),
  draft:z.object({status:z.literal('DRAFT_REQUIRES_HUMAN_REVIEW'),approved:z.literal(false),emailSent:z.literal(false),paymentReleased:z.literal(false),
    summary:z.array(z.string()),email:z.object({subject:z.string(),body:z.string(),send:z.literal(false)})}),
  steps:z.array(z.object({name:z.string(),durationMs:z.number()})),
  traceId:z.string().nullable().optional(),
  boundary:z.string(),
});
export type Precheck=z.infer<typeof precheckSchema>;
export type PrecheckSource=z.infer<typeof source>;

export function precheckPath(caseId:string,locale:string){
  const language=locale==='de'||locale==='vi'?locale:'en';
  return `/api/cases/${encodeURIComponent(caseId)}/platform/contractor-precheck?locale=${language}`;
}

/** Display the decimal string computed by Java; never recompute or round in the browser. */
export function displayAmount(amount:string|null|undefined,locale:string){
  if(!amount||!/^-?\d+\.\d{2}$/.test(amount))return '—';
  const [integer,cents]=amount.replace('-','').split('.');
  const grouped=integer.replace(/\B(?=(\d{3})+(?!\d))/g,locale==='en'?',':'.');
  return `${amount.startsWith('-')?'-':''}${locale==='en'?`EUR ${grouped}.${cents}`:`${grouped},${cents} EUR`}`;
}

export function basisLabel(basis:string|null|undefined,locale:string){
  if(basis==='GROSS')return locale==='en'?'gross (incl. VAT)':locale==='de'?'brutto (inkl. USt)':'brutto (đã gồm VAT)';
  if(basis==='NET')return locale==='en'?'net':locale==='de'?'netto':'netto (chưa VAT)';
  return locale==='en'?'unknown':locale==='de'?'unbekannt':'không rõ';
}

const findingTitles:Record<string,{en:string;de:string;vi:string}>={
  INVOICE_EXCEEDS_APPROVED_AMOUNT:{en:'Invoice exceeds the approved amount',de:'Rechnung übersteigt den genehmigten Betrag',vi:'Hóa đơn vượt giá trị đã duyệt'},
  INVOICE_BELOW_APPROVED_AMOUNT:{en:'Invoice is below the approved amount',de:'Rechnung liegt unter dem genehmigten Betrag',vi:'Hóa đơn thấp hơn giá trị đã duyệt'},
  INVOICE_LINE_WITHOUT_APPROVAL:{en:'Invoice line without approval',de:'Rechnungsposition ohne Genehmigung',vi:'Dòng hóa đơn chưa được duyệt'},
  ACCEPTANCE_EVIDENCE_MISSING:{en:'Acceptance evidence missing',de:'Abnahmenachweis fehlt',vi:'Thiếu bằng chứng nghiệm thu'},
  OPEN_ACCEPTANCE_DEFECTS:{en:'Open acceptance defects',de:'Offene Abnahmemängel',vi:'Lỗi nghiệm thu còn mở'},
  PAYMENT_EVIDENCE_MISSING:{en:'Payment evidence missing',de:'Zahlungsnachweis fehlt',vi:'Thiếu bằng chứng thanh toán'},
  PHOTO_EVIDENCE_MISSING:{en:'Referenced photo missing',de:'Referenziertes Foto fehlt',vi:'Thiếu ảnh được tham chiếu'},
  EMBEDDED_APPROVAL_INSTRUCTION:{en:'Instruction inside a document (ignored)',de:'Anweisung im Dokument (ignoriert)',vi:'Câu chỉ dẫn trong tài liệu (đã bỏ qua)'},
  SOURCES_NOT_HUMAN_REVIEWED:{en:'Sources not yet reviewed',de:'Quellen noch nicht geprüft',vi:'Nguồn chưa được kiểm tra'},
  TAX_BASIS_MISMATCH:{en:'Different tax basis – no difference computed',de:'Unterschiedliche Steuerbasis – keine Differenz berechnet',vi:'Khác cơ sở thuế – không tính chênh lệch'},
  APPROVED_AMOUNT_NOT_FOUND:{en:'Approved amount not found',de:'Genehmigter Betrag nicht gefunden',vi:'Không tìm thấy giá trị đã duyệt'},
  INVOICE_AMOUNT_NOT_FOUND:{en:'Invoice amount not found',de:'Rechnungsbetrag nicht gefunden',vi:'Không tìm thấy giá trị hóa đơn'},
  APPROVED_TOTAL_INCONSISTENT:{en:'Approved total inconsistent',de:'Genehmigte Summe widersprüchlich',vi:'Tổng giá trị duyệt không khớp'},
  INVOICE_ARITHMETIC_MISMATCH:{en:'Invoice arithmetic mismatch',de:'Rechnungsarithmetik stimmt nicht',vi:'Số học hóa đơn không khớp'},
  INVOICE_LINES_DIFFER_FROM_NET:{en:'Lines differ from net amount',de:'Positionen weichen vom Nettobetrag ab',vi:'Tổng dòng khác tiền trước thuế'},
  AMBIGUOUS_AMOUNT:{en:'Ambiguous amount – choose the source',de:'Mehrdeutiger Betrag – Quelle wählen',vi:'Số tiền không rõ ràng – cần chọn nguồn'},
};
/** Localized finding title; unknown codes fall back to the code itself, never to model text. */
export function findingTitle(code:string,locale:string){const entry=findingTitles[code];return entry?entry[locale==='de'?'de':locale==='vi'?'vi':'en']:code;}
export const knownFindingCodes=Object.keys(findingTitles);

const text={
  en:{title:'Contractor pre-check before accounting',intro:'Reads the extracted contract, change order, invoice and acceptance report, compares amounts on the same tax basis and prepares a cited draft. Read-only: it never approves, pays or sends email.',
    run:'Run read-only pre-check',rerun:'Run again',running:'Checking…',approved:'Approved amount',invoice:'Invoice amount',variance:'Difference',basis:'Tax basis',sameBasis:'same tax basis',noBasis:'not comparable',
    open:'Open page',lines:'Invoice lines',line:'Line',approvedLine:'covered by approval',unapprovedLine:'no approval',evidence:'Evidence',acceptance:'Acceptance',payment:'Payment',photos:'Photos',missing:'MISSING',partial:'PARTIAL',complete:'present',found:'found',
    findings:'Findings',technical:'Technical details',instructions:'Instructions found inside documents (ignored)',draft:'Draft for your review',email:'Email draft (not sent)',copy:'Copy draft',copied:'Copied',steps:'Step timings',trace:'Trace',
    notice:'Draft only. A person checks every cited page, edits the text and sends it. Status stays “requires human review”.',unreviewed:'source documents still await field review'},
  de:{title:'Prüfung der Unternehmerunterlagen vor der Buchhaltung',intro:'Liest Auftrag, Nachtrag, Rechnung und Abnahmeprotokoll aus der Extraktion, vergleicht Beträge auf derselben Steuerbasis und erstellt einen Entwurf mit Quellen. Nur lesend: keine Freigabe, Zahlung oder E-Mail.',
    run:'Prüfung starten (nur lesend)',rerun:'Erneut prüfen',running:'Prüfung läuft…',approved:'Genehmigter Betrag',invoice:'Rechnungsbetrag',variance:'Differenz',basis:'Steuerbasis',sameBasis:'gleiche Steuerbasis',noBasis:'nicht vergleichbar',
    open:'Seite öffnen',lines:'Rechnungspositionen',line:'Position',approvedLine:'genehmigt',unapprovedLine:'ohne Genehmigung',evidence:'Nachweise',acceptance:'Abnahme',payment:'Zahlung',photos:'Fotos',missing:'FEHLT',partial:'TEILWEISE',complete:'vorhanden',found:'gefunden',
    findings:'Befunde',technical:'Technische Details',instructions:'Anweisungen im Dokumenttext (ignoriert)',draft:'Entwurf zur Prüfung',email:'E-Mail-Entwurf (nicht versendet)',copy:'Entwurf kopieren',copied:'Kopiert',steps:'Laufzeiten je Schritt',trace:'Trace',
    notice:'Nur ein Entwurf. Ein Mensch prüft jede zitierte Seite, bearbeitet den Text und versendet ihn. Der Status bleibt „menschliche Prüfung erforderlich“.',unreviewed:'Quelldokumente warten noch auf die Feldprüfung'},
  vi:{title:'Kiểm tra hồ sơ nhà thầu trước khi chuyển kế toán',intro:'Đọc hợp đồng, phụ lục (Nachtrag), hóa đơn và biên bản nghiệm thu đã trích xuất, so sánh số tiền trên cùng cơ sở thuế và soạn bản nháp có nguồn. Chỉ đọc: không duyệt, không thanh toán, không gửi email.',
    run:'Chạy kiểm tra (chỉ đọc)',rerun:'Chạy lại',running:'Đang kiểm tra…',approved:'Giá trị đã duyệt',invoice:'Giá trị hóa đơn',variance:'Chênh lệch',basis:'Cơ sở thuế',sameBasis:'cùng cơ sở thuế',noBasis:'không so sánh được',
    open:'Mở trang',lines:'Dòng hóa đơn',line:'Dòng',approvedLine:'đã được duyệt',unapprovedLine:'chưa được duyệt',evidence:'Bằng chứng',acceptance:'Nghiệm thu',payment:'Thanh toán',photos:'Ảnh',missing:'THIẾU',partial:'MỘT PHẦN',complete:'có',found:'có',
    findings:'Phát hiện',technical:'Chi tiết kỹ thuật',instructions:'Câu chỉ dẫn nằm trong tài liệu (đã bỏ qua)',draft:'Bản nháp để bạn duyệt',email:'Email nháp (chưa gửi)',copy:'Sao chép bản nháp',copied:'Đã sao chép',steps:'Thời gian từng bước',trace:'Trace',
    notice:'Chỉ là bản nháp. Người kiểm tra mở từng trang được trích dẫn, sửa nội dung và tự gửi. Trạng thái luôn là “cần người duyệt”.',unreviewed:'tài liệu nguồn chưa được kiểm tra trường'},
} as const;
export type PrecheckText=Record<keyof typeof text.en,string>;
export function precheckText(locale:string):PrecheckText{return locale==='de'?text.de:locale==='vi'?text.vi:text.en;}
