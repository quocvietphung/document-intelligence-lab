import {readFile,stat} from "node:fs/promises";
import {createHash} from "node:crypto";
import hashes from "../../../services/credit-api/src/main/resources/datev-reference-hashes.json";
import {join} from "node:path";
import {datevReferences,datevReference} from "@/lib/datev-reference";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
export async function GET(request:Request){
  // Never redistribute publisher-owned documents through the public Vercel demo.
  if(process.env.NEXT_PUBLIC_DEMO_MODE==="true")return Response.json({error:"Private local reference only"},{status:403,headers});
  const root=process.env.CREDIT_API_URL,auth=request.headers.get("authorization");
  if(!root)return Response.json({error:"Local API required"},{status:503,headers});
  if(!auth?.startsWith("Bearer "))return Response.json({error:"Sign in required"},{status:401,headers});
  try{
    // Java verifies signature, audience, tenant and authorized case-reader role.
    const authorized=await fetch(root.replace(/\/$/,"")+"/api/cases",{headers:{Authorization:auth},cache:"no-store",signal:AbortSignal.timeout(10_000)});
    await authorized.body?.cancel();
    if(!authorized.ok)return Response.json({error:"Access denied"},{status:authorized.status===401?401:403,headers});
    const id=new URL(request.url).searchParams.get("sample");
    const folder=join(process.cwd(),".local","reference-pdfs");
    const backend=(sample?:string)=>fetch(root.replace(/\/$/,"")+"/api/cases/payroll-references"+(sample?"?sample="+encodeURIComponent(sample):""),{headers:{Authorization:auth},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15_000)});
    if(id){const sample=datevReference(id);if(!sample)return Response.json({error:"Unknown reference"},{status:404,headers});let bytes:Buffer;
      try {bytes=await readFile(join(folder,sample.file));}
      catch(error){if(!(error instanceof Error)||!("code" in error)||error.code!=="ENOENT")throw error;const remote=await backend(sample.id);if(!remote.ok){await remote.body?.cancel();return Response.json({error:"Private reference unavailable"},{status:[401,403,404].includes(remote.status)?remote.status:503,headers});}if(Number(remote.headers.get("content-length")||0)>3_000_000){await remote.body?.cancel();throw new Error("Invalid PDF");}bytes=Buffer.from(await remote.arrayBuffer());}
      if(bytes.length>3_000_000||bytes.subarray(0,5).toString()!=="%PDF-"||createHash("sha256").update(bytes).digest("hex")!==hashes[sample.file])throw new Error("Invalid PDF");return new Response(Uint8Array.from(bytes),{headers:{...headers,"Content-Type":"application/pdf","Content-Disposition":`inline; filename="${sample.file}"`}});}
    const references=await Promise.all(datevReferences.map(async sample=>{try{const s=await stat(join(folder,sample.file));return {id:sample.id,available:s.isFile()&&s.size>0&&s.size<=3_000_000};}catch{return {id:sample.id,available:false};}}));
    if(references.some(reference=>!reference.available)){const remote=await backend();if(remote.ok){const data=await remote.json() as {references?:{id:string;available:boolean}[]};for(const reference of references)if(!reference.available)reference.available=data.references?.some(row=>row.id===reference.id&&row.available===true)||false;}else await remote.body?.cancel();}
    return Response.json({references},{headers});
  }catch{return Response.json({error:"Private reference unavailable"},{status:503,headers});}
}
