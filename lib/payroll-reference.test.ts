import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {existsSync} from "node:fs";
import {PayrollReferenceNotice} from "@/components/workspace/PayrollReferenceNotice";
import {datevReferences,officialPayrollReference,hasOnlyDatevPayroll,legacyPayroll} from "./datev-reference";
import {publicDemoCase} from "./public-demo";
import {syntheticPayrollFixtures} from "./document-language";
describe("DATEV-only user-facing payroll examples",()=>{
  it("keeps homemade PDFs outside public assets",()=>{
    for(const sample of [...syntheticPayrollFixtures,{file:"synthetic-payroll.pdf"}]){
      expect(existsSync(`public/demo/${sample.file}`)).toBe(false);
      expect(existsSync(`services/credit-api/src/test/resources/legacy-payroll/${sample.file}`)).toBe(true);
    }
  });
  it("uses the publisher catalog for every demo payroll",()=>{
    const payroll=publicDemoCase.documents.filter(doc=>doc.type==="income");
    expect(payroll).toHaveLength(datevReferences.length);
    expect(payroll.map(doc=>doc.name)).toEqual(datevReferences.map(row=>row.file));
  });
  it("prefers a DATEV-only case and distinguishes old evidence without deleting it",()=>{
    expect(hasOnlyDatevPayroll(publicDemoCase)).toBe(true);
    const old={name:"original.pdf",type:"income",status:"review"};
    expect(legacyPayroll(old)).toBe(true);
    expect(hasOnlyDatevPayroll({documents:[...publicDemoCase.documents,old]})).toBe(false);
    expect(hasOnlyDatevPayroll({documents:[]})).toBe(false);
    expect(legacyPayroll({name:datevReferences[0].file,type:"income",status:"review"})).toBe(false);
  });
  it("does not relabel an existing user's original as a DATEV sample",()=>{
    const html=renderToStaticMarkup(createElement(PayrollReferenceNotice,{locale:"en",doc:{id:"old",name:"user.pdf",type:"income",status:"review",originalAvailable:true}}));
    expect(html).toContain("not one of the two official DATEV library samples");
    expect(html).toContain("not relabelled as DATEV");
    expect(html).not.toContain(officialPayrollReference);
  });
  it("distinguishes reference values from extraction and links the publisher",()=>{
    const html=renderToStaticMarkup(createElement(PayrollReferenceNotice,{locale:"en",doc:publicDemoCase.documents[0]}));
    expect(html).toContain("not OCR/AI output");
    expect(html).toContain(officialPayrollReference+"#page=2");
    expect(html).toContain("not the demo applicants");
  });
});
