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
      const bytes=readFileSync(`public/demo/${sample.file}`);
      expect(bytes.subarray(0,4).toString()).toBe("%PDF");expect(bytes.length).toBeLessThan(3_000_000);
      expect(documentLanguageTables.en[sample.id]).toBeTruthy();
    }
  });
});
