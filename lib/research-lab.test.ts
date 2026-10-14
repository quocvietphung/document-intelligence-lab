import {afterEach,describe,expect,it,vi} from "vitest";
import {researchCatalogSchema,researchRunSchema,researchExport,researchFailureCount,researchSuites} from "./research-lab";
import {researchLanguages,researchText} from "./research-language";
import {proxyCase} from "./case-proxy";
const run={
 id:"research-test",time:"2026-10-14T12:00:00Z",suite:"DOCUMENTS",version:"banking-research-v1",datasetVersion:"synthetic-text-v2",datasetHash:"a".repeat(64),implementationHash:"b".repeat(64),caseId:"C",caseVersion:0,configuration:{semantic:false},
 variants:[{method:"text-label-rules",engine:"Java",metrics:{f1:80},samples:2,passed:1,durationMs:5,rows:[{id:"P01",scenario:"correct",passed:true,expected:{netIncome:"100 EUR"},actual:{netIncome:"100 EUR"},error:""},{id:"P02",scenario:"missing",passed:false,expected:{netIncome:"100 EUR"},actual:{},error:""}]}],
 durationMs:10,azureCalls:0,costStatus:"not measured",scope:"synthetic only",
};
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe("banking AI research",()=>{
 it("has four suites and full locale parity",()=>{
   expect(researchSuites).toHaveLength(4);
   for(const copy of Object.values(researchLanguages)){
     expect(Object.keys(copy).sort()).toEqual(Object.keys(researchLanguages.en).sort());
     for(const suite of researchSuites)expect(copy[suite]).toBeTruthy();
     expect(copy.note).toBeTruthy();
   }
   expect(researchText("unknown")).toBe(researchLanguages.en);
 });
 it("requires measured metrics and explicitly zero external calls",()=>{
   expect(researchRunSchema.parse(run).variants[0].metrics.f1).toBe(80);
   expect(researchRunSchema.safeParse({...run,azureCalls:1}).success).toBe(false);
   expect(researchRunSchema.safeParse({...run,variants:[{...run.variants[0],metrics:{f1:101}}]}).success).toBe(false);
   expect(researchRunSchema.safeParse({...run,implementationHash:undefined}).success).toBe(false);
 });
 it("exports results without dropping failures or copying actor identity",()=>{
   const checked=researchRunSchema.parse({...run,actor:"private-subject",accessToken:"must-not-export"});
   const exported=JSON.parse(researchExport(checked));
   expect(exported.format).toBe("credit-intelligence-research-v1");
   expect(exported.actor).toBeUndefined();expect(exported.accessToken).toBeUndefined();
   expect(researchFailureCount(checked)).toBe(1);
   expect(researchCatalogSchema.parse({version:run.version,datasetHash:run.datasetHash,references:40,persistent:true,configuration:{},runs:[run],azureCalls:0}).runs).toHaveLength(1);
 });
 it("only forwards authenticated GET and POST experiment requests",async()=>{
   vi.stubEnv("CREDIT_API_URL","http://java:8080");
   const mock=vi.fn().mockResolvedValue(Response.json(run));vi.stubGlobal("fetch",mock);
   const path=["C","platform","experiments"],url="http://localhost:3000/api/cases/C/platform/experiments",headers={Authorization:"Bearer test-only-token"};
   for(const method of ["GET","POST"])expect((await proxyCase(new Request(url,{method,headers,...(method==="POST"?{body:JSON.stringify({suite:"DOCUMENTS"})}:{})}),path)).status).toBe(200);
   expect((await proxyCase(new Request(url,{method:"DELETE",headers}),path)).status).toBe(405);
   expect((await proxyCase(new Request(url),path)).status).toBe(401);
   expect((await proxyCase(new Request(url+"/erase",{headers}),[...path,"erase"])).status).toBe(404);
   expect(mock).toHaveBeenCalledTimes(2);
 });
 it("rejects cross-origin runs before forwarding",async()=>{
   vi.stubEnv("CREDIT_API_URL","http://java:8080");const mock=vi.fn();vi.stubGlobal("fetch",mock);
   const response=await proxyCase(new Request("http://localhost:3000/api/cases/C/platform/experiments",{method:"POST",headers:{Authorization:"Bearer test-only",Origin:"https://untrusted.example"},body:"{}"}),["C","platform","experiments"]);
   expect(response.status).toBe(403);expect(mock).not.toHaveBeenCalled();
 });
});
