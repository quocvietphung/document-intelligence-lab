import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {readFile,stat} from "node:fs/promises";
import {GET} from "../app/api/payroll-references/route";
vi.mock("node:fs/promises",()=>({readFile:vi.fn(),stat:vi.fn()}));
beforeEach(()=>{vi.stubEnv("NEXT_PUBLIC_DEMO_MODE","false");vi.stubEnv("CREDIT_API_URL","https://backend.example");vi.mocked(readFile).mockRejectedValue(Object.assign(new Error("missing"),{code:"ENOENT"}));vi.mocked(stat).mockRejectedValue(new Error("missing"));});
afterEach(()=>{vi.resetAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});
const request=(query="")=>new Request("https://frontend.example/api/payroll-references"+query,{headers:{Authorization:"Bearer test-session"}});
describe("Private cloud DATEV proxy",()=>{
 it("uses the authenticated backend when Vercel has no local files",async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(Response.json([])).mockResolvedValueOnce(Response.json({references:[{id:"robert",available:true},{id:"melanie",available:false}]}));vi.stubGlobal("fetch",fetch);
  const response=await GET(request());expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("no-store");expect(await response.json()).toEqual({references:[{id:"robert",available:true},{id:"melanie",available:false}]});expect(fetch).toHaveBeenLastCalledWith("https://backend.example/api/cases/payroll-references",expect.objectContaining({headers:{Authorization:"Bearer test-session"},redirect:"error",cache:"no-store"}));
 });
 it("will not serve a fake PDF renamed as an approved DATEV sample",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValueOnce(Response.json([])).mockResolvedValueOnce(new Response("%PDF-renamed",{headers:{"Content-Type":"application/pdf"}})));
  expect((await GET(request("?sample=robert"))).status).toBe(503);
 });
 it("does not fall back after backend authorization fails",async()=>{
  const fetch=vi.fn().mockResolvedValue(new Response("",{status:403}));vi.stubGlobal("fetch",fetch);expect((await GET(request("?sample=robert"))).status).toBe(403);expect(fetch).toHaveBeenCalledTimes(1);
 });
 it("rejects file paths instead of forwarding them",async()=>{
  const fetch=vi.fn().mockResolvedValue(Response.json([]));vi.stubGlobal("fetch",fetch);expect((await GET(request("?sample=..%2Fsecrets"))).status).toBe(404);expect(fetch).toHaveBeenCalledTimes(1);
 });
});
