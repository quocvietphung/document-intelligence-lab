import {z} from 'zod';

export const referenceFieldSchema=z.object({documentId:z.string(),page:z.number().int().positive(),field:z.string().trim().min(1).max(120),expected:z.string().trim().min(1).max(1000)});
export const referenceQuestionSchema=z.object({question:z.string().trim().min(1).max(1000),documentId:z.string(),page:z.number().int().positive()});
export type ReferenceField=z.infer<typeof referenceFieldSchema>;
export type ReferenceQuestion=z.infer<typeof referenceQuestionSchema>;
const reference=z.object({id:z.string(),time:z.string(),name:z.string(),caseVersion:z.number(),sourceHash:z.string(),fields:z.array(referenceFieldSchema),questions:z.array(referenceQuestionSchema),sourceChecked:z.boolean()});
const resultRow=z.object({documentId:z.string(),page:z.number(),passed:z.boolean(),field:z.string().optional(),expected:z.string().optional(),actual:z.string().optional(),reason:z.string().optional(),question:z.string().optional(),rank:z.number().optional()});
const variant=z.object({method:z.string(),samples:z.number(),metrics:z.record(z.string(),z.number().nullable()),rows:z.array(resultRow)});
const run=z.object({id:z.string(),time:z.string(),datasetId:z.string(),datasetName:z.string(),caseVersion:z.number(),sourceHash:z.string(),suite:z.enum(['EXTRACTION','RETRIEVAL']),variants:z.array(variant),durationMs:z.number(),azureCalls:z.literal(0),methodVersion:z.string()});
export const documentResearchSchema=z.object({caseId:z.string(),caseVersion:z.number(),domain:z.string(),sourceHash:z.string(),persistent:z.boolean(),
  documents:z.array(z.object({id:z.string(),name:z.string(),provider:z.string(),model:z.string(),pages:z.array(z.number()),fields:z.array(z.string()),tables:z.number()})),
  datasets:z.array(reference),runs:z.array(run),jobs:z.array(z.object({id:z.string(),time:z.string(),suite:z.string(),status:z.enum(['QUEUED','RUNNING','COMPLETE','FAILED']),errorCode:z.string()})),exports:z.array(z.object({id:z.string(),time:z.string(),documents:z.number(),destination:z.literal('browser-download-only')})),
  retrieval:z.object({semantic:z.boolean(),embeddingModel:z.string(),vectorStore:z.string(),ranking:z.string(),languageCoverage:z.string()}),
});
export type DocumentResearchData=z.infer<typeof documentResearchSchema>;
export function researchMetric(value:number|null|undefined){return value==null?'—':`${value.toFixed(1)}%`;}
export function datasetIsCurrent(dataset:{sourceHash:string}|undefined,sourceHash:string){return !!dataset&&dataset.sourceHash===sourceHash;}
export function runsForReference<T extends {datasetId:string}>(runs:readonly T[],referenceId:string|undefined){return runs.filter(run=>run.datasetId===referenceId);}
export function referenceExportLines(bundle:{evaluationInputs?:unknown[]}){return (bundle.evaluationInputs||[]).map(row=>JSON.stringify(row)).join('\n');}

const en={
  labelFlow:'PDF → checked labels',tables:'tables',
  experiments:'AI Experiments',pipeline:'Data Pipelines',groupDocuments:'Documents',groupResearch:'AI research',groupOperations:'Data & operations',
  QUEUED:'Experiment queued',RUNNING:'Experiment running · results appear automatically',FAILED:'Experiment failed — refresh or create a new run',SOURCE_CHANGED:'Source changed. Create a fresh checked reference version.',EXPERIMENT_UNAVAILABLE:'Experiment unavailable. Check the worker and run again.',ATTEMPTS_EXHAUSTED:'Worker recovery attempts exhausted. Inspect services and create a new run.',
  title:'Measure AI against your source documents.',hint:'Create independently checked references, then evaluate saved extraction or compare retrieval strategies. No automatic upload or Azure call.',
  datasets:'1. Reference dataset',results:'2. Experiment results',newDataset:'Create reference version',name:'Reference version name',nameHint:'For example: DATEV payout · checked v1',
  document:'Source document',page:'Page',field:'Field key',expected:'Expected value from PDF',question:'Reference question',addField:'Add expected field',addQuestion:'Add retrieval question',
  fieldHint:'Use the exact extraction key, or enter a missing field key. Read the expected value from the original; predictions are not ground truth.',
  questionHint:'Choose the one document and page that should answer this question. Hit rate@5 and MRR@5 use this single labelled target.',
  checked:'I independently checked these labels against the original PDF.',save:'Save immutable reference version',remove:'Remove label',open:'Inspect original PDF',
  extraction:'Evaluate saved extraction',retrieval:'Compare BM25 / Vector / Hybrid',empty:'No reference dataset yet. Open an original PDF and add at least one checked field or retrieval question.',
  noDocuments:'Upload and analyze a source PDF first. Fixed text fixtures are never included in these experiments.',documents:'Open documents',loading:'Loading research data…',error:'Unable to complete the action. Check the services and retry.',
  conflict:'The source or dossier changed. Refresh and create a new checked reference version.',unauthorized:'Session expired or permission denied. Sign in again.',limit:'Experiment rate limit reached. Try again next minute.',
  stale:'Historical version — source documents have changed. Keep this result for comparison; create a new reference version to run again.',
  noRuns:'No measured results yet. Save references, select a version, then explicitly run an experiment.',saved:'Reference version saved. Select it below to run an experiment.',
  scope:'Scores apply only to the labelled fields/pages in this dossier, not overall OCR accuracy or LLM groundedness. Matching ignores case, Unicode width and extra spaces; numbers and currencies must match.',
  notJudge:'Local evaluation · 0 new Azure calls · no Foundry judge or prompt/model A/B evaluation',
  precision:'Precision',recall:'Recall',f1:'F1',truePositive:'Correct fields',falsePositive:'Wrong predictions',falseNegative:'Missed references',hitRateAt5:'Hit rate@5',mrrAt5:'MRR@5',
  passed:'Match',failed:'Needs inspection',actual:'Observed value',rank:'Rank',duration:'Measured runtime',samples:'Labelled samples',version:'Source version',
  assetsTitle:'Trace documents from original to research dataset.',assetsHint:'Bronze / Silver / Gold are logical export layers, not a connected Azure data lake. This view reuses the current private documents and saved references.',
  processing:'Processing queue',assets:'Data assets & Azure',bronze:'Bronze · Original references',silver:'Silver · Extracted pages & fields',gold:'Gold · Checked references',
  bronzeHint:'Original PDFs remain in private storage. They are not embedded in the export.',silverHint:'Actual saved extraction, tables, provider and model metadata.',goldHint:'Human-labelled reference versions and measured experiment results.',
  export:'Download research bundle',jsonl:'Download evaluation inputs (JSONL)',exportConsent:'The download contains document text and labels. I will keep it private and only upload it to an approved destination.',
  exportNote:'Download only. No Blob upload, Data Factory trigger, Foundry run or Azure resource creation occurs.',history:'Private download audit',noExports:'No export has been created for this dossier.',
  integrations:'Azure integration boundaries',notConnected:'Not connected by this app',docAi:'Azure Document Intelligence',docAiHint:'Used by document processing when configured. The provider and model shown on each document describe its actual extraction.',
  foundry:'Microsoft Foundry',foundryHint:'Prepare JSONL evaluation inputs from checked questions and PDF contexts. No model response or judge score is fabricated. A Foundry project, model and evaluator mapping are still required.',
  factory:'Azure Data Factory',factoryHint:'Future orchestration for approved storage ingestion. The Java queue currently performs scanning and extraction. Data Factory is not the OCR engine.',
  blob:'Azure Blob Storage',blobHint:'No cloud copy is configured here. Downloads never move private originals into a public container. Cloud integration requires an approved private container and scoped identity.',
  docs:'Microsoft documentation',sourceHash:'Source fingerprint',noScore:'Not measured',researchLink:'Build checked references and compare extraction / retrieval',pipelineLink:'Inspect processing, data lineage and Azure integration boundaries',
};
type Copy=typeof en;
const vi:Copy={
  labelFlow:'PDF → nhãn đã kiểm tra',tables:'bảng',
  experiments:'Thí nghiệm AI',pipeline:'Luồng dữ liệu',groupDocuments:'Tài liệu',groupResearch:'Nghiên cứu AI',groupOperations:'Dữ liệu & vận hành',
  QUEUED:'Thí nghiệm đang chờ',RUNNING:'Đang chạy thí nghiệm · kết quả sẽ tự hiển thị',FAILED:'Thí nghiệm thất bại — tải lại hoặc tạo lượt mới',SOURCE_CHANGED:'Nguồn thay đổi. Tạo phiên bản tham chiếu đã kiểm tra mới.',EXPERIMENT_UNAVAILABLE:'Chưa chạy được thí nghiệm. Kiểm tra worker rồi chạy lại.',ATTEMPTS_EXHAUSTED:'Worker đã hết lượt phục hồi. Kiểm tra dịch vụ rồi tạo lượt mới.',
  title:'Đo chất lượng AI bằng tài liệu nguồn.',hint:'Tạo nhãn chuẩn đã tự kiểm tra, đánh giá kết quả trích xuất đã lưu và so sánh cách truy xuất. Không tự upload hay gọi Azure.',
  datasets:'1. Bộ dữ liệu tham chiếu',results:'2. Kết quả thí nghiệm',newDataset:'Tạo phiên bản tham chiếu',name:'Tên phiên bản tham chiếu',nameHint:'Ví dụ: khoản thực chi DATEV · đã kiểm tra v1',
  document:'Tài liệu nguồn',page:'Trang',field:'Mã trường',expected:'Giá trị đúng đọc từ PDF',question:'Câu hỏi tham chiếu',addField:'Thêm trường kỳ vọng',addQuestion:'Thêm câu hỏi truy xuất',
  fieldHint:'Dùng đúng mã trường trích xuất hoặc nhập mã trường còn thiếu. Tự đọc giá trị từ PDF; không xem dự đoán AI là nhãn chuẩn.',
  questionHint:'Chọn một tài liệu và trang phải trả lời được câu hỏi. Hit rate@5 và MRR@5 dùng một nguồn chuẩn này.',
  checked:'Tôi đã tự đối chiếu các nhãn này với PDF gốc.',save:'Lưu phiên bản tham chiếu bất biến',remove:'Bỏ nhãn',open:'Mở PDF để kiểm tra',
  extraction:'Đánh giá trích xuất đã lưu',retrieval:'So sánh BM25 / Vector / Hybrid',empty:'Chưa có bộ tham chiếu. Mở PDF gốc rồi thêm ít nhất một trường hoặc câu hỏi đã kiểm tra.',
  noDocuments:'Tải và phân tích PDF nguồn trước. Thí nghiệm không dùng bộ văn bản mẫu cố định.',documents:'Mở tài liệu',loading:'Đang tải dữ liệu nghiên cứu…',error:'Chưa thực hiện được. Kiểm tra dịch vụ và thử lại.',
  conflict:'Nguồn hoặc hồ sơ đã thay đổi. Tải lại và tạo phiên bản tham chiếu đã kiểm tra mới.',unauthorized:'Hết phiên hoặc không đủ quyền. Đăng nhập lại.',limit:'Đạt giới hạn chạy thí nghiệm. Thử lại ở phút tiếp theo.',
  stale:'Phiên bản lịch sử — tài liệu đã thay đổi. Giữ kết quả để đối chiếu; tạo bộ tham chiếu mới để chạy tiếp.',
  noRuns:'Chưa có số đo. Lưu nhãn chuẩn, chọn phiên bản rồi tự bấm chạy thí nghiệm.',saved:'Đã lưu phiên bản tham chiếu. Chọn phiên bản bên dưới để chạy.',
  scope:'Điểm chỉ áp dụng cho các trường/trang đã gắn nhãn trong hồ sơ này, không phải độ chính xác OCR toàn bộ hay groundedness của LLM. So khớp bỏ qua hoa/thường, độ rộng Unicode và khoảng trắng thừa; số và đơn vị tiền phải khớp.',
  notJudge:'Đánh giá local · 0 lượt gọi Azure mới · chưa có Foundry judge hay so sánh prompt/model A/B',
  precision:'Precision',recall:'Recall',f1:'F1',truePositive:'Trường đúng',falsePositive:'Dự đoán sai',falseNegative:'Nhãn bị bỏ sót',hitRateAt5:'Hit rate@5',mrrAt5:'MRR@5',
  passed:'Khớp',failed:'Cần kiểm tra',actual:'Giá trị quan sát',rank:'Thứ hạng',duration:'Thời gian đo được',samples:'Mẫu đã gắn nhãn',version:'Phiên bản nguồn',
  assetsTitle:'Theo dõi từ bản gốc tới bộ dữ liệu nghiên cứu.',assetsHint:'Bronze / Silver / Gold là các lớp xuất dữ liệu logic, chưa phải data lake Azure đã kết nối. Dùng chính tài liệu riêng tư và nhãn chuẩn đã lưu.',
  processing:'Hàng đợi xử lý',assets:'Dữ liệu & kết nối Azure',bronze:'Bronze · Tham chiếu bản gốc',silver:'Silver · Trang & trường đã đọc',gold:'Gold · Nhãn đã kiểm tra',
  bronzeHint:'PDF gốc giữ trong kho riêng tư, không nằm trong tệp xuất.',silverHint:'Kết quả trích xuất, bảng, nhà cung cấp và model thực tế đã lưu.',goldHint:'Phiên bản nhãn do người kiểm tra và kết quả thí nghiệm đã đo.',
  export:'Tải bộ dữ liệu nghiên cứu',jsonl:'Tải đầu vào đánh giá (JSONL)',exportConsent:'Tệp tải xuống có nội dung tài liệu và nhãn. Tôi sẽ giữ riêng tư và chỉ gửi tới nơi được cho phép.',
  exportNote:'Chỉ tải xuống. Không upload Blob, kích hoạt Data Factory, chạy Foundry hay tạo tài nguyên Azure.',history:'Nhật ký tải dữ liệu riêng tư',noExports:'Chưa tạo bản xuất cho hồ sơ này.',
  integrations:'Ranh giới tích hợp Azure',notConnected:'App chưa kết nối',docAi:'Azure Document Intelligence',docAiHint:'Luồng tài liệu sử dụng khi được cấu hình. Nhà cung cấp và model trên từng tài liệu phản ánh lượt trích xuất đã thực hiện.',
  foundry:'Microsoft Foundry',foundryHint:'Chuẩn bị JSONL từ câu hỏi đã gắn nhãn và ngữ cảnh PDF. Không tự tạo câu trả lời hay điểm judge. Vẫn cần dự án Foundry, model và ánh xạ evaluator.',
  factory:'Azure Data Factory',factoryHint:'Dành cho điều phối nhập dữ liệu từ kho đã cho phép sau này. Hàng đợi Java hiện quét và trích xuất; Data Factory không phải công cụ OCR.',
  blob:'Azure Blob Storage',blobHint:'Chưa cấu hình sao chép cloud ở đây. Không chuyển PDF riêng tư sang container công khai. Cần kho riêng tư được duyệt và danh tính đúng phạm vi.',
  docs:'Tài liệu Microsoft',sourceHash:'Dấu vân tay nguồn',noScore:'Chưa đo',researchLink:'Tạo nhãn chuẩn, đánh giá trích xuất và so sánh truy xuất',pipelineLink:'Xem xử lý, nguồn gốc dữ liệu và ranh giới kết nối Azure',
};
const de:Copy={
  ...en,experiments:'KI-Experimente',pipeline:'Datenpipelines',groupDocuments:'Dokumente',groupResearch:'KI-Forschung',groupOperations:'Daten & Betrieb',
  labelFlow:'PDF → geprüfte Labels',tables:'Tabellen',
  QUEUED:'Experiment eingereiht',RUNNING:'Experiment läuft · Ergebnisse erscheinen automatisch',FAILED:'Experiment fehlgeschlagen — aktualisieren oder neuen Lauf starten',SOURCE_CHANGED:'Quelle geändert. Neue geprüfte Referenzversion anlegen.',EXPERIMENT_UNAVAILABLE:'Experiment nicht verfügbar. Worker prüfen und erneut starten.',ATTEMPTS_EXHAUSTED:'Worker-Wiederherstellung ausgeschöpft. Dienste prüfen und neuen Lauf starten.',
  title:'KI an den eigenen Quelldokumenten messen.',hint:'Unabhängig geprüfte Referenzen anlegen, gespeicherte Extraktion bewerten und Suchstrategien vergleichen. Kein automatischer Upload oder Azure-Aufruf.',
  datasets:'1. Referenzdatensatz',results:'2. Experimentergebnisse',newDataset:'Referenzversion anlegen',name:'Name der Referenzversion',nameHint:'Zum Beispiel: DATEV-Auszahlung · geprüft v1',
  document:'Quelldokument',page:'Seite',field:'Feldschlüssel',expected:'Sollwert aus dem PDF',question:'Referenzfrage',addField:'Sollfeld hinzufügen',addQuestion:'Suchfrage hinzufügen',
  fieldHint:'Exakten Feldschlüssel oder Schlüssel eines fehlenden Felds eingeben. Sollwert am Original ablesen; Vorhersagen sind keine Referenzwahrheit.',questionHint:'Ein Dokument und eine Seite als richtige Fundstelle wählen. Hit rate@5 und MRR@5 messen dieses einzelne Referenzziel.',
  checked:'Ich habe diese Referenzen unabhängig am Original-PDF geprüft.',save:'Unveränderliche Referenzversion speichern',remove:'Referenz entfernen',open:'Original-PDF prüfen',
  extraction:'Gespeicherte Extraktion bewerten',retrieval:'BM25 / Vektor / Hybrid vergleichen',empty:'Noch kein Referenzdatensatz. Original prüfen und mindestens ein Sollfeld oder eine Suchfrage hinzufügen.',
  noDocuments:'Zuerst ein Quell-PDF hochladen und analysieren. Keine festen Textbeispiele in diesen Experimenten.',documents:'Dokumente öffnen',loading:'Forschungsdaten werden geladen…',error:'Aktion fehlgeschlagen. Dienste prüfen und erneut versuchen.',
  conflict:'Quellen oder Vorgang geändert. Aktualisieren und neue geprüfte Referenzversion anlegen.',unauthorized:'Sitzung abgelaufen oder Berechtigung fehlt. Erneut anmelden.',limit:'Experimentlimit erreicht. In der nächsten Minute erneut versuchen.',
  stale:'Historische Version — Quelldokumente geändert. Für Vergleiche erhalten; für neue Läufe eine neue Referenzversion anlegen.',
  noRuns:'Noch keine Messungen. Referenzen speichern, Version wählen und Experiment ausdrücklich starten.',saved:'Referenzversion gespeichert. Unten zum Ausführen auswählen.',
  scope:'Kennzahlen gelten nur für beschriftete Felder/Seiten dieses Vorgangs, nicht für gesamte OCR-Genauigkeit oder LLM-Groundedness. Vergleich ignoriert Groß-/Kleinschreibung, Unicode-Breite und zusätzliche Leerzeichen; Beträge und Währungen müssen übereinstimmen.',
  notJudge:'Lokale Bewertung · 0 neue Azure-Aufrufe · kein Foundry-Judge oder Prompt-/Modell-A/B-Test',
  truePositive:'Richtige Felder',falsePositive:'Falsche Vorhersagen',falseNegative:'Fehlende Referenzen',passed:'Übereinstimmung',failed:'Prüfen',actual:'Beobachteter Wert',rank:'Rang',duration:'Gemessene Laufzeit',samples:'Beschriftete Beispiele',version:'Quellversion',
  assetsTitle:'Vom Original zum Forschungsdatensatz.',assetsHint:'Bronze / Silver / Gold sind logische Exportebenen, kein verbundener Azure Data Lake. Verwendet aktuelle private Dokumente und gespeicherte Referenzen.',
  processing:'Verarbeitungswarteschlange',assets:'Daten & Azure-Anbindungen',bronze:'Bronze · Originalverweise',silver:'Silver · Seiten & Felder',gold:'Gold · Geprüfte Referenzen',
  bronzeHint:'Original-PDFs bleiben privat und sind nicht im Export enthalten.',silverHint:'Tatsächlich gespeicherte Extraktion, Tabellen, Anbieter und Modell.',goldHint:'Manuell geprüfte Referenzversionen und gemessene Ergebnisse.',
  export:'Forschungsdaten herunterladen',jsonl:'Bewertungseingaben herunterladen (JSONL)',exportConsent:'Download enthält Dokumenttext und Referenzen. Ich halte ihn privat und übertrage ihn nur an genehmigte Ziele.',
  exportNote:'Nur Download. Kein Blob-Upload, Data-Factory-Trigger, Foundry-Lauf oder Anlegen von Azure-Ressourcen.',history:'Protokoll privater Downloads',noExports:'Noch kein Export für diesen Vorgang.',
  integrations:'Grenzen der Azure-Anbindung',notConnected:'Von dieser App nicht verbunden',docAiHint:'Wird bei Konfiguration für Dokumentanalyse verwendet. Anbieter und Modell am Dokument beschreiben dessen tatsächliche Extraktion.',
  foundryHint:'JSONL aus geprüften Fragen und PDF-Kontexten vorbereiten. Keine erfundenen Antworten oder Judge-Scores. Foundry-Projekt, Modell und Evaluator-Zuordnung fehlen noch.',
  factoryHint:'Künftige Orchestrierung freigegebener Datenquellen. Aktuell scannt und extrahiert die Java-Warteschlange. Data Factory ist keine OCR-Engine.',
  blobHint:'Hier ist keine Cloud-Kopie konfiguriert. Keine privaten Originale in öffentliche Container. Privater Container und begrenzte Identität müssen genehmigt sein.',docs:'Microsoft-Dokumentation',sourceHash:'Quellfingerabdruck',noScore:'Nicht gemessen',researchLink:'Geprüfte Referenzen und Extraktions-/Suchvergleiche',pipelineLink:'Verarbeitung, Datenherkunft und Azure-Anbindungsgrenzen ansehen',
};
export function researchText(locale:string){const table=locale==='vi'?vi:locale==='de'?de:en;return (key:string)=>table[key as keyof Copy]||key;}
