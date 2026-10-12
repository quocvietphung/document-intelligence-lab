import {describe,expect,it} from "vitest";
import {languageTables} from "./workspace-language";
describe("workspace translations",()=>{
  it("keeps English, German and Vietnamese complete and non-empty",()=>{
    const reference=Object.keys(languageTables.en).sort();
    for(const table of [languageTables.de,languageTables.vi]) {
      expect(Object.keys(table).sort()).toEqual(reference);
      expect(Object.values(table).every(value=>value.trim().length>0)).toBe(true);
    }
  });
});
