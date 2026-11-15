import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";
import {CheckChart, CostChart, FlowChart, KpiChart, ModelChart, StageChart} from "@/components/workspace/ControlTowerCharts";
import {controlTowerText, type ControlTower} from "./control-tower";
import {barPercent, chartableKpis, donutDash, layerLink, maxOf, tallyChecks, validShare} from "./control-tower-charts";

const tower: ControlTower = {
  schemaVersion: "control-tower-v1", partition: {tenantKey: "d".repeat(16), projectId: "CR-1"}, rowCounts: {bronze: 4, silver: 12, reviewedGold: 2},
  lineage: [
    {from: "bronze_documents", to: "silver_fields", rowsIn: 4, rowsOut: 12},
    {from: "silver_fields", to: "gold_currency_totals", rowsIn: 12, rowsOut: 2},
  ],
  dataQuality: [{check: "page numbers are positive", passed: true, detail: ""}, {check: "observation ids are unique", passed: true, detail: ""}, {check: "raw value kept on every observation", passed: false, detail: "1 row"}],
  kpis: [
    {key: "human_correction_rate", value: 0.25, mode: "measured", unit: "ratio", detail: "1 corrections, 4 observations"},
    {key: "ocr_disagreement_rate", value: null, mode: "not-run", unit: "ratio", detail: "no reviewed observation in this run"},
    {key: "hit_at_k", value: 0.5, mode: "deterministic", unit: "ratio", detail: "k=5, BM25 over extracted text"},
    {key: "mrr", value: 1, mode: "deterministic", unit: "ratio", detail: "k=5"},
    {key: "estimated_cost_per_document_eur", value: 0, mode: "configured", unit: "EUR", detail: "local engines carry no per-token fee"},
  ],
  simulatedKpis: [{key: "ocr_disagreement_rate", value: 1, mode: "simulated", unit: "ratio", detail: "fixture ocr-misread.sample.json"}],
  stages: [
    {stage: "validate", latencyMs: 2, rows: 4, mode: "measured"},
    {stage: "reviewed_gold", latencyMs: 8, rows: 2, mode: "measured"},
  ],
  retrieval: [
    {case: "q1", retriever: "bm25", k: 5, expected: "doc p. 2", rank: 1, passed: true, expectedAbstain: false, abstained: null, mode: "deterministic"},
    {case: "q2", retriever: "bm25", k: 5, expected: null, rank: null, passed: null, expectedAbstain: true, abstained: null, mode: "not-run"},
  ],
  citations: [{case: "c1", value: "48.780,00", expected: "doc p. 2", found: "doc p. 2", boundingBox: "[0.1, 0.5, 0.9, 0.53]", documentMatch: true, pageMatch: true, bboxMatch: false, mode: "deterministic"}],
  models: [{provider: "docling", model: "docling-2", observations: 4, valid: 3, reviewed: 4}],
  cost: [{provider: "local", model: "qwen3", documents: 4, estimatedCost: 0, currency: "EUR", pricing: "local engine", mode: "configured"}],
  drill: [], corrections: 1, export: [], limitations: [],
};

const empty: ControlTower = {...tower, dataQuality: [], retrieval: [], citations: [], cost: [], models: [], stages: []};

describe("Control Tower chart data", () => {
  it("turns values into bar lengths that never pass 100%", () => {
    expect(barPercent(2, 8)).toBe(25);
    expect(barPercent(0.5, 1)).toBe(50);
    expect(barPercent(9, 8)).toBe(100);
    expect(barPercent(0, 8)).toBe(0);
    expect(barPercent(null, 8)).toBe(0);
    expect(barPercent(3, 0)).toBe(0);
    expect(maxOf([null, 3, -1, 7])).toBe(7);
    expect(maxOf([])).toBe(0);
  });

  it("tallies the checks and gives the donut its arc", () => {
    expect(tallyChecks(tower.dataQuality)).toEqual({passed: 2, failed: 1});
    expect(donutDash(2, 1)).toBe("66.7 33.3");
    expect(donutDash(0, 0)).toBe("0 100");
  });

  it("keeps simulated values out of KPI charts and keeps the order of the keys", () => {
    const kpis = [...tower.kpis, {key: "prompt_injection_blocked_rate", value: 1, mode: "simulated" as const, unit: "ratio", detail: "fixture"}];
    expect(chartableKpis(kpis, ["prompt_injection_blocked_rate", "hit_at_k", "missing"]).map((kpi) => kpi.key)).toEqual(["hit_at_k"]);
    expect(chartableKpis(tower.kpis, ["mrr", "hit_at_k"]).map((kpi) => kpi.key)).toEqual(["mrr", "hit_at_k"]);
  });

  it("finds the lineage step between two layers and the valid share of a model", () => {
    expect(layerLink(tower.lineage, "bronze", "silver")?.rowsOut).toBe(12);
    expect(layerLink(tower.lineage, "gold", "bronze")).toBeNull();
    expect(validShare({observations: 4, valid: 3})).toBe(0.75);
    expect(validShare({observations: 0, valid: 0})).toBeNull();
  });
});

describe("Control Tower charts", () => {
  const en = controlTowerText("en");

  it("draws stage bars against the slowest step, with its rows, in the page language", () => {
    const markup = renderToStaticMarkup(createElement(StageChart, {tower, t: en, locale: "en"}));
    expect(markup).toContain("width:100%");
    expect(markup).toContain("width:25%");
    expect(markup).toContain("Reviewed Gold");
    expect(markup).toContain("8 ms");
    expect(markup).toContain("Rows: 4");
  });

  it("shows the rows of each layer with the lineage step between them", () => {
    const markup = renderToStaticMarkup(createElement(FlowChart, {tower, t: en, locale: "en"}));
    expect(markup).toContain("4 → 12");
    expect(markup).toContain("12 → 2");
    expect(markup).toContain("Silver");
  });

  it("lists each data-quality check with its result and draws the counts as a donut", () => {
    const markup = renderToStaticMarkup(createElement(CheckChart, {tower, t: en}));
    expect(markup).toContain("2/3");
    expect(markup).toContain('stroke-dasharray="66.7 33.3"');
    expect(markup).toContain("raw value kept on every observation");
    expect(markup).toContain("1 row");
    expect(markup).toContain("Failed");
  });

  it("draws ratio KPIs with their detail and marks a KPI that has not run with a dash", () => {
    const rates = renderToStaticMarkup(createElement(KpiChart, {
      tower, keys: ["ocr_disagreement_rate", "human_correction_rate", "hit_at_k"], id: "ct-test-rates", title: "Rates", note: "note", t: en, locale: "en",
    }));
    expect(rates).toContain("width:25%");
    expect(rates).toContain("width:50%");
    expect(rates).toContain("width:0%");
    expect(rates).toContain("—");
    expect(rates).toContain("k=5");
    expect(rates).toContain("Measured");
    expect(rates).not.toContain("100%");
  });

  it("shows configured cost with its badge and keeps local engines at zero", () => {
    const markup = renderToStaticMarkup(createElement(CostChart, {tower, t: en, locale: "en"}));
    expect(markup).toContain("Configured only");
    expect(markup).toContain("€0.00");
    expect(markup).toContain("width:0%");
  });

  it("shows valid observations per model", () => {
    const markup = renderToStaticMarkup(createElement(ModelChart, {tower, t: en}));
    expect(markup).toContain("3/4");
    expect(markup).toContain("width:75%");
  });

  it("explains an empty chart in every language and never prints undefined or NaN", () => {
    for (const locale of ["en", "de", "vi"]) {
      const t = controlTowerText(locale);
      const full = [
        renderToStaticMarkup(createElement(StageChart, {tower, t, locale})),
        renderToStaticMarkup(createElement(FlowChart, {tower, t, locale})),
        renderToStaticMarkup(createElement(CheckChart, {tower, t})),
        renderToStaticMarkup(createElement(KpiChart, {tower, keys: ["hit_at_k", "ocr_disagreement_rate"], id: "ct-test-x", title: "x", note: "x", t, locale})),
        renderToStaticMarkup(createElement(CostChart, {tower, t, locale})),
        renderToStaticMarkup(createElement(ModelChart, {tower, t})),
      ].join("");
      expect(full, locale).not.toMatch(/undefined|NaN/);
      expect(renderToStaticMarkup(createElement(CheckChart, {tower: empty, t})), locale).toContain(t.charts.empty);
      expect(renderToStaticMarkup(createElement(KpiChart, {tower, keys: [], id: "ct-test-y", title: "y", note: "y", t, locale})), locale).toContain(t.charts.empty);
      expect(renderToStaticMarkup(createElement(CostChart, {tower: empty, t, locale})), locale).toContain(t.charts.empty);
      expect(renderToStaticMarkup(createElement(ModelChart, {tower: empty, t})), locale).toContain(t.charts.empty);
    }
  });
});
