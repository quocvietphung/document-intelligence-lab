import {z} from "zod";

/** The `controlTower` block that the ETL worker writes into each run manifest (services/document-etl/control_tower.py). */
const mode = z.enum(["measured", "deterministic", "configured", "simulated", "not-run"]);
const kpi = z.object({key: z.string(), value: z.number().nullable(), mode, unit: z.string(), detail: z.string()});
export const controlTowerSchema = z.object({
  schemaVersion: z.literal("control-tower-v1"),
  partition: z.object({tenantKey: z.string(), projectId: z.string()}),
  rowCounts: z.record(z.string(), z.number()),
  lineage: z.array(z.object({from: z.string(), to: z.string(), rowsIn: z.number(), rowsOut: z.number()})),
  dataQuality: z.array(z.object({check: z.string(), passed: z.boolean(), detail: z.string()})),
  kpis: z.array(kpi),
  simulatedKpis: z.array(kpi),
  stages: z.array(z.object({stage: z.string(), latencyMs: z.number(), rows: z.number().nullable(), mode})),
  retrieval: z.array(z.object({case: z.string(), retriever: z.string(), k: z.number(), expected: z.string().nullable(), rank: z.number().nullable(),
    passed: z.boolean().nullable(), expectedAbstain: z.boolean(), abstained: z.boolean().nullable(), mode})),
  citations: z.array(z.object({case: z.string(), value: z.string(), expected: z.string(), found: z.string().nullable(), boundingBox: z.string().nullable(),
    documentMatch: z.boolean(), pageMatch: z.boolean(), bboxMatch: z.boolean(), mode})),
  models: z.array(z.object({provider: z.string(), model: z.string(), observations: z.number(), valid: z.number(), reviewed: z.number()})),
  cost: z.array(z.object({provider: z.string(), model: z.string(), documents: z.number(), estimatedCost: z.number(), currency: z.string(), pricing: z.string(), mode})),
  drill: z.array(z.object({observationId: z.string(), documentId: z.string(), documentName: z.string(), page: z.number(), boundingBox: z.string().nullable(),
    bboxSource: z.string().nullable(), ocrText: z.string().nullable(), field: z.string(), provider: z.string(), model: z.string(), rawValue: z.string(),
    normalizedValue: z.string().nullable(), reviewedValue: z.string().nullable(), reviewStatus: z.string(), quality: z.string(), mode})),
  corrections: z.number(),
  export: z.array(z.object({table: z.string(), rows: z.number(), csv: z.string(), parquet: z.string()})),
  limitations: z.array(z.string()),
});
export type ControlTower = z.infer<typeof controlTowerSchema>;
export type MeasurementMode = z.infer<typeof mode>;

const runSchema = z.object({id: z.string(), time: z.string(), status: z.string(), current: z.boolean(), result: z.unknown().optional()});
/** The latest completed run of a dossier that carries Control Tower marts; older runs are reported as such. */
export function latestControlTower(body: unknown): {state: "ready"; run: {id: string; time: string; current: boolean; method: string}; tower: ControlTower} | {state: "none" | "older"} {
  const runs = z.object({runs: z.array(runSchema)}).safeParse(body);
  if (!runs.success) return {state: "none"};
  const complete = runs.data.runs.filter((run) => run.status === "COMPLETE").sort((a, b) => b.time.localeCompare(a.time));
  for (const run of complete) {
    const result = run.result as {controlTower?: unknown; method?: string} | undefined;
    const parsed = controlTowerSchema.safeParse(result?.controlTower);
    if (parsed.success) return {state: "ready", run: {id: run.id, time: run.time, current: run.current, method: result?.method ?? ""}, tower: parsed.data};
  }
  return {state: complete.length ? "older" : "none"};
}

/** Dossiers that already have Control Tower marts (newest run first) and the rest, for the page's dossier list. */
const towerRunsSchema = z.array(z.object({caseId: z.string(), runId: z.string(), time: z.string()}));
export type DossierOption = {id: string; label: string};
export type DossierChoices = {known: boolean; ready: DossierOption[]; others: DossierOption[]};
export function dossierChoices(cases: readonly DossierOption[], runs: unknown): DossierChoices {
  const parsed = towerRunsSchema.safeParse(runs);
  if (!parsed.success) return {known: false, ready: [], others: [...cases]};
  const byId = new Map(cases.map((entry) => [entry.id, entry]));
  const ready = [...new Set(parsed.data.map((run) => run.caseId))].map((id) => byId.get(id)).filter((entry): entry is DossierOption => Boolean(entry));
  const readyIds = new Set(ready.map((entry) => entry.id));
  return {known: true, ready, others: cases.filter((entry) => !readyIds.has(entry.id))};
}
/** A dossier named in the link wins; otherwise the one with the newest Control Tower run, then the first dossier. */
export function defaultDossier(requested: string | null, choices: Pick<DossierChoices, "ready" | "others">) {
  if (requested && [...choices.ready, ...choices.others].some((entry) => entry.id === requested)) return requested;
  return choices.ready[0]?.id ?? choices.others[0]?.id ?? "";
}

export function parseBox(value: string | null): [number, number, number, number] | null {
  if (!value) return null;
  try {
    const box = JSON.parse(value);
    return Array.isArray(box) && box.length === 4 && box.every((n) => typeof n === "number" && n >= 0 && n <= 1) ? (box as [number, number, number, number]) : null;
  } catch {
    return null;
  }
}

/** Localized KPI detail; numbers come from the ETL detail, the wording from the page language. Unknown keys keep the ETL text. */
export function kpiDetail(kpi: {key: string; mode: string; detail: string}, details: Record<string, string>): string {
  const template = details[`${kpi.key}:${kpi.mode}`] ?? details[kpi.key];
  if (!template || !kpi.detail) return kpi.detail;
  const numbers = kpi.detail.match(/\d+(?:\.\d+)?/g) ?? [];
  const needed = template.match(/\{\d\}/g)?.length ?? 0;
  if (numbers.length < needed) return kpi.detail;
  return template.replace(/\{(\d)\}/g, (_match, index: string) => numbers[Number(index)]);
}

export function formatKpi(value: number | null, unit: string, locale: string): string {
  if (value === null) return "—";
  if (unit === "ratio") return new Intl.NumberFormat(locale, {style: "percent", maximumFractionDigits: 1}).format(value);
  if (unit === "EUR") return new Intl.NumberFormat(locale, {style: "currency", currency: "EUR", maximumFractionDigits: 4}).format(value);
  if (unit === "ms") return `${new Intl.NumberFormat(locale, {maximumFractionDigits: 1}).format(value)} ms`;
  return new Intl.NumberFormat(locale).format(value);
}

export const areas = ["pipeline", "quality", "rag", "cost"] as const;
export type Area = (typeof areas)[number];
export const areaKpis: Record<Area, string[]> = {
  pipeline: ["success_rate", "average_stage_latency_ms"],
  quality: ["human_correction_rate", "ocr_disagreement_rate"],
  rag: ["hit_at_k", "recall_at_k", "mrr", "abstention_correct_rate", "citation_document_accuracy", "citation_page_accuracy", "citation_bbox_accuracy", "prompt_injection_blocked_rate"],
  cost: ["estimated_cost_per_document_eur"],
};
/** Badge per measurement mode. Deterministic rules on this run's real data count as measured; the rule is named. */
export function badgeOf(value: MeasurementMode): "measured" | "simulated" | "configured" | "not-run" {
  return value === "deterministic" ? "measured" : value;
}

const en = {
  title: "Data & AI Control Tower",
  intro: "Pipeline, data quality, retrieval and cost for one dossier, read from the reviewed Gold marts of its latest ETL run. Power BI uses the same exported tables.",
  back: "Back to the workspace",
  dossier: "Dossier",
  run: "Run",
  method: "Pipeline",
  historical: "historical snapshot",
  areas: {pipeline: "Pipeline Operations", quality: "Document Data Quality", rag: "RAG & Citation Quality", cost: "AI Cost & Model Benchmark"},
  badges: {measured: "Measured", simulated: "Simulated", configured: "Configured only", "not-run": "Not run"},
  rule: "rule on this run's text",
  legend: "Badges",
  signIn: "Sign in with your lab account to read your tenant's dossiers.",
  loading: "Loading…",
  error: "The dossier data could not be loaded. Nothing was changed.",
  noRun: "This dossier has no ETL run with Control Tower marts yet, so there is nothing to show. Review its documents first (only reviewed values reach Gold), then build the data layers and refresh this page. Local stack only.",
  older: "The latest completed run was built before the Control Tower marts existed. Build the data layers again, then refresh this page.",
  openPipeline: "Open Data layers & exports",
  withData: "With Control Tower data ({count})",
  withoutData: "No ETL run yet ({count})",
  openWithData: "Or open a dossier that already has data:",
  refresh: "Refresh",
  charts: {
    stages: "Latency per step", stagesNote: "Milliseconds per ETL step of this run. ClamAV and OCR time are measured upstream.",
    flow: "Rows from Bronze to reviewed Gold", flowNote: "Each arrow shows rows in → rows out of that lineage step.",
    layers: {bronze: "Bronze", silver: "Silver", gold: "Reviewed Gold"},
    checks: "Data-quality checks", checksNote: "Passed and failed checks of this run. A failed check stops the run before any mart is published.",
    ragKpis: "Retrieval and citation accuracy", ragNote: "Labelled evaluation cases. A dash means the case has not run yet.",
    cost: "Estimated cost per model", costNote: "Configured cost. Local engines carry no per-token fee.",
    valid: "Valid observations per model", validNote: "Share of this run's field observations that passed validation.",
    empty: "This run has no data for this chart.",
  },
  kpis: {
    success_rate: "Success rate", average_stage_latency_ms: "Average stage latency", human_correction_rate: "Human correction rate",
    ocr_disagreement_rate: "OCR disagreement rate", citation_document_accuracy: "Citation document accuracy", citation_page_accuracy: "Citation page accuracy",
    citation_bbox_accuracy: "Citation bounding-box accuracy", hit_at_k: "Hit@K", recall_at_k: "Recall@K", mrr: "MRR", abstention_correct_rate: "Correct abstention",
    estimated_cost_per_document_eur: "Estimated cost per document", prompt_injection_blocked_rate: "Prompt-injection blocked rate",
  } as Record<string, string>,
  stages: {validate: "Validate contract", bronze_silver: "Bronze and Silver", dbt_tests: "dbt tests", reviewed_gold: "Reviewed Gold", analytics: "Analytics projections"} as Record<string, string>,
  columns: {stage: "Stage", latency: "Latency", rows: "Rows", from: "From", to: "To", rowsIn: "Rows in", rowsOut: "Rows out", check: "Check", result: "Result",
    document: "Document", page: "Page", field: "Field", raw: "Raw value", normalized: "Normalized value", reviewed: "Reviewed value", status: "Status", mode: "Mode",
    case: "Case", expected: "Expected", rank: "Rank", found: "Found", box: "Box", value: "Value", provider: "Provider", model: "Model", observations: "Observations",
    valid: "Valid", documents: "Documents", cost: "Estimated cost", pricing: "Pricing", table: "Table"},
  captions: {stages: "Stage latency (this run)", lineage: "Lineage Bronze → Silver → Gold", quality: "Data-quality checks", observations: "Field observations",
    retrieval: "Retrieval cases", citations: "Citation cases", models: "Model benchmark (this run)", cost: "Cost", export: "Power BI-ready export"},
  passed: "Passed", failed: "Failed", abstained: "Abstained",
  drill: {title: "Drill-through", empty: "Select an observation to follow it from the KPI to the reviewed value.", kpi: "KPI", document: "Document", page: "Page",
    box: "Bounding box", ocr: "OCR text", normalized: "Normalized value", reviewed: "Reviewed value", noBox: "No region located for this value", none: "Not reviewed yet"},
  simulated: "Simulated (fixture, not a production metric)",
  exportNote: "Files are written to the ETL volume under assets/<scope>/<run>/powerbi with relationships.json, measures.json and evaluation_cases.jsonl. Import guide: docs/POWER_BI_EXPORT.md. No Power BI login, dataset or API call.",
  limitations: "Limits",
  details: {
    average_stage_latency_ms: "ETL stages only; ClamAV and OCR time are measured upstream",
    human_correction_rate: "{0} corrections, {1} observations",
    ocr_disagreement_rate: "{0} reviewed observations",
    "ocr_disagreement_rate:not-run": "no reviewed observation in this run",
    "ocr_disagreement_rate:simulated": "fixture ocr-misread.sample.json; not a production metric",
    hit_at_k: "k={0}, BM25 over extracted text",
    abstention_correct_rate: "questions without evidence must stay unanswered",
    estimated_cost_per_document_eur: "local engines carry no per-token fee",
    prompt_injection_blocked_rate: "share of fields on instruction pages kept out of reviewed Gold",
  } as Record<string, string>,
  checks: {
    "every fact row carries tenant and project": "every fact row carries tenant and project",
    "observation ids are unique": "observation ids are unique",
    "reviewed value only on reviewed rows": "reviewed value only on reviewed rows",
    "raw value kept on every observation": "raw value kept on every observation",
    "page numbers are positive": "page numbers are positive",
    "no full page text in the mart": "no full page text in the mart",
    "measurement mode is set": "measurement mode is set",
  } as Record<string, string>,
};
export type Copy = typeof en;
const de: Copy = {
  title: "Data & AI Control Tower",
  intro: "Pipeline, Datenqualität, Suche und Kosten für einen Vorgang, gelesen aus den geprüften Gold-Marts des letzten ETL-Laufs. Power BI nutzt dieselben exportierten Tabellen.",
  back: "Zurück zum Arbeitsbereich",
  dossier: "Vorgang",
  run: "Lauf",
  method: "Pipeline",
  historical: "historischer Stand",
  areas: {pipeline: "Pipeline-Betrieb", quality: "Datenqualität der Dokumente", rag: "RAG- und Quellenqualität", cost: "KI-Kosten und Modellvergleich"},
  badges: {measured: "Gemessen", simulated: "Simuliert", configured: "Nur konfiguriert", "not-run": "Nicht ausgeführt"},
  rule: "Regel auf dem Text dieses Laufs",
  legend: "Kennzeichen",
  signIn: "Melde dich mit deinem Lab-Konto an, um die Vorgänge deines Mandanten zu lesen.",
  loading: "Wird geladen…",
  error: "Die Vorgangsdaten konnten nicht geladen werden. Es wurde nichts geändert.",
  noRun: "Für diesen Vorgang gibt es noch keinen ETL-Lauf mit Control-Tower-Marts, daher gibt es nichts anzuzeigen. Prüfe zuerst die Dokumente (nur geprüfte Werte gelangen nach Gold), erstelle dann die Datenebenen und aktualisiere diese Seite. Nur im lokalen Stack.",
  older: "Der letzte abgeschlossene Lauf stammt aus der Zeit vor den Control-Tower-Marts. Erstelle die Datenebenen erneut und aktualisiere dann diese Seite.",
  openPipeline: "Datenebenen & Exporte öffnen",
  withData: "Mit Control-Tower-Daten ({count})",
  withoutData: "Noch kein ETL-Lauf ({count})",
  openWithData: "Oder einen Vorgang öffnen, der schon Daten hat:",
  refresh: "Aktualisieren",
  charts: {
    stages: "Latenz je Schritt", stagesNote: "Millisekunden je ETL-Schritt in diesem Lauf. ClamAV- und OCR-Zeit werden vorher gemessen.",
    flow: "Zeilen von Bronze bis geprüftes Gold", flowNote: "Jeder Pfeil zeigt Zeilen ein → Zeilen aus diesem Herkunftsschritt.",
    layers: {bronze: "Bronze", silver: "Silver", gold: "Geprüftes Gold"},
    checks: "Datenqualitätsprüfungen", checksNote: "Bestandene und nicht bestandene Prüfungen dieses Laufs. Eine fehlgeschlagene Prüfung stoppt den Lauf, bevor ein Mart veröffentlicht wird.",
    ragKpis: "Genauigkeit von Suche und Quellen", ragNote: "Gelabelte Testfälle. Ein Strich bedeutet: noch nicht ausgeführt.",
    cost: "Geschätzte Kosten je Modell", costNote: "Konfigurierte Kosten. Lokale Engines haben keine Token-Gebühr.",
    valid: "Gültige Beobachtungen je Modell", validNote: "Anteil der Feldbeobachtungen dieses Laufs, die die Validierung bestanden haben.",
    empty: "Dieser Lauf enthält keine Daten für dieses Diagramm.",
  },
  kpis: {
    success_rate: "Erfolgsquote", average_stage_latency_ms: "Mittlere Schrittlatenz", human_correction_rate: "Korrekturquote durch Menschen",
    ocr_disagreement_rate: "OCR-Abweichungsquote", citation_document_accuracy: "Quellen: Dokument richtig", citation_page_accuracy: "Quellen: Seite richtig",
    citation_bbox_accuracy: "Quellen: Bounding Box richtig", hit_at_k: "Hit@K", recall_at_k: "Recall@K", mrr: "MRR", abstention_correct_rate: "Korrekte Enthaltung",
    estimated_cost_per_document_eur: "Geschätzte Kosten je Dokument", prompt_injection_blocked_rate: "Blockierte Prompt-Injection",
  },
  stages: {validate: "Vertrag prüfen", bronze_silver: "Bronze und Silver", dbt_tests: "dbt-Tests", reviewed_gold: "Geprüftes Gold", analytics: "Analytische Projektionen"},
  columns: {stage: "Schritt", latency: "Latenz", rows: "Zeilen", from: "Von", to: "Nach", rowsIn: "Zeilen ein", rowsOut: "Zeilen aus", check: "Prüfung", result: "Ergebnis",
    document: "Dokument", page: "Seite", field: "Feld", raw: "Rohwert", normalized: "Normalisierter Wert", reviewed: "Geprüfter Wert", status: "Status", mode: "Modus",
    case: "Fall", expected: "Erwartet", rank: "Rang", found: "Gefunden", box: "Box", value: "Wert", provider: "Anbieter", model: "Modell", observations: "Beobachtungen",
    valid: "Gültig", documents: "Dokumente", cost: "Geschätzte Kosten", pricing: "Preisbasis", table: "Tabelle"},
  captions: {stages: "Schrittlatenz (dieser Lauf)", lineage: "Herkunft Bronze → Silver → Gold", quality: "Datenqualitätsprüfungen", observations: "Feldbeobachtungen",
    retrieval: "Suchfälle", citations: "Quellenfälle", models: "Modellvergleich (dieser Lauf)", cost: "Kosten", export: "Export für Power BI"},
  passed: "Bestanden", failed: "Nicht bestanden", abstained: "Enthalten",
  drill: {title: "Drill-through", empty: "Wähle eine Beobachtung, um sie vom KPI bis zum geprüften Wert zu verfolgen.", kpi: "KPI", document: "Dokument", page: "Seite",
    box: "Bounding Box", ocr: "OCR-Text", normalized: "Normalisierter Wert", reviewed: "Geprüfter Wert", noBox: "Keine Region für diesen Wert gefunden", none: "Noch nicht geprüft"},
  simulated: "Simuliert (Fixture, keine Produktionsmetrik)",
  exportNote: "Die Dateien liegen im ETL-Volume unter assets/<scope>/<run>/powerbi, zusammen mit relationships.json, measures.json und evaluation_cases.jsonl. Importanleitung: docs/POWER_BI_EXPORT.md. Keine Power-BI-Anmeldung, kein Dataset, kein API-Aufruf.",
  limitations: "Grenzen",
  details: {
    average_stage_latency_ms: "nur ETL-Schritte; ClamAV- und OCR-Zeit werden vorher gemessen",
    human_correction_rate: "{0} Korrekturen, {1} Beobachtungen",
    ocr_disagreement_rate: "{0} geprüfte Beobachtungen",
    "ocr_disagreement_rate:not-run": "keine geprüfte Beobachtung in diesem Lauf",
    "ocr_disagreement_rate:simulated": "Fixture ocr-misread.sample.json; keine Produktionskennzahl",
    hit_at_k: "k={0}, BM25 über den extrahierten Text",
    abstention_correct_rate: "Fragen ohne Beleg müssen unbeantwortet bleiben",
    estimated_cost_per_document_eur: "lokale Engines haben keine Token-Gebühr",
    prompt_injection_blocked_rate: "Anteil der Felder auf Anweisungsseiten, die nicht ins geprüfte Gold gelangen",
  } as Record<string, string>,
  checks: {
    "every fact row carries tenant and project": "jede Faktenzeile trägt Mandant und Projekt",
    "observation ids are unique": "Beobachtungs-IDs sind eindeutig",
    "reviewed value only on reviewed rows": "geprüfter Wert nur auf geprüften Zeilen",
    "raw value kept on every observation": "Rohwert bleibt in jeder Beobachtung erhalten",
    "page numbers are positive": "Seitenzahlen sind positiv",
    "no full page text in the mart": "kein vollständiger Seitentext im Mart",
    "measurement mode is set": "Messmodus ist gesetzt",
  } as Record<string, string>,
};
const vi: Copy = {
  title: "Data & AI Control Tower",
  intro: "Pipeline, chất lượng dữ liệu, truy xuất và chi phí của một hồ sơ, đọc từ các mart Gold đã duyệt của lần chạy ETL gần nhất. Power BI dùng chính các bảng đã xuất này.",
  back: "Quay lại khu làm việc",
  dossier: "Hồ sơ",
  run: "Lần chạy",
  method: "Pipeline",
  historical: "bản lịch sử",
  areas: {pipeline: "Vận hành pipeline", quality: "Chất lượng dữ liệu tài liệu", rag: "Chất lượng RAG và trích dẫn", cost: "Chi phí AI và so sánh model"},
  badges: {measured: "Đo thật", simulated: "Giả lập", configured: "Chỉ cấu hình", "not-run": "Chưa chạy"},
  rule: "quy tắc trên văn bản của lần chạy này",
  legend: "Nhãn",
  signIn: "Đăng nhập bằng tài khoản lab để đọc các hồ sơ của tenant.",
  loading: "Đang tải…",
  error: "Không tải được dữ liệu hồ sơ. Không có gì bị thay đổi.",
  noRun: "Hồ sơ này chưa có lần chạy ETL nào có mart Control Tower nên chưa có gì để hiển thị. Hãy kiểm duyệt tài liệu trước (chỉ giá trị đã duyệt mới vào Gold), rồi tạo các lớp dữ liệu và tải lại trang này. Chỉ chạy trên stack local.",
  older: "Lần chạy hoàn tất gần nhất được tạo trước khi có mart Control Tower. Hãy tạo lại các lớp dữ liệu rồi tải lại trang này.",
  openPipeline: "Mở Các lớp dữ liệu & bản xuất",
  withData: "Đã có dữ liệu Control Tower ({count})",
  withoutData: "Chưa chạy ETL ({count})",
  openWithData: "Hoặc mở hồ sơ đã có dữ liệu:",
  refresh: "Tải lại",
  charts: {
    stages: "Độ trễ từng bước", stagesNote: "Mili-giây cho mỗi bước ETL của lần chạy này. Thời gian ClamAV và OCR được đo ở bước trước.",
    flow: "Số dòng từ Bronze đến Gold đã duyệt", flowNote: "Mỗi mũi tên hiển thị dòng vào → dòng ra của bước lineage đó.",
    layers: {bronze: "Bronze", silver: "Silver", gold: "Gold đã duyệt"},
    checks: "Kiểm tra chất lượng dữ liệu", checksNote: "Số kiểm tra đạt và không đạt của lần chạy này. Kiểm tra không đạt sẽ dừng lần chạy trước khi publish mart.",
    ragKpis: "Độ đúng truy xuất và trích dẫn", ragNote: "Các ca đánh giá có nhãn. Dấu “—” nghĩa là ca chưa chạy.",
    cost: "Chi phí ước tính theo model", costNote: "Chi phí cấu hình. Engine cục bộ không tính phí theo token.",
    valid: "Quan sát hợp lệ theo model", validNote: "Tỷ lệ quan sát trường của lần chạy này vượt qua kiểm tra hợp lệ.",
    empty: "Lần chạy này chưa có dữ liệu cho biểu đồ này.",
  },
  kpis: {
    success_rate: "Tỷ lệ thành công", average_stage_latency_ms: "Độ trễ trung bình mỗi bước", human_correction_rate: "Tỷ lệ người sửa",
    ocr_disagreement_rate: "Tỷ lệ OCR lệch", citation_document_accuracy: "Trích dẫn đúng tài liệu", citation_page_accuracy: "Trích dẫn đúng trang",
    citation_bbox_accuracy: "Trích dẫn đúng vùng (bounding box)", hit_at_k: "Hit@K", recall_at_k: "Recall@K", mrr: "MRR", abstention_correct_rate: "Từ chối trả lời đúng",
    estimated_cost_per_document_eur: "Chi phí ước tính mỗi tài liệu", prompt_injection_blocked_rate: "Tỷ lệ chặn prompt injection",
  },
  stages: {validate: "Kiểm tra contract", bronze_silver: "Bronze và Silver", dbt_tests: "Test dbt", reviewed_gold: "Gold đã duyệt", analytics: "Phép chiếu phân tích"},
  columns: {stage: "Bước", latency: "Độ trễ", rows: "Số dòng", from: "Từ", to: "Đến", rowsIn: "Dòng vào", rowsOut: "Dòng ra", check: "Kiểm tra", result: "Kết quả",
    document: "Tài liệu", page: "Trang", field: "Trường", raw: "Giá trị thô", normalized: "Giá trị chuẩn hóa", reviewed: "Giá trị đã duyệt", status: "Trạng thái", mode: "Chế độ",
    case: "Ca", expected: "Mong đợi", rank: "Hạng", found: "Tìm thấy", box: "Vùng", value: "Giá trị", provider: "Nhà cung cấp", model: "Model", observations: "Quan sát",
    valid: "Hợp lệ", documents: "Tài liệu", cost: "Chi phí ước tính", pricing: "Cơ sở giá", table: "Bảng"},
  captions: {stages: "Độ trễ từng bước (lần chạy này)", lineage: "Lineage Bronze → Silver → Gold", quality: "Kiểm tra chất lượng dữ liệu", observations: "Quan sát trường dữ liệu",
    retrieval: "Các ca truy xuất", citations: "Các ca trích dẫn", models: "So sánh model (lần chạy này)", cost: "Chi phí", export: "Export sẵn cho Power BI"},
  passed: "Đạt", failed: "Không đạt", abstained: "Đã từ chối",
  drill: {title: "Drill-through", empty: "Chọn một quan sát để theo dõi từ KPI tới giá trị đã duyệt.", kpi: "KPI", document: "Tài liệu", page: "Trang",
    box: "Bounding box", ocr: "Văn bản OCR", normalized: "Giá trị chuẩn hóa", reviewed: "Giá trị đã duyệt", noBox: "Chưa định vị được vùng cho giá trị này", none: "Chưa duyệt"},
  simulated: "Giả lập (fixture, không phải số liệu vận hành)",
  exportNote: "Các file nằm trong volume ETL tại assets/<scope>/<run>/powerbi, kèm relationships.json, measures.json và evaluation_cases.jsonl. Hướng dẫn import: docs/POWER_BI_EXPORT.md. Không đăng nhập Power BI, không publish dataset, không gọi API.",
  limitations: "Giới hạn",
  details: {
    average_stage_latency_ms: "chỉ các bước ETL; thời gian ClamAV và OCR được đo ở bước trước",
    human_correction_rate: "{0} lần sửa, {1} quan sát",
    ocr_disagreement_rate: "{0} quan sát đã duyệt",
    "ocr_disagreement_rate:not-run": "lần chạy này chưa có quan sát nào được duyệt",
    "ocr_disagreement_rate:simulated": "fixture ocr-misread.sample.json; không phải số liệu vận hành thật",
    hit_at_k: "k={0}, BM25 trên văn bản đã trích xuất",
    abstention_correct_rate: "câu hỏi không có bằng chứng phải được để trống",
    estimated_cost_per_document_eur: "engine cục bộ không tính phí theo token",
    prompt_injection_blocked_rate: "tỷ lệ trường trên trang chứa chỉ dẫn bị giữ ngoài Gold đã duyệt",
  } as Record<string, string>,
  checks: {
    "every fact row carries tenant and project": "mọi dòng fact đều có tenant và dự án",
    "observation ids are unique": "ID quan sát là duy nhất",
    "reviewed value only on reviewed rows": "giá trị đã duyệt chỉ có ở dòng đã duyệt",
    "raw value kept on every observation": "giá trị gốc được giữ ở mọi quan sát",
    "page numbers are positive": "số trang là số dương",
    "no full page text in the mart": "không có toàn văn trang trong mart",
    "measurement mode is set": "chế độ đo đã được ghi",
  } as Record<string, string>,
};
export const controlTowerTexts = {en, de, vi};
export function controlTowerText(locale: string): Copy {
  return controlTowerTexts[locale === "vi" ? "vi" : locale === "de" ? "de" : "en"];
}
