import { createUIMessageStream,createUIMessageStreamResponse,type UIMessage } from "ai";
import { conversationSchema,messageText } from "@/lib/credit-chat";
import { boundedBody } from "@/lib/request-body";
import { hasAllowedOrigin } from "@/lib/request-origin";
import {novaLimit} from "@/lib/nova-limits";
import {trustAnswerSchema} from "@/lib/nova-trust";
export const runtime="nodejs";
export const maxDuration=420;
export async function POST(request:Request) {
  if(process.env.NEXT_PUBLIC_DEMO_MODE==="true") return Response.json({error:"Public demo: Azure chat disabled"},{status:503});
  const requestId=crypto.randomUUID(); const root=process.env.CREDIT_API_URL;
  if(!root) return Response.json({error:"Verified Java API required"},{status:503});
  const authorization=request.headers.get("authorization");
  if(!authorization?.startsWith("Bearer ")) return Response.json({error:"Sign in required"},{status:401});
  if(!hasAllowedOrigin(request)) return Response.json({error:"Origin not allowed"},{status:403});
  try {
    let body;
    try { body=conversationSchema.parse(JSON.parse(new TextDecoder().decode(await boundedBody(request,30_000)))); }
    catch(error) { return Response.json({error:"Invalid conversation"},{status:error instanceof Error&&error.message==="BODY_LIMIT"?413:400}); }
    const messages: UIMessage[]=body.messages.map(m=>({...m,parts:m.parts.filter(p=>p.type==="text")}));
    const latest=[...messages].reverse().find(m=>m.role==="user");
    if(!latest || !messageText(latest)) return Response.json({error:"Question required"},{status:400});
    const response=await fetch(`${root.replace(/\/$/,"")}/api/assistant/chat`,{
      method:"POST",headers:{Authorization:authorization,"Content-Type":"application/json"},
      body:JSON.stringify({caseId:body.caseId,locale:body.locale,question:messageText(latest),revisionOf:body.revisionOf,feedbackId:body.feedbackId,taskId:body.taskId,caseVersion:body.caseVersion}),
      cache:"no-store",signal:AbortSignal.any([request.signal,AbortSignal.timeout(process.env.NOVA_PROVIDER==='ollama'?380_000:45_000)]),
    });
    if(!response.ok) {
      if(response.status===422)return Response.json({error:"AI_SAFETY_FILTER"},{status:422,headers:{"Cache-Control":"no-store"}});
      if(response.status===429){
        // Only known safe limit metadata may cross the proxy; never forward provider errors.
        const limit=novaLimit(await response.json().catch(()=>undefined));
        const seconds=response.headers.get("Retry-After");
        const headers:Record<string,string>={"Cache-Control":"no-store"};
        if(seconds&&/^\d{1,5}$/.test(seconds)&&Number(seconds)>0&&Number(seconds)<=86400)headers["Retry-After"]=seconds;
        return Response.json({error:"Usage limit reached",...limit},{status:429,headers});
      }
      return Response.json({error:"AI assistant unavailable"},{status:[400,401,403,404,409].includes(response.status)?response.status:503});
    }
    const result=await response.json() as {answer:string;mode:string;sources:{id:string;title:string}[];trust?:unknown};
    if(typeof result.answer!=="string"||!Array.isArray(result.sources)) throw new Error("Invalid assistant response");
    const trust=trustAnswerSchema.safeParse(result.trust);
    const stream=createUIMessageStream<UIMessage>({execute:async({writer})=>{
      writer.write({type:"start"});
      if(trust.success)writer.write({type:"data-nova-trust",data:trust.data});
      for(const source of result.sources) writer.write({type:"source-document",sourceId:source.id,mediaType:"text/plain",title:source.title});
      const id=crypto.randomUUID(); writer.write({type:"text-start",id});
      writer.write({type:"text-delta",id,delta:result.answer});
      writer.write({type:"text-end",id}); writer.write({type:"finish",finishReason:"stop"});
    },onError:()=>"AI_UNAVAILABLE"});
    return createUIMessageStreamResponse({headers:{"Cache-Control":"no-store","X-Request-ID":requestId,"X-AI-Mode":result.mode||"unknown"},stream});
  } catch {
    // No prompts, tokens, document contents or provider error payloads enter application logs.
    console.error("credit-chat-failed",{requestId});
    return Response.json({error:"Chat unavailable",requestId},{status:503});
  }
}
