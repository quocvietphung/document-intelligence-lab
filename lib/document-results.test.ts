import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {readFileSync} from "node:fs";
import {describe,expect,it,vi} from "vitest";
import type {CreditDocument} from "./credit-data";
import hashes from "@/services/credit-api/src/main/resources/datev-reference-hashes.json";
import {activeDocumentJob,completedJobDocument,documentJobLabel,documentReceiptSchema,documentUi,documentUiTables,latestDocumentJobs,orderedResultDocuments,sampleDocumentJob,type DocumentJob} from "./document-results";
import {DocumentRecognitionDetails,DocumentProcessingCard,DocumentResultCard,DocumentResults} from "@/components/workspace/DocumentResults";
import {PayrollSamples} from "@/components/workspace/PayrollSamples";

vi.mock("@/components/auth/KeycloakProvider",()=>({useAuth:()=>({mode:"keycloak",token:"synthetic-test-token"})}));
const name="datev-lodas-2025-robert-muster.pdf";
const doc:CreditDocument={id:"doc-robert",name,type:"income",status:"review",originalAvailable:true,analysisProvider:"azure-document-intelligence",modelId:"prebuilt-layout",confidence:97,fields:[{label:"netIncome",value:"2.967,11 EUR",confidence:97},{label:"payoutAmount",value:"2.882,11 EUR",confidence:95}],tables:[]};
const job:DocumentJob={id:"job-new",name,status:"COMPLETE",stage:"HUMAN_REVIEW",document_id:doc.id,scan_result:"CLEAN",error_code:null,sha256:hashes[name],createdAt:"2026-10-13T13:06:00Z",expiresAt:"2030-01-01T00:00:00Z",attempt:1};
const old:DocumentJob={...job,id:"job-old",status:"FAILED",stage:"STOPPED",document_id:null,error_code:"ANALYSIS_HTTP_503",createdAt:"2026-10-12T22:18:00Z",attempt:3};
const open=()=>{};
describe("document analysis results journey",()=>{
  it("keeps EN, DE and VI complete with meaningful labels",()=>{
    for(const table of Object.values(documentUiTables)){expect(Object.keys(table).sort()).toEqual(Object.keys(documentUiTables.en).sort());expect(Object.values(table).every(value=>value.trim())).toBe(true);}
    expect(documentUi("unknown")).toEqual(documentUiTables.en);
  });
  it("accepts only a real queued receipt, not a fabricated completion",()=>{
    expect(documentReceiptSchema.safeParse({id:"job-real",status:"QUEUED",expiresAt:"2030-01-01T00:00:00Z"}).success).toBe(true);
    for(const value of [{id:"",status:"QUEUED",expiresAt:"bad"},{id:"j",status:"COMPLETE",expiresAt:job.expiresAt},{id:"j",status:"QUEUED"}])expect(documentReceiptSchema.safeParse(value).success).toBe(false);
  });
  it("uses a newer job for the same digest without deleting the old failure",()=>{
    const input=[old,job],original=input.map(item=>item.id);
    expect(latestDocumentJobs(input)).toEqual([job]);expect(input.map(item=>item.id)).toEqual(original);expect(old.status).toBe("FAILED");
  });
  it("does not confuse different bytes with identical names or missing hashes",()=>{
    const changed={...job,id:"changed",sha256:"a".repeat(64)};
    expect(latestDocumentJobs([job,changed])).toHaveLength(2);
    expect(latestDocumentJobs([{...job,id:"a",sha256:""},{...job,id:"b",sha256:""}])).toHaveLength(2);
    expect(sampleDocumentJob(name,[changed])).toBeUndefined();expect(sampleDocumentJob(name,[old,job])?.id).toBe(job.id);
  });
  it("never turns a newer retry or failure into a successful result",()=>{
    const failed={...old,createdAt:"2026-10-14T00:00:00Z"};
    expect(sampleDocumentJob(name,[job,failed])?.status).toBe("FAILED");
    expect(completedJobDocument(failed,[doc])).toBeUndefined();
    for(const status of ["QUEUED","PROCESSING","RETRY","FAILED","EXPIRED"])expect(completedJobDocument({...job,status},[doc])).toBeUndefined();
  });
  it("opens only the matching available document before expiry",()=>{
    expect(completedJobDocument(job,[doc])?.id).toBe(doc.id);
    expect(completedJobDocument(job,[{...doc,id:"another"}])).toBeUndefined();
    expect(completedJobDocument(job,[{...doc,originalAvailable:false}])).toBeUndefined();
    expect(completedJobDocument({...job,expiresAt:"2000-01-01T00:00:00Z"},[doc])).toBeUndefined();
    expect(completedJobDocument({...job,expiresAt:"bad"},[doc])).toBeUndefined();
    expect(completedJobDocument(job,[{...doc,status:"missing"}])).toBeUndefined();
  });
  it("orders the newly completed result before older records without mutation",()=>{
    const olderDoc={...doc,id:"older"},other={...doc,id:"other",name:"another.pdf"},input=[olderDoc,other,doc];
    expect(orderedResultDocuments(input,[job]).map(row=>row.id)).toEqual([doc.id,other.id,olderDoc.id]);
    expect(input[0].id).toBe("older");
  });
  it("distinguishes scan, extraction, save, retry, failure and pending attachment",()=>{
    expect(documentJobLabel({...job,status:"PROCESSING",stage:"SCAN"},"vi")).toBe(documentUi("vi").scanning);
    expect(documentJobLabel({...job,status:"PROCESSING",stage:"EXTRACT"},"vi")).toBe(documentUi("vi").extracting);
    expect(documentJobLabel({...job,status:"PROCESSING",stage:"ATTACH"},"vi")).toBe(documentUi("vi").attaching);
    expect(documentJobLabel(old,"vi")).toBe(documentUi("vi").failed);
    expect(documentJobLabel(job,"vi")).toBe(documentUi("vi").waiting);
    expect(activeDocumentJob({...job,status:"RETRY"})).toBe(true);expect(activeDocumentJob(job)).toBe(false);
  });
  it("shows full filenames, extracted values and a direct result button, not OCR percentages",()=>{
    const html=renderToStaticMarkup(createElement(DocumentResultCard,{doc,locale:"vi",open}));
    expect(html).toContain(name);expect(html).not.toContain("truncate");expect(html).toContain("Xem kết quả &amp; PDF");
    expect(html).toContain("2.967,11 EUR");expect(html).toContain("2.882,11 EUR");expect(html).not.toContain("97%");
    expect(html).toContain("cần kiểm duyệt");expect(html).not.toContain("Đã được người kiểm duyệt xác nhận");
  });
  it("keeps fixture/reference data visibly separate from Azure extraction",()=>{
    const html=renderToStaticMarkup(createElement(DocumentResultCard,{doc:{...doc,analysisProvider:"datev-reference-values",originalAvailable:false,confidence:null},locale:"vi",open}));
    expect(html).toContain("không phải AI trích xuất");expect(html).not.toContain("Azure Document Intelligence");
  });
  it("keeps OCR details collapsed and explicitly disclaims accuracy",()=>{
    const html=renderToStaticMarkup(createElement(DocumentRecognitionDetails,{doc,locale:"vi"}));
    expect(html).toContain("97%");expect(html).toContain("không phải phần trăm chính xác đã kiểm chứng");expect(html).not.toContain('open=""');
    expect(renderToStaticMarkup(createElement(DocumentRecognitionDetails,{doc:{...doc,confidence:null},locale:"vi"}))).toContain(documentUi("vi").unknown);
    expect(renderToStaticMarkup(createElement(DocumentRecognitionDetails,{doc:{...doc,confidence:0},locale:"vi"}))).toContain("0%");
  });
  it("does not offer a result link before a processing job is attached",()=>{
    const html=renderToStaticMarkup(createElement(DocumentProcessingCard,{job:{...job,status:"QUEUED",document_id:null},locale:"vi",open,technical:()=>{}}));
    expect(html).toContain("Đã xếp hàng");expect(html).not.toContain("Xem kết quả &amp; PDF");
  });
  it("retains older same-name results behind explicit history without conflating their bytes",()=>{
    const html=renderToStaticMarkup(createElement(DocumentResults,{documents:[doc,{...doc,id:"old-doc"}],jobs:[],locale:"vi",loading:false,error:false,refresh:()=>{},open,ask:()=>{},choose:()=>{},technical:()=>{}}));
    expect(html).toContain("document-result-doc-robert");expect(html).toContain("document-result-old-doc");
    expect(html).toContain("không đồng nghĩa nội dung tệp giống nhau");expect(html).toContain('data-page-tour="documents-list"');
  });
  it("offers an existing result even to readers without import permission",()=>{
    const html=renderToStaticMarkup(createElement(PayrollSamples,{locale:"vi",busy:false,canImport:false,importSample:async()=>{},jobs:[job,old],documents:[doc],openResult:open}));
    expect(html).toContain("Xem kết quả đã có");expect(html).toContain("không cần nhập lại");
    expect(html).toContain('class="payroll-reference-values"');
  });
  it("keeps result status refreshing on the documents page with scoped cancellable reads",()=>{
    const source=readFileSync("components/workspace/DocumentAnalysisWorkspace.tsx","utf8");
    expect(source).toContain("data.caseId!==caseId");expect(source).toContain("controller.abort()");expect(source).toContain("3500");
    expect(source.indexOf("<DocumentResults")).toBeLessThan(source.indexOf("<PayrollSamples"));
    expect(source).not.toContain('navigate("pipeline")');
    const parent=readFileSync("components/workspace/CreditWorkspace.tsx","utf8");
    expect(parent).toContain('queued.status===409');expect(parent).toContain('return documentReceiptSchema.parse');expect(parent).not.toContain('className="document-row"');
  });
  it("uses a narrow mobile launcher column instead of covering document-action labels",()=>{
    const css=readFileSync("app/globals.css","utf8");
    expect(css).toContain(".workspace-shell:has(#document-analysis-results) .nova-launcher-row{flex-direction:column");
    expect(css).toContain(".workspace-shell:has(#document-analysis-results) .nova-chat-launcher{width:44px");
  });
});
