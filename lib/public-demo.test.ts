import {afterEach,describe,expect,it,vi} from "vitest";
import {demoBanking,demoPlatform,demoSearch,demoPdfUrl,publicDemoCase,publicDemoAnswer,demoXml} from "./public-demo";
import {bankingSchema,accountBalance} from "./banking";
import {platformSchema,searchSchema} from "./platform";
import {publicDemoText} from "./public-demo-language";
import {proxyCase} from "./case-proxy";
import {POST} from "../app/api/chat/route";
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe("standalone read-only public demo",()=>{
  it("provides valid, non-persistent platform and banking fixtures",()=>{
    expect(platformSchema.parse(demoPlatform()).persistent).toBe(false);
    expect(bankingSchema.parse(demoBanking()).persistent).toBe(false);
    expect(accountBalance(demoBanking(),"practice")).toBe(1651000);
    expect(demoPlatform().evaluations).toEqual([]);
    expect(demoPlatform().documentPipeline.worker).toBe(false);
  });
  it("retrieves existing evidence without a model or network",()=>{
    const spy=vi.fn();vi.stubGlobal("fetch",spy);
    const results=searchSchema.parse(demoSearch("Nettoeinkommen"));
    expect(results.search.hits.some(hit=>hit.id==="doc-1:p1")).toBe(true);
    expect(results.search.embedding).toContain("No model");
    expect(spy).not.toHaveBeenCalled();
  });
  it("shows hand-labelled evidence, not invented OCR confidence",()=>{
    expect(publicDemoCase.documents.every(doc=>doc.confidence==null)).toBe(true);
    expect(publicDemoCase.documents.every(doc=>!doc.originalAvailable)).toBe(true);
    expect(demoPdfUrl("doc-1")).toMatch(/^\/demo\//);
    expect(demoPdfUrl("private-id")).toBeUndefined();
  });
  it("labels Nova replies and demo limitations in every locale",()=>{
    for(const locale of ["en","de","vi"]){
      expect(publicDemoAnswer("income",locale)).toContain("6240 EUR");
      expect(publicDemoAnswer("balance",locale)).toContain("demo-banking");
      expect(publicDemoText(locale)("notice")).toContain("Docker");
    }
    expect(demoXml).toContain("NOT A VALID PAYMENT MESSAGE");
  });
  it("blocks backend access even if stale Vercel settings still contain an API URL",async()=>{
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE","true");vi.stubEnv("CREDIT_API_URL","http://should-not-call:8080");
    const spy=vi.fn();vi.stubGlobal("fetch",spy);
    expect((await proxyCase(new Request("http://localhost:3000/api/cases"))).status).toBe(503);
    expect((await POST(new Request("http://localhost:3000/api/chat",{method:"POST"}))).status).toBe(503);
    expect(spy).not.toHaveBeenCalled();
  });
});
