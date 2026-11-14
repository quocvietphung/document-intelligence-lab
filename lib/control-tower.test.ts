import {describe, expect, it} from "vitest";
import {areaKpis, badgeOf, controlTowerTexts, formatKpi, kpiDetail, latestControlTower, parseBox, type ControlTower} from "./control-tower";

const tower: ControlTower = {
  schemaVersion: "control-tower-v1", partition: {tenantKey: "d".repeat(16), projectId: "CR-1"}, rowCounts: {bronze: 4, silver: 2, reviewedGold: 2},
  lineage: [{from: "bronze_documents", to: "silver_fields", rowsIn: 4, rowsOut: 2}], dataQuality: [{check: "observation ids are unique", passed: true, detail: ""}],
  kpis: [{key: "hit_at_k", value: 1, mode: "deterministic", unit: "ratio", detail: "k=5"}, {key: "estimated_cost_per_document_eur", value: 0, mode: "configured", unit: "EUR", detail: ""}],
  simulatedKpis: [{key: "ocr_disagreement_rate", value: 1, mode: "simulated", unit: "ratio", detail: "fixture"}],
  stages: [{stage: "validate", latencyMs: 0.2, rows: 4, mode: "measured"}], retrieval: [], citations: [], models: [], cost: [],
  drill: [{observationId: "o1", documentId: "doc-nachtrag", documentName: "nachtrag-n01-wv-2026-031.pdf", page: 2, boundingBox: "[0.1, 0.5, 0.9, 0.53]",
    bboxSource: "provider-region-value-match", ocrText: "Genehmigte Gesamtvergütung: 48.780,00 EUR brutto", field: "approvedTotal", provider: "docling", model: "docling-2",
    rawValue: "48.780,00 EUR", normalizedValue: "48780.00 EUR", reviewedValue: "48.780,00 EUR", reviewStatus: "reviewed", quality: "VALID", mode: "measured"}],
  corrections: 1, export: [{table: "fact_ai_run", rows: 1, csv: "powerbi/fact_ai_run.csv", parquet: "powerbi/fact_ai_run.parquet"}], limitations: ["x"],
};

describe("Control Tower data", () => {
  it("takes the newest completed run that carries marts and reports older runs honestly", () => {
    const body = {runs: [
      {id: "etl-old", time: "2026-11-13T10:00:00Z", status: "COMPLETE", current: false, result: {method: "document-medallion-v3"}},
      {id: "etl-new", time: "2026-11-14T10:00:00Z", status: "COMPLETE", current: true, result: {method: "document-medallion-v3", controlTower: tower}},
      {id: "etl-queued", time: "2026-11-14T11:00:00Z", status: "QUEUED", current: true},
    ]};
    const loaded = latestControlTower(body);
    expect(loaded.state).toBe("ready");
    if (loaded.state === "ready") expect(loaded.run.id).toBe("etl-new");
    expect(latestControlTower({runs: [body.runs[0]]}).state).toBe("older");
    expect(latestControlTower({runs: []}).state).toBe("none");
    expect(latestControlTower({nope: true}).state).toBe("none");
  });

  it("keeps simulated and configured values apart from measured ones", () => {
    expect(badgeOf("deterministic")).toBe("measured");
    expect(badgeOf("simulated")).toBe("simulated");
    expect(badgeOf("configured")).toBe("configured");
    expect(Object.values(areaKpis).flat()).not.toContain("simulated");
  });

  it("formats ratios, costs and latency per locale and validates bounding boxes", () => {
    expect(formatKpi(1, "ratio", "en")).toBe("100%");
    expect(formatKpi(0.5, "ratio", "de")).toMatch(/50\s?%/);
    expect(formatKpi(0, "EUR", "en")).toContain("€");
    expect(formatKpi(null, "ratio", "en")).toBe("—");
    expect(parseBox("[0.1, 0.5, 0.9, 0.53]")).toEqual([0.1, 0.5, 0.9, 0.53]);
    expect(parseBox("[2, 0, 0, 0]")).toBeNull();
    expect(parseBox("nonsense")).toBeNull();
  });

  it("words KPI details in the page language and keeps the numbers of the run", () => {
    const corrections = {key: "human_correction_rate", mode: "measured", detail: "0 corrections, 17 observations"};
    expect(kpiDetail(corrections, controlTowerTexts.vi.details)).toBe("0 lần sửa, 17 quan sát");
    expect(kpiDetail(corrections, controlTowerTexts.de.details)).toBe("0 Korrekturen, 17 Beobachtungen");
    expect(kpiDetail({key: "ocr_disagreement_rate", mode: "not-run", detail: "no reviewed observation in this run"}, controlTowerTexts.de.details))
      .toBe("keine geprüfte Beobachtung in diesem Lauf");
    expect(kpiDetail({key: "hit_at_k", mode: "deterministic", detail: "k=5, BM25 over extracted text"}, controlTowerTexts.vi.details)).toContain("k=5");
    expect(kpiDetail({key: "new_kpi", mode: "measured", detail: "from the ETL"}, controlTowerTexts.vi.details)).toBe("from the ETL");
    expect(kpiDetail({key: "human_correction_rate", mode: "measured", detail: "changed wording"}, controlTowerTexts.vi.details)).toBe("changed wording");
  });

  it("has the same text keys in English, German and Vietnamese", () => {
    const shape = (value: unknown): unknown => value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, shape(entry)])) : typeof value;
    expect(shape(controlTowerTexts.de)).toEqual(shape(controlTowerTexts.en));
    expect(shape(controlTowerTexts.vi)).toEqual(shape(controlTowerTexts.en));
    for (const text of Object.values(controlTowerTexts)) for (const key of Object.values(areaKpis).flat()) expect(text.kpis[key], key).toBeTruthy();
  });
});
