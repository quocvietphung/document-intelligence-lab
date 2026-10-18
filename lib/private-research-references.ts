import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join} from 'node:path';
import {kaggleReferences,kaggleReference} from '@/lib/research-samples';
import {validInsuranceReference} from '@/lib/insurance-reference-bytes';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
async function referenceBytes(sample:typeof kaggleReferences[number]){
  const file=await open(join(process.cwd(),'.local','reference-pdfs',sample.file),constants.O_RDONLY|constants.O_NOFOLLOW);
  try{const stat=await file.stat();if(!stat.isFile()||stat.size>3_000_000)throw new Error('Invalid reference');
    const bytes=await file.readFile();if(!validInsuranceReference(bytes,sample.sha256))throw new Error('Invalid reference');return bytes;
  }finally{await file.close();}
}
export async function serveResearchReferences(request:Request,onlyDomain?:'insurance'|'general'){
  const requested=new URL(request.url).searchParams.get('domain');
  if(requested&&!['insurance','general'].includes(requested))return Response.json({error:'Unknown domain'},{status:400,headers});
  const domain=onlyDomain||requested;
  const catalogue=kaggleReferences.filter(sample=>!domain||sample.domain===domain);
  if(process.env.NEXT_PUBLIC_DEMO_MODE==='true')return Response.json({error:'Private local references only'},{status:403,headers});
  const auth=request.headers.get('authorization');
  if(!auth?.startsWith('Bearer '))return Response.json({error:'Sign in required'},{status:401,headers});
  const api=process.env.CREDIT_API_URL;
  if(!api)return Response.json({error:'Local API required'},{status:503,headers});
  try{
    // Java verifies signature, issuer, API audience, role and tenant.
    const authorized=await fetch(api.replace(/\/$/,'')+'/api/cases',{headers:{Authorization:auth},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10_000)});
    await authorized.body?.cancel();
    if(!authorized.ok)return Response.json({error:'Access denied'},{status:authorized.status===401?401:403,headers});
    const id=new URL(request.url).searchParams.get('sample');
    if(id!==null){const sample=kaggleReference(id);if(!sample||!catalogue.some(row=>row.id===sample.id))return Response.json({error:'Unknown reference'},{status:404,headers});
      const bytes=await referenceBytes(sample);return new Response(Uint8Array.from(bytes),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${sample.file}"`}});}
    const references=await Promise.all(catalogue.map(async sample=>{try{await referenceBytes(sample);return {id:sample.id,available:true};}catch{return {id:sample.id,available:false};}}));
    return Response.json({references},{headers});
  }catch{return Response.json({error:'Private reference unavailable'},{status:503,headers});}
}
