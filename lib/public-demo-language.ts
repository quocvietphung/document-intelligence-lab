const en={
  badge:"PUBLIC DEMO · READ ONLY",
  notice:"Explore synthetic evidence without login, APIs or Azure charges. Nova uses deterministic sample replies, not an LLM. Run Docker locally for uploads and document review. Neither version provides payments or payment simulations.",
  quality:"The versioned dataset contains 40 labelled synthetic text records. This public demo does not run the Java benchmark or invent accuracy scores. See the local verification report in the repository.",
  engine:"Browser fixture search · no vector model",
  modelNote:"Search bundled sample evidence locally. The full Docker platform uses ONNX, Qdrant, BM25 and Azure; those services are not running on this demo.",
  worker:"Illustrative pipeline snapshot",
  operationsHint:"Architecture walkthrough only. Databases, scanning, quotas and telemetry are not connected to this public site.",
  dataset:"View dataset & local results",
};
const de:typeof en={
  badge:"ÖFFENTLICHE DEMO · NUR LESEN",
  notice:"Fiktive Belege ohne Anmeldung, APIs oder Azure-Kosten erkunden. Nova gibt feste Musterantworten, keine LLM-Antworten. Docker lokal für Uploads und Dokumentprüfung verwenden. Keine Version bietet Zahlungen oder Zahlungssimulationen.",
  quality:"Der versionierte Datensatz enthält 40 beschriftete synthetische Textbeispiele. Diese Demo führt keinen Java-Benchmark aus und erfindet keine Genauigkeitswerte. Lokale Ergebnisse stehen im Repository.",
  engine:"Lokale Beispielsuche · kein Vektormodell",
  modelNote:"Mitgelieferte Musterbelege lokal durchsuchen. Die vollständige Docker-Plattform nutzt ONNX, Qdrant, BM25 und Azure; diese Dienste laufen nicht in dieser Demo.",
  worker:"Illustrativer Pipeline-Ausschnitt",
  operationsHint:"Nur Architekturübersicht. Datenbanken, Virenscan, Kontingente und Telemetrie sind auf dieser öffentlichen Website nicht verbunden.",
  dataset:"Datensatz & lokale Ergebnisse",
};
const vi:typeof en={
  badge:"DEMO CÔNG KHAI · CHỈ ĐỌC",
  notice:"Xem chứng cứ giả lập không cần đăng nhập, API hay phí Azure. Nova trả lời theo mẫu, không phải LLM. Chạy Docker local để tải lên và kiểm duyệt tài liệu. Cả hai bản đều không có thanh toán hay mô phỏng thanh toán.",
  quality:"Tập dữ liệu có phiên bản gồm 40 văn bản giả lập gắn nhãn. Demo không chạy Java benchmark hoặc tạo điểm chính xác giả. Xem báo cáo kiểm thử local trong repository.",
  engine:"Tìm chứng cứ mẫu trên trình duyệt · không chạy vector model",
  modelNote:"Tìm trong chứng cứ mẫu có sẵn. Bản Docker đầy đủ dùng ONNX, Qdrant, BM25 và Azure; các dịch vụ này không chạy trên demo công khai.",
  worker:"Ảnh trạng thái pipeline minh họa",
  operationsHint:"Chỉ giới thiệu kiến trúc. Website này không kết nối database, quét virus, hạn mức hoặc telemetry.",
  dataset:"Xem dữ liệu & kết quả local",
};
export function publicDemoText(locale:string) {const table=locale==="de"?de:locale==="vi"?vi:en;return(key:keyof typeof en)=>table[key];}
