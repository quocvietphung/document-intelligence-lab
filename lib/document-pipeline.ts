import type {PlatformData} from './platform';
import {activeDocumentJob,latestDocumentJobs} from './document-results';

export type PipelineJob=PlatformData['jobs'][number];
export type PipelineFilter='all'|'active'|'review'|'verified'|'failed'|'cancelled'|'expired';
export const pipelineStages=['RECEIVED','SCAN','EXTRACT','VALIDATE','ATTACH','HUMAN_REVIEW'] as const;
export function pipelineSummary(jobs:readonly PipelineJob[]){
  const latest=latestDocumentJobs(jobs);
  return {latest,active:latest.filter(activeDocumentJob).length,
    review:latest.filter(j=>j.status==='COMPLETE'&&j.reviewStatus!=='verified').length,
    verified:latest.filter(j=>j.status==='COMPLETE'&&j.reviewStatus==='verified').length,
    failed:latest.filter(j=>j.status==='FAILED').length};
}
export function filterPipelineJobs(jobs:readonly PipelineJob[],filter:PipelineFilter,query:string,history=false){
  const source=history?[...jobs]:latestDocumentJobs(jobs),text=query.trim().toLowerCase();
  return source.filter(job=>{
    if(text&&!`${job.name} ${job.id} ${job.sha256}`.toLowerCase().includes(text))return false;
    if(filter==='active')return activeDocumentJob(job);
    if(filter==='review')return job.status==='COMPLETE'&&job.reviewStatus!=='verified';
    if(filter==='verified')return job.status==='COMPLETE'&&job.reviewStatus==='verified';
    return filter==='all'||job.status===filter.toUpperCase();
  });
}
export function pipelineSteps(job:PipelineJob){
  const events=job.events||[];
  const reached=events.map(e=>e.stage==='REUSE_EXTRACTION'?'EXTRACT':e.stage);
  const last=Math.max(-1,...reached.map(stage=>pipelineStages.indexOf(stage as typeof pipelineStages[number])));
  return pipelineStages.map((stage,index)=>({stage,state:job.status==='COMPLETE'&&stage==='HUMAN_REVIEW'?(job.reviewStatus==='verified'?'done':'current'):
    !reached.includes(stage)?'unknown':job.status==='COMPLETE'||index<last?'done':index===last?(job.status==='FAILED'?'failed':job.status==='CANCELLED'?'cancelled':'current'):'unknown'}));
}
export function pipelineManifest(caseId:string,job:PipelineJob,now=new Date().toISOString()){
  return {schemaVersion:'document-pipeline-manifest-v1',exportedAt:now,caseId,
    source:{filename:job.name,sha256:job.sha256},
    processing:{id:job.id,status:job.status,stage:job.stage,attempt:job.attempt,createdAt:job.createdAt,finishedAt:job.finishedAt??null,nextAttemptAt:job.nextAttemptAt??null,retryOf:job.retryOf??null,errorCode:job.error_code},
    extraction:job.extraction??null,reviewStatus:job.reviewStatus??null,events:job.events||[],
    safety:{includesPdfBytes:false,includesExtractedText:false,includesCredentials:false},
    limitations:['Recognition confidence is not verified accuracy.','A completed extraction is not human approval.','RAG indexing is on demand; this manifest does not certify vector-index readiness.']};
}
const en={
  title:'Processing control room',hint:'Track each file from receipt to evidence review. Extraction is not approval, and original files stay private.',
  all:'All states',active:'In progress',review:'Ready for review',verified:'Reviewer confirmed',failed:'Needs attention',cancelled:'Cancelled',expired:'Expired',
  search:'Search filename, job ID or SHA-256',history:'Include earlier submissions',scope:'Counts use the latest submission per file in the most recent 30 submissions for this dossier.',
  shown:'shown',empty:'No processing records match these filters.',details:'Processing details',close:'Close processing details',result:'Open result & PDF',retry:'Retry processing',
  cancel:'Cancel waiting job',cancelTitle:'Cancel this waiting job?',cancelHint:'Only a queued job or a waiting retry can be cancelled. An active provider request cannot be interrupted. Prior processing, charges and the private original are not undone; retention still applies.',confirmCancel:'Confirm cancellation',back:'Keep processing',
  manifest:'Download processing manifest',manifestHint:'Local JSON with hashes, events and extraction counts. No PDF, extracted text or credentials.',
  timeline:'Recorded stage history',legacy:'Detailed stage events were not recorded for this historical job. Its saved result remains available.',
  source:'Source identity',hash:'SHA-256 of uploaded bytes',submitted:'Submitted',finished:'Finished',next:'Next automatic attempt',attempt:'Attempt',retryOf:'Previous job',
  extraction:'Saved extraction',pages:'Pages',fields:'Fields',tables:'Tables',characters:'Text characters',provider:'Provider / model',
  reviewHint:'Compare the original before confirming. Zero form fields can be valid for reference wording.',ragHint:'Search/RAG indexing is built on demand in AI Studio; successful OCR does not certify an index.',
  RECEIVED:'Received',SCAN:'Security scan',EXTRACT:'AI extraction',REUSE_EXTRACTION:'Reuse saved extraction',VALIDATE:'Content checks',ATTACH:'Save evidence',HUMAN_REVIEW:'Human review',STOPPED:'Stopped',PURGED:'Retention cleanup',CANCELLED:'Cancelled',
  running:'Worker active',paused:'Worker disabled',persistent:'Durable PostgreSQL queue',volatile:'Non-durable storage',private:'Bearer-protected original',
};
type Copy={[K in keyof typeof en]:string};
const de:Copy={
  title:'Verarbeitungsleitstand',hint:'Jede Datei vom Eingang bis zur Belegprüfung verfolgen. Extraktion ist keine Freigabe; Originale bleiben privat.',
  all:'Alle Zustände',active:'In Bearbeitung',review:'Bereit zur Prüfung',verified:'Manuell bestätigt',failed:'Handlungsbedarf',cancelled:'Abgebrochen',expired:'Abgelaufen',
  search:'Dateiname, Auftrags-ID oder SHA-256 suchen',history:'Frühere Einreichungen einblenden',scope:'Gezählt wird die neueste Einreichung je Datei innerhalb der letzten 30 Aufträge dieses Vorgangs.',
  shown:'angezeigt',empty:'Keine passenden Verarbeitungsaufträge.',details:'Verarbeitungsdetails',close:'Verarbeitungsdetails schließen',result:'Ergebnis & PDF öffnen',retry:'Verarbeitung erneut starten',
  cancel:'Wartenden Auftrag abbrechen',cancelTitle:'Diesen wartenden Auftrag abbrechen?',cancelHint:'Nur eingereihte Aufträge und wartende Wiederholungen lassen sich abbrechen. Aktive Anbieteranfragen werden nicht unterbrochen. Frühere Verarbeitung, Kosten und Original bleiben bestehen; die Aufbewahrungsfrist gilt weiter.',confirmCancel:'Abbruch bestätigen',back:'Weiter verarbeiten',
  manifest:'Verarbeitungsnachweis herunterladen',manifestHint:'Lokales JSON mit Hashes, Ereignissen und Extraktionszahlen. Ohne PDF, extrahierten Text oder Zugangsdaten.',
  timeline:'Aufgezeichnete Schritte',legacy:'Für diesen historischen Auftrag wurden keine einzelnen Schritte aufgezeichnet. Das gespeicherte Ergebnis bleibt verfügbar.',
  source:'Quellidentität',hash:'SHA-256 der hochgeladenen Bytes',submitted:'Eingereicht',finished:'Beendet',next:'Nächster automatischer Versuch',attempt:'Versuch',retryOf:'Vorheriger Auftrag',
  extraction:'Gespeicherte Extraktion',pages:'Seiten',fields:'Felder',tables:'Tabellen',characters:'Textzeichen',provider:'Anbieter / Modell',
  reviewHint:'Vor der Bestätigung das Original vergleichen. Bei Referenzbedingungen sind null Formularfelder möglich.',ragHint:'Such-/RAG-Indizes entstehen bei Bedarf im KI-Studio. Erfolgreiche OCR bestätigt keinen Index.',
  RECEIVED:'Eingegangen',SCAN:'Sicherheitsprüfung',EXTRACT:'KI-Extraktion',REUSE_EXTRACTION:'Gespeicherte Extraktion nutzen',VALIDATE:'Inhaltsprüfung',ATTACH:'Belege speichern',HUMAN_REVIEW:'Manuelle Prüfung',STOPPED:'Angehalten',PURGED:'Aufbewahrung bereinigt',CANCELLED:'Abgebrochen',
  running:'Verarbeitung aktiv',paused:'Verarbeitung deaktiviert',persistent:'Dauerhafte PostgreSQL-Warteschlange',volatile:'Nicht dauerhafter Speicher',private:'Original mit Bearer-Schutz',
};
const vi:Copy={
  title:'Trung tâm xử lý tài liệu',hint:'Theo dõi tệp từ khi tiếp nhận đến kiểm duyệt chứng cứ. Trích xuất không phải phê duyệt; bản gốc được giữ riêng tư.',
  all:'Mọi trạng thái',active:'Đang xử lý',review:'Chờ kiểm duyệt',verified:'Đã được người kiểm tra xác nhận',failed:'Cần xử lý',cancelled:'Đã hủy',expired:'Đã hết hạn',
  search:'Tìm tên tệp, mã tác vụ hoặc SHA-256',history:'Hiện các lần gửi trước',scope:'Thống kê lần gửi mới nhất của từng tệp trong 30 lần gửi gần nhất thuộc hồ sơ này.',
  shown:'đang hiện',empty:'Không có tác vụ phù hợp với bộ lọc.',details:'Chi tiết xử lý',close:'Đóng chi tiết xử lý',result:'Mở kết quả & PDF',retry:'Thử xử lý lại',
  cancel:'Hủy tác vụ đang chờ',cancelTitle:'Hủy tác vụ đang chờ này?',cancelHint:'Chỉ hủy được tác vụ trong hàng đợi hoặc đang chờ thử lại. Không ngắt yêu cầu đã gửi nhà cung cấp. Việc hủy không hoàn tác xử lý, chi phí hay bản gốc đã lưu; thời hạn lưu vẫn áp dụng.',confirmCancel:'Xác nhận hủy',back:'Tiếp tục xử lý',
  manifest:'Tải bản ghi xử lý',manifestHint:'JSON lưu local gồm hash, sự kiện và số lượng trích xuất. Không kèm PDF, nội dung trích xuất hay thông tin đăng nhập.',
  timeline:'Lịch sử từng bước đã ghi nhận',legacy:'Tác vụ cũ này chưa có nhật ký từng bước. Kết quả đã lưu vẫn xem được.',
  source:'Nhận diện tài liệu nguồn',hash:'SHA-256 của tệp đã tải lên',submitted:'Đã gửi',finished:'Hoàn tất lúc',next:'Lần thử tự động tiếp theo',attempt:'Lần thử',retryOf:'Tác vụ trước',
  extraction:'Kết quả trích xuất đã lưu',pages:'Trang',fields:'Trường',tables:'Bảng',characters:'Ký tự văn bản',provider:'Nhà cung cấp / mô hình',
  reviewHint:'Đối chiếu bản gốc trước khi xác nhận. Điều khoản tham khảo có thể không có trường biểu mẫu.',ragHint:'Chỉ mục tìm kiếm/RAG được tạo khi cần trong AI Studio. OCR thành công không chứng minh chỉ mục đã sẵn sàng.',
  RECEIVED:'Tiếp nhận',SCAN:'Quét bảo mật',EXTRACT:'AI trích xuất',REUSE_EXTRACTION:'Dùng lại kết quả đã lưu',VALIDATE:'Kiểm tra nội dung',ATTACH:'Lưu chứng cứ',HUMAN_REVIEW:'Người kiểm duyệt',STOPPED:'Đã dừng',PURGED:'Đã dọn theo thời hạn',CANCELLED:'Đã hủy',
  running:'Bộ xử lý đang bật',paused:'Bộ xử lý đang tắt',persistent:'Hàng đợi PostgreSQL bền vững',volatile:'Kho không bền vững',private:'Bản gốc được bảo vệ bằng Bearer token',
};
export const pipelineCopies={en,de,vi};
export function pipelineCopy(locale:string):Copy{return locale==='de'?de:locale==='vi'?vi:en;}
