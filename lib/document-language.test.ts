import {describe,it,expect} from "vitest";
import {documentLanguageTables,syntheticPayrollFixtures} from "./document-language";
import {readFileSync} from "node:fs";
describe("document samples and translations",()=>{
  it("keeps English, German and Vietnamese complete",()=>{
    for(const table of Object.values(documentLanguageTables)) {
      expect(Object.keys(table).sort()).toEqual(Object.keys(documentLanguageTables.en).sort());
      expect(Object.values(table).every(value=>value.trim())).toBe(true);
    }
  });
  it("preserves three bounded synthetic regression PDFs (not DATEV)",()=>{
    expect(syntheticPayrollFixtures).toHaveLength(3);
    for(const sample of syntheticPayrollFixtures) {
      const bytes=readFileSync(`services/credit-api/src/test/resources/legacy-payroll/${sample.file}`);
      expect(bytes.subarray(0,4).toString()).toBe("%PDF");expect(bytes.length).toBeLessThan(3_000_000);
      expect(documentLanguageTables.en[sample.id]).toBeTruthy();
    }
  });
  it("offers only official DATEV reference names in the public demo, with no original or fake OCR",async()=>{
    const {publicDemoCase}=await import("./public-demo");
    const {datevReference}=await import("./datev-reference");
    for(const doc of publicDemoCase.documents.filter(doc=>doc.type==="income")) {
      expect(datevReference(doc.name)).toBeDefined();
      expect(doc.analysisProvider).toBe("datev-reference-values");
      expect(doc.originalAvailable).toBe(false);
      expect(doc.fields?.some(field=>field.label==="payoutAmount")).toBe(true);
    }
  });
});
