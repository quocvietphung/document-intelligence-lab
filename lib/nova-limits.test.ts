import {afterEach,describe,expect,it,vi} from "vitest";
import {novaLimit,novaLimitMessage} from "./nova-limits";
import {POST} from "../app/api/chat/route";
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe("Nova limit feedback",()=>{
 it("accepts only safe known metadata",()=>{expect(novaLimit({code:"AZURE_SECRET",resetAt:"oops"})).toBeUndefined();expect(novaLimit({code:"AI_MINUTE_LIMIT",resetAt:"invalid"})).toBeUndefined();expect(novaLimit({code:"AI_MINUTE_LIMIT",secret:"must-not-appear"})).toEqual({code:"AI_MINUTE_LIMIT"});});
 it("distinguishes minute, account and tenant limits in every locale",()=>{for(const locale of ["en","de","vi"]){const a=novaLimitMessage({code:"AI_MINUTE_LIMIT"},locale),b=novaLimitMessage({code:"AI_DAILY_ACCOUNT_LIMIT"},locale),c=novaLimitMessage({code:"AI_DAILY_TENANT_LIMIT"},locale);expect(new Set([a,b,c]).size).toBe(3);expect(novaLimitMessage({code:"AI_DAILY_ACCOUNT_LIMIT",resetAt:"2026-10-13T00:00:00Z"},locale)).not.toEqual(b);}});
 it("forwards structured quota errors without leaking backend payloads",async()=>{
   vi.stubEnv("NEXT_PUBLIC_DEMO_MODE","false");vi.stubEnv("CREDIT_API_URL","http://java:8080");
   vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({code:"AI_DAILY_ACCOUNT_LIMIT",resetAt:"2026-10-13T00:00:00Z",secret:"hidden"},{status:429,headers:{"Retry-After":"100"}})));
   const response=await POST(new Request("http://localhost:3000/api/chat",{method:"POST",headers:{Authorization:"Bearer test",Origin:"http://localhost:3000","Content-Type":"application/json"},body:JSON.stringify({caseId:"CR-1",locale:"vi",messages:[{id:"u",role:"user",parts:[{type:"text",text:"Explain my payslip"}]}]})}));
   expect(response.status).toBe(429);expect(response.headers.get("Retry-After")).toBe("100");expect(await response.json()).toEqual({error:"Usage limit reached",code:"AI_DAILY_ACCOUNT_LIMIT",resetAt:"2026-10-13T00:00:00Z"});
 });
});
