import {describe, expect, it} from "vitest";
import {ai103Text, ai103Texts, decisionCriteria, fill} from "./language";
import {capabilityIds, manifest, statuses} from "./model";

const shape = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.length ? ["array", shape(value[0])] : ["array"];
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, shape(entry)]));
  return typeof value;
};

describe("AI-103 lab texts", () => {
  it("have the same keys in English, German and Vietnamese", () => {
    expect(shape(ai103Texts.de)).toEqual(shape(ai103Texts.en));
    expect(shape(ai103Texts.vi)).toEqual(shape(ai103Texts.en));
  });

  it("cover every capability, status, part and decision in each language", () => {
    const parts = new Set(manifest.capabilities.flatMap((capability) => capability.parts?.map((part) => part.name) ?? []));
    for (const text of Object.values(ai103Texts)) {
      for (const id of capabilityIds) {
        const copy = text.capabilities[id];
        expect([copy.name, copy.useCase, copy.pipeline, copy.localEquivalent, copy.input, copy.azureImplementation].every((value) => value.trim().length > 0), id).toBe(true);
        expect(copy.limits.length, id).toBeGreaterThan(0);
      }
      for (const status of statuses) expect(text.statuses[status]).toBeTruthy();
      for (const part of parts) expect(text.parts[part], part).toBeTruthy();
      expect(text.decision.rows).toHaveLength(6);
      for (const row of text.decision.rows) for (const criterion of decisionCriteria) expect(row[criterion].trim()).not.toBe("");
    }
    expect(ai103Text("fr")).toBe(ai103Texts.en);
  });

  it("state that the counts are capabilities, not live services", () => {
    expect(ai103Texts.en.kpiNote).toBe("Capability count, not the number of live Azure services or model calls.");
    expect(ai103Texts.en.kpi).toEqual({
      "local-real-deterministic": "Local real/deterministic",
      "local-mock-configured": "Local mock/configured",
      "azure-ready": "Azure ready",
      "azure-verified": "Azure verified",
    });
  });

  it("make no unproven claims", () => {
    const all = JSON.stringify(ai103Texts);
    for (const banned of [/production[- ]ready/i, /hoàn hảo/i, /\bperfect\b/i, /AI-powered/i, /KI-gestützt/i, /fully verified/i]) expect(all).not.toMatch(banned);
    // Confidence and retrieval ranks are never called accuracy.
    expect(all).not.toMatch(/accuracy (of|for) (OCR|hit@|citation)/i);
  });

  it("fills placeholders and leaves unknown ones visible", () => {
    expect(fill("{shown} of {total}", {shown: 3, total: 18})).toBe("3 of 18");
    expect(fill("{missing}", {})).toBe("{missing}");
  });
});
