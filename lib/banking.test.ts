import {describe,it,expect} from "vitest";
import {accountBalance,bankMoney,bankingSchema,transactionCsv} from "./banking";
import {bankingLanguageTables} from "./banking-language";
describe("synthetic banking",()=>{
  it("keeps all three languages complete",()=>{
    for(const table of Object.values(bankingLanguageTables)) {
      expect(Object.keys(table).sort()).toEqual(Object.keys(bankingLanguageTables.en).sort());
      expect(Object.values(table).every(v=>v.trim().length>0)).toBe(true);
    }
  });
  it("calculates balances in cents and rejects unknown account",()=>{
    const data=bankingSchema.parse({caseId:"C",tenantId:"T",synthetic:true,persistent:true,version:0,accounts:[{id:"a",label:"practice",maskedReference:"DEMO",openingCents:10000,currency:"EUR"}],transactions:[{id:"t",accountId:"a",date:"2026-10-01",counterparty:"Example",reference:"Test",category:"RENT",amountCents:-1001,invoiceId:""}],beneficiaries:[],invoices:[],payments:[],events:[]});
    expect(accountBalance(data,"a")).toBe(8999);
    expect(()=>accountBalance(data,"foreign")).toThrow();
    expect(bankMoney(8999,"en")).toContain("89.99");
  });
  it("rejects non-synthetic API responses",()=>{
    expect(bankingSchema.safeParse({synthetic:false}).success).toBe(false);
  });
  it("escapes CSV quotes and formula-like text",()=>{
    const csv=transactionCsv([{id:"t",accountId:"a",date:"2026-10-01",counterparty:'=HYPERLINK("bad")',reference:"test",category:"RENT",amountCents:-1001,invoiceId:""}]);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"-10.01"');
  });
});
