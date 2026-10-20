// Describes implemented boundaries, not invented job events or inferred health.
export const lifecycleIds=['intake','scan','extract','review','retrieve','evaluate','retain'] as const;
const en={title:'From PDF to reviewed evidence',hint:'A workflow map, not a live status display. Job events cover processing only; search and evaluation are separate, explicit actions.',steps:[
  ['1 · Intake','Choose a dossier/domain, source note and check profile. Confirm the files; SHA-256 and request IDs prevent avoidable duplicates.'],
  ['2 · Secure queue','Format/size/page limits, private bytes, enabled ClamAV scan and PostgreSQL job leases. Transient failures retry at most three times.'],
  ['3 · Extract & validate','Exactly one configured engine reads pages/tables. Java applies transparent checks; missing confidence stays unknown.'],
  ['4 · Human review','Open result & PDF, inspect identity/period/amounts, correct values and explicitly confirm. Extraction is not approval.'],
  ['5 · Find & ask','AI Studio builds authorized search indexes on demand. Nova uses selected evidence; check each source. OCR completion does not certify indexing.'],
  ['6 · Evaluate & export','Save independently checked PDF references. Run source-bound experiments or explicitly export private evaluation input; no automatic cloud judge.'],
  ['7 · Retain & operate','Inspect attempts, receipts and metadata exports. Original-file retention does not purge case/chat history. No backup/restore or cloud-orchestration SLA is claimed.'],
]};
type Copy={title:string;hint:string;steps:string[][]};
const de:Copy={title:'Vom PDF zum geprüften Beleg',hint:'Ablaufkarte, keine Live-Statusanzeige. Auftragsschritte betreffen die Verarbeitung; Suche und Evaluierung werden separat ausgelöst.',steps:[
  ['1 · Eingang','Bereich, Vorgang, Herkunft und Prüfprofil wählen. Dateien bestätigen; SHA-256 und Request-ID begrenzen vermeidbare Duplikate.'],
  ['2 · Sichere Warteschlange','Format-/Größen-/Seitenlimits, private Dateien, ClamAV und PostgreSQL-Leases. Vorübergehende Fehler höchstens dreimal versuchen.'],
  ['3 · Extraktion & Prüfung','Ein konfigurierter Anbieter liest Seiten/Tabellen. Java prüft transparente Regeln; unbekannte Konfidenz bleibt unbekannt.'],
  ['4 · Manuelle Prüfung','Ergebnis und PDF öffnen, Identität/Zeitraum/Beträge vergleichen, korrigieren und ausdrücklich bestätigen. Extraktion ist keine Freigabe.'],
  ['5 · Suchen & fragen','KI-Studio erstellt berechtigte Indizes bei Bedarf. Nova nutzt Belege; jede Quelle prüfen. OCR-Abschluss bestätigt keinen Suchindex.'],
  ['6 · Evaluieren & exportieren','Unabhängig geprüfte PDF-Referenzen speichern. Quellenbezogene Tests oder privater Evaluierungsexport; kein automatischer Cloud-Judge.'],
  ['7 · Aufbewahren & betreiben','Versuche, Belege und Metadaten prüfen. Dateiaufbewahrung löscht keinen Vorgangs-/Chatverlauf. Keine Backup-/Restore- oder Cloud-SLA-Zusage.'],
]};
const vi:Copy={title:'Từ PDF đến chứng cứ đã kiểm tra',hint:'Sơ đồ thao tác, không phải trạng thái đang chạy. Nhật ký tác vụ chỉ ghi phần xử lý; tìm kiếm và đánh giá là thao tác riêng.',steps:[
  ['1 · Tiếp nhận','Chọn lĩnh vực, hồ sơ, nguồn và cấu hình kiểm tra. Xác nhận tệp; SHA-256 và mã yêu cầu hạn chế gửi trùng.'],
  ['2 · Hàng đợi an toàn','Giới hạn định dạng/dung lượng/trang, bản gốc riêng tư, ClamAV và khóa tác vụ PostgreSQL. Lỗi tạm thời thử tối đa ba lần.'],
  ['3 · Trích xuất & kiểm tra','Một dịch vụ đã chọn đọc trang/bảng. Java kiểm tra bằng quy tắc; độ tin cậy chưa có giữ là chưa biết.'],
  ['4 · Người kiểm duyệt','Mở kết quả & PDF, đối chiếu người/kỳ/số tiền, sửa và xác nhận rõ ràng. Trích xuất không phải phê duyệt.'],
  ['5 · Tìm kiếm & hỏi','AI Studio tạo chỉ mục có phân quyền khi cần. Nova dùng chứng cứ được chọn; kiểm tra từng nguồn. OCR xong chưa chứng minh chỉ mục sẵn sàng.'],
  ['6 · Đánh giá & xuất','Lưu nhãn PDF đã kiểm tra độc lập. Chạy thí nghiệm theo nguồn hoặc xuất dữ liệu đánh giá riêng tư; không tự gọi AI chấm cloud.'],
  ['7 · Lưu giữ & vận hành','Xem lần thử, bản ghi và xuất metadata. Hết hạn tệp không xóa lịch sử hồ sơ/chat. Chưa cam kết backup/restore hay SLA điều phối cloud.'],
]};
export function pipelineLifecycle(locale:string):Copy{return locale==='vi'?vi:locale==='de'?de:en;}
