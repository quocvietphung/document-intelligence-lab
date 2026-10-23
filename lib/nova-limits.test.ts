import {afterEach,describe,expect,it,vi} from "vitest";
import {novaLimit,novaLimitMessage,novaSafetyMessage,novaModelFailure,novaModelMessage} from "./nova-limits";
import {POST} from "../app/api/chat/route";
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe("Nova limit feedback",()=>{
 it.each([[429,'LOCAL_MODEL_BUSY'],[504,'LOCAL_MODEL_TIMEOUT']] as const)("preserves safe local model failure %s without provider text",async(status,code)=>{
   vi.stubEnv('NEXT_PUBLIC_DEMO_MODE','false');vi.stubEnv('CREDIT_API_URL','http://java:8080');
   const fetch=vi.fn().mockResolvedValue(Response.json({code,secret:'private provider payload'},{status}));vi.stubGlobal('fetch',fetch);
   const response=await POST(new Request('http://localhost:3000/api/chat',{method:'POST',headers:{Authorization:'Bearer test',Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({caseId:'CR-1',locale:'en',messages:[{id:'u',role:'user',parts:[{type:'text',text:'What is the invoice number?'}]}]})}));
   expect(response.status).toBe(status);expect(await response.json()).toEqual({error:code});expect(fetch).toHaveBeenCalledTimes(1);
   expect(response.headers.get('Retry-After')).toBe(status===429?'5':null);
 });
 it('localizes busy and timeout separately from quotas without exposing unknown errors',()=>{
   for(const locale of ['en','de','vi']){expect(novaModelMessage('LOCAL_MODEL_BUSY',locale)).toBeTruthy();expect(novaModelMessage('LOCAL_MODEL_TIMEOUT',locale)).toBeTruthy();expect(novaModelMessage('LOCAL_MODEL_BUSY',locale)).not.toBe(novaModelMessage('LOCAL_MODEL_TIMEOUT',locale));}
   expect(novaModelMessage('private provider error','en')).toBeUndefined();expect(novaModelFailure({code:'UNKNOWN',secret:'hidden'})).toBeUndefined();
 });
 it("preserves safety refusal without exposing the provider payload",async()=>{
   vi.stubEnv("NEXT_PUBLIC_DEMO_MODE","false");vi.stubEnv("CREDIT_API_URL","http://java:8080");
   const fetchMock=vi.fn().mockResolvedValue(Response.json({privateProviderPayload:"must not leak"},{status:422}));vi.stubGlobal("fetch",fetchMock);
   const response=await POST(new Request("http://localhost:3000/api/chat",{method:"POST",headers:{Authorization:"Bearer test",Origin:"http://localhost:3000","Content-Type":"application/json"},body:JSON.stringify({caseId:"CR-1",locale:"vi",messages:[{id:"u",role:"user",parts:[{type:"text",text:"Explain my payslip"}]}]})}));
   expect(response.status).toBe(422);expect(await response.json()).toEqual({error:"AI_SAFETY_FILTER"});expect(fetchMock).toHaveBeenCalledTimes(1);
   for(const locale of ["en","de","vi"])expect(novaSafetyMessage(locale)).toContain("Azure AI");
 });
 it("accepts only safe known metadata",()=>{expect(novaLimit({code:"AZURE_SECRET",resetAt:"oops"})).toBeUndefined();expect(novaLimit({code:"AI_MINUTE_LIMIT",resetAt:"invalid"})).toBeUndefined();expect(novaLimit({code:"AI_MINUTE_LIMIT",secret:"must-not-appear"})).toEqual({code:"AI_MINUTE_LIMIT"});});
 it("distinguishes minute, account and tenant limits in every locale",()=>{for(const locale of ["en","de","vi"]){const a=novaLimitMessage({code:"AI_MINUTE_LIMIT"},locale),b=novaLimitMessage({code:"AI_DAILY_ACCOUNT_LIMIT"},locale),c=novaLimitMessage({code:"AI_DAILY_TENANT_LIMIT"},locale);expect(new Set([a,b,c]).size).toBe(3);expect(novaLimitMessage({code:"AI_DAILY_ACCOUNT_LIMIT",resetAt:"2026-10-13T00:00:00Z"},locale)).not.toEqual(b);}});
 it("forwards structured quota errors without leaking backend payloads",async()=>{
   vi.stubEnv("NEXT_PUBLIC_DEMO_MODE","false");vi.stubEnv("CREDIT_API_URL","http://java:8080");
   vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({code:"AI_DAILY_ACCOUNT_LIMIT",resetAt:"2026-10-13T00:00:00Z",secret:"hidden"},{status:429,headers:{"Retry-After":"100"}})));
   const response=await POST(new Request("http://localhost:3000/api/chat",{method:"POST",headers:{Authorization:"Bearer test",Origin:"http://localhost:3000","Content-Type":"application/json"},body:JSON.stringify({caseId:"CR-1",locale:"vi",messages:[{id:"u",role:"user",parts:[{type:"text",text:"Explain my payslip"}]}]})}));
   expect(response.status).toBe(429);expect(response.headers.get("Retry-After")).toBe("100");expect(await response.json()).toEqual({error:"Usage limit reached",code:"AI_DAILY_ACCOUNT_LIMIT",resetAt:"2026-10-13T00:00:00Z"});
 });
});
