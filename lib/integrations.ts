import {z} from 'zod';

/** Provider-neutral connector contracts as returned by Java. The browser never receives a token. */
export const capabilityLabels=['verified-local','simulated','implemented-not-live-verified','live-verified','future'] as const;
export const labelSchema=z.enum(capabilityLabels);
const descriptorSchema=z.object({
  id:z.string().regex(/^[a-z0-9-]{2,40}$/),kind:z.enum(['document-source','business-data','destination']),provider:z.string().max(120),
  label:labelSchema,enabled:z.boolean(),live:z.boolean(),requiresConnection:z.boolean(),
  scopes:z.array(z.string().max(200)).max(10),permissions:z.array(z.string().max(300)).max(10),note:z.string().max(400).nullable(),
});
const syncSchema=z.object({lastSuccessAt:z.string().max(40).optional(),found:z.number().int().min(0).optional(),imported:z.number().int().min(0).optional(),
  lastError:z.string().max(80).optional(),lastErrorAt:z.string().max(40).optional()});
export const overviewSchema=z.object({
  tokensInBrowser:z.literal(false),automaticSync:z.literal(false),
  providers:z.array(descriptorSchema.extend({connection:z.enum(['CONNECTED','DISCONNECTED','REAUTH_REQUIRED','SCOPE_NOT_GRANTED','NOT_REQUIRED']),
    grantedScopes:z.array(z.string().max(200)).max(10).optional(),connectedAt:z.string().max(40).nullable().optional(),sync:syncSchema})).max(20),
  businessData:z.array(descriptorSchema).max(20),destinations:z.array(descriptorSchema).max(20),
});
export const previewSchema=z.object({
  sourceId:z.string().max(40),label:labelSchema,automaticImport:z.literal(false),
  items:z.array(z.object({sourceId:z.string().max(40),externalId:z.string().max(300),revision:z.string().max(120),name:z.string().max(130),
    declaredMime:z.string().max(120),size:z.number().int(),canDownload:z.boolean(),link:z.string().max(400),
    metadata:z.record(z.string(),z.string().max(400)),alreadyImported:z.boolean()})).max(20),
});
export const importResultSchema=z.object({
  sourceId:z.string().max(40),batchId:z.string().max(80).nullable(),next:z.string().max(300),
  items:z.array(z.object({externalId:z.string().max(300),state:z.enum(['ACCEPTED','DUPLICATE','REJECTED','PENDING']),code:z.string().max(80).optional(),
    name:z.string().max(130).optional(),jobId:z.string().max(80).optional(),sha256:z.string().max(64).optional(),revision:z.string().max(120).optional()})).max(4),
});
const localized=z.object({en:z.string().max(400),de:z.string().max(400),vi:z.string().max(400)});
export const useCaseCatalogSchema=z.object({version:z.string(),useCases:z.array(z.object({
  id:z.string().regex(/^[a-z-]{3,60}$/),title:localized,summary:localized,boundary:localized,
  fixtures:z.array(z.object({path:z.string().max(120),label:z.string().max(40),pages:z.number().int()})).max(8),
  fields:z.array(z.string().max(80)).max(20),businessDataSample:z.string().max(4000).optional(),
  answerable:z.object({question:localized,answer:z.string().max(200),evidence:z.object({path:z.string().max(120),page:z.number().int(),quote:z.string().max(200)})}),
  unanswerable:z.object({question:localized}),
})).max(12)});
export const checkResultSchema=z.object({
  useCaseId:z.string(),passed:z.boolean(),networkCalls:z.literal(0),fixturesLabelledFictional:z.boolean(),
  checks:z.array(z.object({check:z.string().max(120),expected:z.string().max(200),actual:z.string().max(200),passed:z.boolean()})).max(30),
  answerable:z.object({answer:z.string().max(200),evidenceFoundOnCitedPage:z.boolean()}),
  unanswerable:z.object({mustAbstain:z.boolean(),supportingTextFound:z.array(z.string().max(80)).max(10)}),
});
export const assessmentSchema=z.object({
  method:z.string(),currency:z.string(),
  costs:z.object({planned:z.string(),forecast:z.string(),variance:z.string(),variancePercent:z.string()}),
  costPerSqm:z.union([z.object({planned:z.string(),forecast:z.string()}),z.string()]),
  revenueScenarios:z.array(z.object({name:z.string().max(80),revenue:z.string(),margin:z.string(),marginPercent:z.string()})).max(20),
  schedule:z.array(z.object({name:z.string().max(80),planned:z.string(),forecast:z.string(),varianceDays:z.number().int()})).max(40),
  reviewFlags:z.array(z.object({code:z.string().max(120),threshold:z.string(),value:z.string(),triggered:z.boolean()})).max(80),
  humanReviewRequired:z.boolean(),notice:z.string().max(300),
});
export const draftPreviewSchema=z.object({previewId:z.string().max(80),contentHash:z.string().regex(/^[a-f0-9]{64}$/),recipients:z.array(z.string().max(254)).max(5),
  subject:z.string().max(150),body:z.string().max(8000),expiresAt:z.string(),sends:z.literal(false)});
export const draftResultSchema=z.object({status:z.literal('DRAFT_CREATED'),draftId:z.string().max(200),sent:z.literal(false)});
export type Overview=z.infer<typeof overviewSchema>;
export type Provider=Overview['providers'][number];
export type Preview=z.infer<typeof previewSchema>;
export type ImportResult=z.infer<typeof importResultSchema>;
export type UseCaseCatalog=z.infer<typeof useCaseCatalogSchema>;
export type CheckResult=z.infer<typeof checkResultSchema>;
export type Assessment=z.infer<typeof assessmentSchema>;
export type DraftPreview=z.infer<typeof draftPreviewSchema>;
export type CapabilityLabel=typeof capabilityLabels[number];

/** Only these ids may be imported; future adapters are listed but disabled. */
export function importable(provider:Provider){return provider.kind==='document-source'&&provider.enabled&&provider.label!=='future'&&(provider.connection==='CONNECTED'||provider.connection==='NOT_REQUIRED');}
export function selectable(item:Preview['items'][number]){return item.canDownload&&!item.alreadyImported;}
export const maxImportItems=4;

const en={
  title:'Integrations',intro:'Every source feeds the same pipeline: file checks, hash, ClamAV, durable queue, extraction, evidence, human review and audit. Tokens stay on the server.',
  sources:'Document sources',future:'Planned adapters (disabled, no network code)',businessData:'Business data',destinations:'Approved destinations',
  label_verified_local:'verified locally',label_simulated:'simulated · fictional data',label_implemented:'implemented · not live-verified',label_live:'live-verified',label_future:'future',
  modeLocal:'Local · no cloud call',modeSimulated:'Simulated · not a real connection',modeReal:'Real provider when connected',modeFuture:'Planned · disabled',
  conn_CONNECTED:'Connected',conn_DISCONNECTED:'Not connected',conn_REAUTH_REQUIRED:'Reconnect required (token expired or revoked)',conn_SCOPE_NOT_GRANTED:'Permission not granted',conn_NOT_REQUIRED:'No connection needed',
  disabled:'Not configured on this server',permissions:'Requested access',scopes:'Scopes requested',granted:'Scopes granted',lastSync:'Last successful sync',found:'Found',imported:'Imported',lastError:'Last error',never:'Never',
  loading:'Loading sources…',connectGoogle:'Connect Google (Gmail + Drive, read-only)',enableDrafts:'Allow Gmail drafts',disconnect:'Disconnect and revoke',refresh:'Refresh status',
  flow:'Import documents',step1:'1. Choose a source',step2:'2. Preview documents',step3:'3. Select up to four',step4:'4. Check permissions and destination',step5:'5. Import',step6:'6. Follow the pipeline',step7:'7. Review fields and evidence',
  query:'Search (Gmail query or label, Drive folder:<id> or name)',preview:'Preview',noItems:'No documents found.',alreadyImported:'Already imported',notDownloadable:'Not downloadable',
  profile:'Extraction profile',consent:'I may process these documents in this dossier. They enter the existing scan, extraction and review pipeline; nothing is approved automatically.',
  importSelected:'Import selected',state_ACCEPTED:'Queued',state_DUPLICATE:'Duplicate · not imported again',state_REJECTED:'Rejected',state_PENDING:'Pending',
  openPipeline:'Open Processing & data',openDocuments:'Open Documents & evidence',
  useCases:'Use cases (fictional PDFs, offline)',runCheck:'Run deterministic check',passed:'All checks passed',failed:'Check failed',answerable:'Answerable question',unanswerable:'Unanswerable question',
  evidenceFound:'Evidence found on the cited page',mustAbstain:'No supporting text: the assistant must refuse to guess',fictional:'Fictional fixture',
  assessment:'Project assessment (deterministic)',csv:'CSV (type,name,planned,forecast)',useExample:'Use fictional example',calculate:'Calculate',
  planned:'Planned',forecast:'Forecast',variance:'Variance',perSqm:'Cost per m²',margin:'Margin',delay:'Schedule variance (days)',reviewRequired:'Human review requested',noReview:'No review threshold triggered',
  report:'Download report (JSON)',reportNeedsReview:'Review and confirm a document with extracted fields to enable the report.',draft:'Gmail draft (optional)',draftWarning:'A draft is created only after you approve the exact text. Nothing is sent. Only selected reviewed fields are included.',
  document:'Reviewed document',fields:'Fields to include',recipients:'Recipients (comma-separated, optional)',subject:'Subject',note:'Note',excerpts:'Include evidence excerpts (private document text)',
  previewDraft:'Preview draft',approve:'I approve this exact text for a Gmail draft',createDraft:'Create draft',draftCreated:'Draft created in Gmail. It was not sent.',noReviewed:'No human-reviewed document yet.',
  error:'The request failed.',
};
type Copy={[K in keyof typeof en]:string};
const de:Copy={
  title:'Integrationen',intro:'Jede Quelle nutzt dieselbe Pipeline: Dateiprüfung, Hash, ClamAV, dauerhafte Warteschlange, Extraktion, Evidenz, menschliche Prüfung und Audit. Tokens bleiben auf dem Server.',
  sources:'Dokumentquellen',future:'Geplante Adapter (deaktiviert, ohne Netzwerkcode)',businessData:'Geschäftsdaten',destinations:'Freigegebene Ziele',
  label_verified_local:'lokal geprüft',label_simulated:'simuliert · fiktive Daten',label_implemented:'implementiert · nicht live geprüft',label_live:'live geprüft',label_future:'geplant',
  modeLocal:'Lokal · kein Cloud-Aufruf',modeSimulated:'Simuliert · keine echte Verbindung',modeReal:'Echter Anbieter nach Verbindung',modeFuture:'Geplant · deaktiviert',
  conn_CONNECTED:'Verbunden',conn_DISCONNECTED:'Nicht verbunden',conn_REAUTH_REQUIRED:'Neu verbinden (Token abgelaufen oder widerrufen)',conn_SCOPE_NOT_GRANTED:'Berechtigung nicht erteilt',conn_NOT_REQUIRED:'Keine Verbindung nötig',
  disabled:'Auf diesem Server nicht konfiguriert',permissions:'Angefragter Zugriff',scopes:'Angefragte Scopes',granted:'Erteilte Scopes',lastSync:'Letzte erfolgreiche Synchronisierung',found:'Gefunden',imported:'Importiert',lastError:'Letzter Fehler',never:'Nie',
  loading:'Quellen werden geladen…',connectGoogle:'Google verbinden (Gmail + Drive, nur lesen)',enableDrafts:'Gmail-Entwürfe erlauben',disconnect:'Trennen und widerrufen',refresh:'Status aktualisieren',
  flow:'Dokumente importieren',step1:'1. Quelle wählen',step2:'2. Dokumente ansehen',step3:'3. Bis zu vier auswählen',step4:'4. Berechtigung und Ziel prüfen',step5:'5. Importieren',step6:'6. Pipeline verfolgen',step7:'7. Felder und Evidenz prüfen',
  query:'Suche (Gmail-Abfrage oder Label, Drive folder:<ID> oder Name)',preview:'Vorschau',noItems:'Keine Dokumente gefunden.',alreadyImported:'Bereits importiert',notDownloadable:'Nicht herunterladbar',
  profile:'Extraktionsprofil',consent:'Ich darf diese Dokumente in diesem Vorgang verarbeiten. Sie durchlaufen die bestehende Prüf-, Extraktions- und Review-Pipeline; nichts wird automatisch freigegeben.',
  importSelected:'Auswahl importieren',state_ACCEPTED:'In Warteschlange',state_DUPLICATE:'Duplikat · nicht erneut importiert',state_REJECTED:'Abgelehnt',state_PENDING:'Ausstehend',
  openPipeline:'Verarbeitung & Daten öffnen',openDocuments:'Dokumente & Belege öffnen',
  useCases:'Anwendungsfälle (fiktive PDFs, offline)',runCheck:'Deterministische Prüfung starten',passed:'Alle Prüfungen bestanden',failed:'Prüfung fehlgeschlagen',answerable:'Beantwortbare Frage',unanswerable:'Nicht beantwortbare Frage',
  evidenceFound:'Evidenz auf der zitierten Seite gefunden',mustAbstain:'Kein belegender Text: Der Assistent muss die Antwort verweigern',fictional:'Fiktives Testdokument',
  assessment:'Projektbewertung (deterministisch)',csv:'CSV (type,name,planned,forecast)',useExample:'Fiktives Beispiel verwenden',calculate:'Berechnen',
  planned:'Plan',forecast:'Prognose',variance:'Abweichung',perSqm:'Kosten je m²',margin:'Marge',delay:'Terminabweichung (Tage)',reviewRequired:'Menschliche Prüfung angefordert',noReview:'Keine Prüfschwelle ausgelöst',
  report:'Bericht herunterladen (JSON)',reportNeedsReview:'Prüfe und bestätige ein Dokument mit extrahierten Feldern, um den Bericht zu aktivieren.',draft:'Gmail-Entwurf (optional)',draftWarning:'Ein Entwurf entsteht erst nach Freigabe des genauen Textes. Nichts wird gesendet. Nur ausgewählte geprüfte Felder werden übernommen.',
  document:'Geprüftes Dokument',fields:'Zu übernehmende Felder',recipients:'Empfänger (kommagetrennt, optional)',subject:'Betreff',note:'Notiz',excerpts:'Evidenzauszüge einfügen (privater Dokumenttext)',
  previewDraft:'Entwurf ansehen',approve:'Ich gebe genau diesen Text für einen Gmail-Entwurf frei',createDraft:'Entwurf erstellen',draftCreated:'Entwurf in Gmail erstellt. Er wurde nicht gesendet.',noReviewed:'Noch kein menschlich geprüftes Dokument.',
  error:'Die Anfrage ist fehlgeschlagen.',
};
const vi:Copy={
  title:'Tích hợp',intro:'Mọi nguồn đều đi qua cùng một pipeline: kiểm tra tệp, hash, ClamAV, hàng đợi bền vững, trích xuất, chứng cứ, người kiểm tra và audit. Token chỉ nằm trên máy chủ.',
  sources:'Nguồn tài liệu',future:'Adapter dự kiến (đã tắt, không có mã mạng)',businessData:'Dữ liệu nghiệp vụ',destinations:'Đích đã được phê duyệt',
  label_verified_local:'đã kiểm chứng cục bộ',label_simulated:'mô phỏng · dữ liệu giả lập',label_implemented:'đã triển khai · chưa kiểm chứng thực tế',label_live:'đã kiểm chứng thực tế',label_future:'dự kiến',
  modeLocal:'Cục bộ · không gọi cloud',modeSimulated:'Mô phỏng · không phải kết nối thật',modeReal:'Nhà cung cấp thật khi đã kết nối',modeFuture:'Dự kiến · đã tắt',
  conn_CONNECTED:'Đã kết nối',conn_DISCONNECTED:'Chưa kết nối',conn_REAUTH_REQUIRED:'Cần kết nối lại (token hết hạn hoặc bị thu hồi)',conn_SCOPE_NOT_GRANTED:'Chưa được cấp quyền',conn_NOT_REQUIRED:'Không cần kết nối',
  disabled:'Chưa cấu hình trên máy chủ này',permissions:'Quyền được yêu cầu',scopes:'Scope yêu cầu',granted:'Scope đã cấp',lastSync:'Lần đồng bộ thành công gần nhất',found:'Tìm thấy',imported:'Đã nhập',lastError:'Lỗi gần nhất',never:'Chưa có',
  loading:'Đang tải nguồn…',connectGoogle:'Kết nối Google (Gmail + Drive, chỉ đọc)',enableDrafts:'Cho phép tạo bản nháp Gmail',disconnect:'Ngắt kết nối và thu hồi',refresh:'Làm mới trạng thái',
  flow:'Nhập tài liệu',step1:'1. Chọn nguồn',step2:'2. Xem trước tài liệu',step3:'3. Chọn tối đa bốn tài liệu',step4:'4. Kiểm tra quyền và đích',step5:'5. Nhập',step6:'6. Theo dõi pipeline',step7:'7. Kiểm tra trường và chứng cứ',
  query:'Tìm kiếm (truy vấn hoặc nhãn Gmail, Drive folder:<id> hoặc tên)',preview:'Xem trước',noItems:'Không tìm thấy tài liệu.',alreadyImported:'Đã nhập trước đó',notDownloadable:'Không tải được',
  profile:'Hồ sơ trích xuất',consent:'Tôi được phép xử lý các tài liệu này trong hồ sơ này. Chúng đi qua pipeline quét, trích xuất và kiểm tra hiện có; không có gì được tự động phê duyệt.',
  importSelected:'Nhập các tài liệu đã chọn',state_ACCEPTED:'Đã vào hàng đợi',state_DUPLICATE:'Trùng · không nhập lại',state_REJECTED:'Bị từ chối',state_PENDING:'Đang chờ',
  openPipeline:'Mở Xử lý & dữ liệu',openDocuments:'Mở Tài liệu & chứng cứ',
  useCases:'Tình huống mẫu (PDF giả lập, không cần mạng)',runCheck:'Chạy kiểm tra xác định',passed:'Tất cả kiểm tra đạt',failed:'Kiểm tra không đạt',answerable:'Câu hỏi có đáp án',unanswerable:'Câu hỏi không có đáp án',
  evidenceFound:'Đã thấy chứng cứ ở trang được trích dẫn',mustAbstain:'Không có văn bản hỗ trợ: trợ lý phải từ chối suy đoán',fictional:'Tài liệu giả lập',
  assessment:'Đánh giá dự án (xác định)',csv:'CSV (type,name,planned,forecast)',useExample:'Dùng ví dụ giả lập',calculate:'Tính toán',
  planned:'Kế hoạch',forecast:'Dự báo',variance:'Chênh lệch',perSqm:'Chi phí mỗi m²',margin:'Biên lợi nhuận',delay:'Chênh lệch tiến độ (ngày)',reviewRequired:'Cần người kiểm tra',noReview:'Không vượt ngưỡng cần kiểm tra',
  report:'Tải báo cáo (JSON)',reportNeedsReview:'Kiểm tra và xác nhận một tài liệu có trường đã trích xuất để bật tính năng tải báo cáo.',draft:'Bản nháp Gmail (tùy chọn)',draftWarning:'Bản nháp chỉ được tạo sau khi bạn phê duyệt đúng nội dung. Không gửi gì cả. Chỉ đưa vào các trường đã kiểm tra mà bạn chọn.',
  document:'Tài liệu đã kiểm tra',fields:'Trường đưa vào',recipients:'Người nhận (cách nhau bằng dấu phẩy, tùy chọn)',subject:'Tiêu đề',note:'Ghi chú',excerpts:'Đưa trích đoạn chứng cứ (nội dung tài liệu riêng tư)',
  previewDraft:'Xem trước bản nháp',approve:'Tôi phê duyệt đúng nội dung này cho bản nháp Gmail',createDraft:'Tạo bản nháp',draftCreated:'Đã tạo bản nháp trong Gmail. Chưa được gửi.',noReviewed:'Chưa có tài liệu nào được người kiểm tra.',
  error:'Yêu cầu thất bại.',
};
export const integrationsLanguage={en,de,vi};
export function integrationsText(locale:string):Copy{return integrationsLanguage[locale==='vi'?'vi':locale==='de'?'de':'en'];}
export function labelText(copy:Copy,label:CapabilityLabel){return label==='verified-local'?copy.label_verified_local:label==='simulated'?copy.label_simulated:label==='implemented-not-live-verified'?copy.label_implemented:label==='live-verified'?copy.label_live:copy.label_future;}
export function modeText(copy:Copy,provider:Pick<Provider,'label'|'live'|'requiresConnection'>){return provider.label==='future'?copy.modeFuture:provider.label==='simulated'?copy.modeSimulated:!provider.requiresConnection?copy.modeLocal:copy.modeReal;}

const errors:Record<string,Record<'en'|'de'|'vi',string>>={
  CONNECTOR_NOT_CONFIGURED:{en:'This connector is not configured on the server.',de:'Dieser Connector ist auf dem Server nicht konfiguriert.',vi:'Connector này chưa được cấu hình trên máy chủ.'},
  CONNECTOR_NOT_CONNECTED:{en:'Connect the provider first.',de:'Verbinde zuerst den Anbieter.',vi:'Hãy kết nối nhà cung cấp trước.'},
  CONNECTOR_REAUTH_REQUIRED:{en:'The connection expired or was revoked. Reconnect.',de:'Die Verbindung ist abgelaufen oder wurde widerrufen. Bitte neu verbinden.',vi:'Kết nối đã hết hạn hoặc bị thu hồi. Hãy kết nối lại.'},
  SCOPE_NOT_GRANTED:{en:'The required permission was not granted.',de:'Die nötige Berechtigung wurde nicht erteilt.',vi:'Quyền cần thiết chưa được cấp.'},
  SOURCE_ACCESS_DENIED:{en:'The provider denied access to this item.',de:'Der Anbieter hat den Zugriff verweigert.',vi:'Nhà cung cấp từ chối truy cập.'},
  SOURCE_DOWNLOAD_NOT_ALLOWED:{en:'The owner does not allow downloading this file.',de:'Der Download dieser Datei ist nicht erlaubt.',vi:'Chủ sở hữu không cho phép tải tệp này.'},
  SOURCE_RATE_LIMITED:{en:'The provider is rate limiting. Try again later.',de:'Der Anbieter begrenzt Anfragen. Später erneut versuchen.',vi:'Nhà cung cấp đang giới hạn tần suất. Thử lại sau.'},
  SOURCE_UNAVAILABLE:{en:'The provider is unavailable.',de:'Der Anbieter ist nicht erreichbar.',vi:'Nhà cung cấp không khả dụng.'},
  FILE_TOO_LARGE:{en:'The file exceeds 3 MB.',de:'Die Datei ist größer als 3 MB.',vi:'Tệp vượt quá 3 MB.'},
  MIME_MISMATCH:{en:'The content is not a PDF.',de:'Der Inhalt ist kein PDF.',vi:'Nội dung không phải PDF.'},
  UNSUPPORTED_FILE_TYPE:{en:'Only PDF files with a safe name are accepted.',de:'Nur PDF-Dateien mit sicherem Namen werden angenommen.',vi:'Chỉ nhận tệp PDF có tên an toàn.'},
  ALREADY_IMPORTED:{en:'This revision was already imported.',de:'Diese Revision wurde bereits importiert.',vi:'Phiên bản này đã được nhập.'},
  HUMAN_REVIEW_REQUIRED:{en:'Review and confirm the document before exporting its fields.',de:'Prüfe und bestätige das Dokument, bevor du seine Felder exportierst.',vi:'Hãy kiểm tra và xác nhận tài liệu trước khi xuất các trường dữ liệu.'},
  PREVIEW_CHANGED:{en:'The content changed. Preview it again.',de:'Der Inhalt hat sich geändert. Erneut ansehen.',vi:'Nội dung đã thay đổi. Hãy xem trước lại.'},
  PREVIEW_EXPIRED:{en:'The preview expired. Preview it again.',de:'Die Vorschau ist abgelaufen.',vi:'Bản xem trước đã hết hạn.'},
  CONNECTOR_NOT_IMPLEMENTED:{en:'This adapter is planned and disabled.',de:'Dieser Adapter ist geplant und deaktiviert.',vi:'Adapter này đang dự kiến và đã tắt.'},
  OAUTH_STATE_INVALID:{en:'The sign-in response could not be verified. Start again.',de:'Die Anmeldeantwort konnte nicht geprüft werden.',vi:'Không xác minh được phản hồi đăng nhập. Hãy thử lại.'},
};
export function connectorError(locale:string,code:string|undefined){
  const language=locale==='vi'?'vi':locale==='de'?'de':'en';
  return (code&&errors[code]?.[language])||integrationsLanguage[language].error+(code&&/^[A-Z_]{3,60}$/.test(code)?` (${code})`:'');
}

type Text3={en:string;de:string;vi:string};
const t3=(en:string,de:string,vi:string):Text3=>({en,de,vi});
/** Localized adapter text by stable id, so no locale mixes languages. The Java text is only a fallback for unknown ids. */
export const adapterCopy:Record<string,{name?:Text3;permissions:Text3[];note:Text3;simulatedNote?:Text3;unreachableNote?:Text3}>={
  local:{name:t3('Local files and fictional fixtures','Lokale Dateien und fiktive Testdokumente','Tệp cục bộ và tài liệu giả lập'),
    permissions:[t3('Upload your own permitted PDFs under Processing & data','Eigene erlaubte PDFs unter Verarbeitung & Daten hochladen','Tải PDF được phép của bạn tại Xử lý & dữ liệu'),t3('Import bundled fictional use-case PDFs; no network call','Mitgelieferte fiktive Anwendungsfall-PDFs importieren; kein Netzwerkaufruf','Nhập PDF use case giả lập có sẵn; không gọi mạng')],
    note:t3('Default mode. Works without any cloud credential.','Standardmodus. Funktioniert ohne Cloud-Zugangsdaten.','Chế độ mặc định. Chạy không cần thông tin đăng nhập cloud.')},
  gmail:{permissions:[t3('Read messages and their PDF attachments','Nachrichten und ihre PDF-Anhänge lesen','Đọc email và tệp PDF đính kèm'),t3('Never sends, modifies, labels or deletes mail','Sendet, ändert, beschriftet oder löscht nie E-Mails','Không bao giờ gửi, sửa, gắn nhãn hay xóa thư')],
    note:t3('Tested with a mocked Gmail API only. Connect with your own Google OAuth client to use real mail.','Nur mit einer simulierten Gmail-API getestet. Für echte E-Mails mit einem eigenen Google-OAuth-Client verbinden.','Chỉ kiểm thử với Gmail API giả lập. Kết nối bằng OAuth client Google của bạn để dùng thư thật.')},
  'google-drive':{permissions:[t3('Read PDF metadata and content in My Drive and shared drives you can access','PDF-Metadaten und -Inhalte in Meine Ablage und zugänglichen geteilten Ablagen lesen','Đọc metadata và nội dung PDF trong My Drive và Shared Drive bạn có quyền'),t3('Never edits, moves, deletes or shares files','Bearbeitet, verschiebt, löscht oder teilt nie Dateien','Không bao giờ sửa, di chuyển, xóa hay chia sẻ tệp')],
    note:t3('Tested with a mocked Drive API only. drive.readonly is broader than drive.file; see the connector guide.','Nur mit einer simulierten Drive-API getestet. drive.readonly ist breiter als drive.file; siehe Connector-Anleitung.','Chỉ kiểm thử với Drive API giả lập. drive.readonly rộng hơn drive.file; xem hướng dẫn connector.')},
  'microsoft-365':{permissions:[t3('Read-only listing and download through the M365 evidence service','Nur lesende Auflistung und Download über den M365-Evidenzdienst','Chỉ liệt kê và tải xuống qua dịch vụ chứng cứ M365'),t3('The service applies its own tenant and ACL checks','Der Dienst prüft Mandant und Berechtigungen selbst','Dịch vụ tự kiểm tra tenant và quyền truy cập')],
    note:t3('Graph intake requires delegated Entra authentication, which this workspace adapter does not support.','Der Graph-Import erfordert delegierte Entra-Authentifizierung. Dieser Workspace-Adapter unterstützt sie noch nicht.','Nhập qua Graph cần xác thực Entra theo quyền người dùng. Workspace chưa hỗ trợ luồng này.'),
    simulatedNote:t3('Mock provider with fictional documents; not a Microsoft 365 connection.','Mock-Provider mit fiktiven Dokumenten; keine Microsoft-365-Verbindung.','Provider mô phỏng với tài liệu giả lập; không phải kết nối Microsoft 365.'),
    unreachableNote:t3('Simulated intake requires a reachable M365 mock service in local-dev mode.','Der simulierte Import benötigt einen erreichbaren M365-Mock-Dienst im local-dev-Modus.','Để nhập mô phỏng, cần dịch vụ M365 mock đang chạy ở chế độ local-dev.')},
  webdav:{permissions:[],note:t3('Planned read-only PROPFIND/GET with per-user app passwords.','Geplant: nur lesendes PROPFIND/GET mit App-Passwörtern pro Nutzer.','Dự kiến: PROPFIND/GET chỉ đọc với mật khẩu ứng dụng riêng từng người dùng.')},
  s3:{permissions:[],note:t3('Planned read-only GetObject with a scoped bucket policy.','Geplant: nur lesendes GetObject mit eingeschränkter Bucket-Richtlinie.','Dự kiến: GetObject chỉ đọc với chính sách bucket giới hạn.')},
  'csv-excel':{name:t3('CSV (Excel export)','CSV (Excel-Export)','CSV (xuất từ Excel)'),permissions:[t3('Parse an uploaded CSV with cost, area, revenue and milestone rows','Eine CSV mit Kosten-, Flächen-, Erlös- und Meilensteinzeilen auswerten','Đọc tệp CSV có dòng chi phí, diện tích, doanh thu và mốc tiến độ')],
    note:t3('Excel files: export as CSV first; .xlsx parsing is not implemented.','Excel-Dateien zuerst als CSV exportieren; .xlsx wird nicht gelesen.','Tệp Excel: hãy xuất sang CSV trước; chưa hỗ trợ đọc .xlsx.')},
  postgresql:{permissions:[],note:t3('Planned read-only views with a dedicated role.','Geplant: nur lesende Views mit eigener Rolle.','Dự kiến: view chỉ đọc với vai trò riêng.')},
  'generic-rest':{name:t3('Generic REST API','Generische REST-API','REST API tổng quát'),permissions:[],note:t3('Planned allowlisted HTTPS endpoints only.','Geplant: nur freigegebene HTTPS-Endpunkte.','Dự kiến: chỉ các endpoint HTTPS trong danh sách cho phép.')},
  'dynamics-dataverse':{permissions:[],note:t3('Planned read-only Web API access; optional, never required.','Geplant: nur lesender Web-API-Zugriff; optional, nie erforderlich.','Dự kiến: truy cập Web API chỉ đọc; tùy chọn, không bắt buộc.')},
  'download-report':{name:t3('Download report','Bericht herunterladen','Tải báo cáo'),permissions:[t3('Download reviewed fields, evidence pages and source provenance as JSON','Geprüfte Felder, Evidenzseiten und Quellenherkunft als JSON herunterladen','Tải các trường đã kiểm tra, trang chứng cứ và nguồn gốc dưới dạng JSON')],
    note:t3('Generated locally; nothing leaves the workspace.','Lokal erzeugt; nichts verlässt den Arbeitsbereich.','Tạo cục bộ; không có gì rời khỏi workspace.')},
  'gmail-draft':{name:t3('Gmail draft','Gmail-Entwurf','Bản nháp Gmail'),permissions:[t3('Create a draft only after you preview and approve its exact content','Einen Entwurf erst nach Vorschau und Freigabe des genauen Inhalts erstellen','Chỉ tạo bản nháp sau khi bạn xem trước và phê duyệt đúng nội dung'),t3('Never sends email. The Google scope also allows sending; this app never calls send','Sendet nie E-Mails. Der Google-Scope erlaubt auch Senden; diese App ruft Senden nie auf','Không bao giờ gửi email. Scope Google cho phép gửi, nhưng ứng dụng không bao giờ gọi lệnh gửi')],
    note:t3('Tested with a mocked Gmail API only. Connect separately; reading mail does not grant draft creation.','Nur mit einer simulierten Gmail-API getestet. Separat verbinden; Lesen erlaubt keine Entwürfe.','Chỉ kiểm thử với Gmail API giả lập. Cần kết nối riêng; quyền đọc thư không cho phép tạo bản nháp.')},
  webhook:{permissions:[],note:t3('Planned HTTPS-only delivery after approval, with public-address checks.','Geplant: nur HTTPS-Zustellung nach Freigabe, mit Prüfung öffentlicher Adressen.','Dự kiến: chỉ gửi qua HTTPS sau phê duyệt, có kiểm tra địa chỉ công khai.')},
  'crm-write-back':{name:t3('CRM write-back','CRM-Rückschreiben','Ghi ngược vào CRM'),permissions:[],note:t3('Planned; requires human approval for every write.','Geplant; jede Schreiboperation braucht menschliche Freigabe.','Dự kiến; mỗi lần ghi đều cần người phê duyệt.')},
};
export function describeAdapter(provider:Pick<Provider,'id'|'provider'|'permissions'|'note'|'label'|'enabled'>,locale:string){
  const language=locale==='vi'?'vi':locale==='de'?'de':'en',copy=adapterCopy[provider.id];
  if(!copy)return {name:provider.provider,permissions:provider.permissions,note:provider.note||''};
  const note=provider.id==='microsoft-365'&&provider.label==='simulated'?(provider.enabled?copy.simulatedNote:copy.unreachableNote)??copy.note:copy.note;
  return {name:copy.name?.[language]??provider.provider,permissions:copy.permissions.map(p=>p[language]),note:note[language]};
}
