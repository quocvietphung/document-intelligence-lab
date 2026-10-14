import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyCase } from "./case-proxy";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("document analysis status transport", () => {
  it("forwards only the named authenticated retry route and POST method",async()=>{
    vi.stubEnv("CREDIT_API_URL","http://java:8080");
    const fetchMock=vi.fn().mockResolvedValue(Response.json({status:"QUEUED"},{status:202}));vi.stubGlobal("fetch",fetchMock);
    const path=["C","platform","jobs","job-test","retry"];
    const headers={Authorization:"Bearer synthetic-test-token"};
    expect((await proxyCase(new Request("http://localhost:3000/api/cases/C/platform/jobs/job-test/retry",{headers,method:"POST"}),path)).status).toBe(202);
    expect((await proxyCase(new Request("http://localhost:3000/api/cases/C/platform/jobs/job-test/retry",{headers}),path)).status).toBe(405);
    expect((await proxyCase(new Request("http://localhost:3000/api/cases/C/platform/jobs/job-test/delete",{headers,method:"POST"}),[...path.slice(0,-1),"delete"])).status).toBe(404);
    expect((await proxyCase(new Request("http://localhost:3000/api/cases/C/platform/jobs/job-test/retry",{method:"POST"}),path)).status).toBe(401);
  });
  it("allows only named platform routes and enforces read/write methods",async()=>{
    vi.stubEnv("CREDIT_API_URL","http://java:8080");
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({caseId:"C"})));
    const headers={Authorization:"Bearer synthetic-test-token"};
    expect((await proxyCase(new Request("http://localhost:3000/api/cases/C/platform",{headers}),["C","platform"])).status).toBe(200);
    expect((await proxyCase(new Request("http://localhost:3000/api/cases/C/platform/search",{headers}),["C","platform","search"])).status).toBe(405);
    expect((await proxyCase(new Request("http://localhost:3000/api/cases/C/platform/admin",{headers}),["C","platform","admin"])).status).toBe(404);
    expect((await proxyCase(new Request("http://localhost:3000/api/cases/C/platform/sample-xml",{headers}),["C","platform","sample-xml"])).status).toBe(404);
  });
  it("allows only named banking routes and their intended methods",async()=>{
    vi.stubEnv("CREDIT_API_URL","http://java:8080");
    const fetchMock=vi.fn().mockResolvedValue(Response.json({synthetic:true}));vi.stubGlobal("fetch",fetchMock);
    const headers={Authorization:"Bearer synthetic-test-token"};
    expect((await proxyCase(new Request("http://localhost:3000/api/cases/C/banking",{headers}),["C","banking"])).status).toBe(200);
    expect((await proxyCase(new Request("http://localhost:3000/api/cases/C/banking/payments",{headers}),["C","banking","payments"])).status).toBe(404);
    expect((await proxyCase(new Request("http://localhost:3000/api/cases/C/banking",{headers,method:"POST"}),["C","banking"])).status).toBe(405);
    expect((await proxyCase(new Request("http://localhost:3000/api/cases/C/banking/admin",{headers}),["C","banking","admin"])).status).toBe(404);
    for(const path of [["C","banking","payments"],["C","banking","payments","SIM-legacy","confirm"]])
      expect((await proxyCase(new Request("http://localhost:3000/api/cases/"+path.join("/"),{headers,method:"POST",body:"{}"}),path)).status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("forwards the authorized status request and F0 page limit", async () => {
    vi.stubEnv("CREDIT_API_URL", "http://java:8080");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ mode: "azure", maxPages: 2 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await proxyCase(new Request("http://localhost:3000/api/cases/document-analysis/status", {
      headers: { Authorization: "Bearer synthetic-test-token" },
    }), ["document-analysis", "status"]);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ mode: "azure", maxPages: 2 });
    expect(fetchMock).toHaveBeenCalledWith("http://java:8080/api/cases/document-analysis/status",
      expect.objectContaining({ method: "GET", headers: expect.objectContaining({ Authorization: "Bearer synthetic-test-token" }) }));
  });

  it("requires authentication and rejects writes to status", async () => {
    vi.stubEnv("CREDIT_API_URL", "http://java:8080");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await proxyCase(new Request("http://localhost:3000/api/cases/document-analysis/status"),
      ["document-analysis", "status"])).status).toBe(401);
    expect((await proxyCase(new Request("http://localhost:3000/api/cases/document-analysis/status", {
      method: "POST", headers: { Authorization: "Bearer synthetic-test-token" },
    }), ["document-analysis", "status"])).status).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
