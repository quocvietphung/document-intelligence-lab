// Sends generated synthetic examples only. Never logs passwords, tokens or PDF text.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
const out=JSON.parse(execFileSync('terraform',['-chdir=infra/azure/vm-lab','output','-json'],{encoding:'utf8'}));
const backend=out.backend_url.value,auth=out.keycloak_url.value;
const frontend='https://credit-intelligence-lab.vercel.app';
const throughFrontend=process.argv.includes('--frontend');
const root=throughFrontend?frontend:backend;
const credentials=JSON.parse(readFileSync('.local/azure-vm/advisor.json','utf8'));
const cookies=new Map(),checks=[];
function check(ok,label){assert.ok(ok,label);checks.push(label);console.log('PASS '+label);}
async function request(url,options={}){
  // Never forward Keycloak cookies to the separate Vercel origin. API calls use the JWT.
  const origin=new URL(url).origin;
  let jar=cookies.get(origin);if(!jar){jar=new Map();cookies.set(origin,jar);}
  const r=await fetch(url,{...options,redirect:'manual',signal:AbortSignal.timeout(55000),headers:{...options.headers,...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{})}});
  for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}
  return r;
}
const realm=auth+'/realms/credit-intelligence';
let r=await request(realm+'/.well-known/openid-configuration');check(r.status===200,'Trusted HTTPS and OIDC discovery');
const metadata=await r.json();check(metadata.issuer===realm,'Canonical Keycloak issuer');
const verifier=randomBytes(32).toString('base64url'),state=randomBytes(16).toString('hex');
const login=new URL(metadata.authorization_endpoint);
login.search=new URLSearchParams({client_id:'credit-intelligence-web',response_type:'code',scope:'openid profile email',redirect_uri:frontend+'/en',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
r=await request(login);check(r.status===200,'Production Keycloak login page');
const action=(await r.text()).match(/<form[^>]*action="([^"]+)"/i)?.[1]?.replaceAll('&amp;','&');
check(action&&new URL(action).origin===new URL(backend).origin,'Login action stays on trusted backend');
r=await request(action,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...credentials,credentialId:''})});
check(r.status===302,'Random-password advisor login');
const callback=new URL(r.headers.get('location'));check(callback.origin===frontend&&callback.searchParams.get('state')===state,'Exact Vercel redirect and OAuth state');
r=await request(metadata.token_endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:'credit-intelligence-web',code:callback.searchParams.get('code'),redirect_uri:frontend+'/en',code_verifier:verifier})});
check(r.status===200,'PKCE authorization-code exchange');
const tokens=await r.json(),claims=JSON.parse(Buffer.from(tokens.access_token.split('.')[1],'base64url'));
check(claims.tenant_id==='praxisbank-demo'&&[].concat(claims.aud).includes('credit-api'),'API audience and tenant claims');
const bearer={Authorization:'Bearer '+tokens.access_token};
check((await request(root+'/api/cases')).status===401,'Anonymous case access rejected');
check((await request(root+'/api/cases',{headers:{Authorization:'Bearer invalid'}})).status===401,'Invalid JWT rejected');
r=await request(root+'/api/cases',{headers:bearer});check(r.status===200&&Array.isArray(await r.json()),'Authorized case listing');
r=await request(root+'/api/cases',{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify({applicant:'Synthetic Azure VM Verification',coApplicant:'',purpose:'Generated lab evidence only',amountEuro:10000,version:0})});
check(r.status===201,'New synthetic case persisted');
let item=await r.json();const caseId=item.id,base=root+'/api/cases/'+caseId+'/platform';
r=await request(base,{headers:bearer});let snapshot=await r.json();
check(r.status===200&&snapshot.persistent&&snapshot.documentPipeline.storage==='local volume','SQL and VM disk persistence configured');
check(snapshot.limits==='redis connected'&&snapshot.documentPipeline.scanner==='ClamAV INSTREAM','Redis and ClamAV configured');
r=await request(base+'/search',{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify({question:'What does human review require?'})});
const search=await r.json();check(r.status===200&&search.search.backend==='qdrant'&&search.search.embedding.includes('MiniLM'),'Qdrant + ONNX + hybrid retrieval');
function pdf(lines){
  const stream='BT /F1 14 Tf 40 760 Td '+lines.map((t,i)=>(i?'0 -24 Td ':'')+'('+t.replace(/[\\()]/g,'\\$&')+') Tj').join('\n')+' ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let body='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(body));body+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(body);body+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(body);
}
const bytes=pdf(['SYNTHETIC LAB - NOT A REAL PAYSLIP','Gehaltsabrechnung September 2026','Arbeitnehmer: Test Person','Arbeitgeber: Azure Lab GmbH','Abrechnungsmonat: 09.2026','Brutto: 4200 EUR','Nettoeinkommen: 3200 EUR','Auszahlungsbetrag: 3200 EUR']);
const form=new FormData();form.set('file',new Blob([bytes],{type:'application/pdf'}),'synthetic-azure-payroll.pdf');form.set('version',String(item.version));
r=await request(root+'/api/cases/'+caseId+'/documents',{method:'POST',headers:bearer,body:form});check(r.status===200,'Synthetic PDF upload and Azure extraction');
item=await r.json();const doc=item.documents.at(-1);
check(doc.analysisProvider==='azure-document-intelligence'&&doc.modelId==='prebuilt-layout','Real Azure layout provider through VM identity');
check(doc.fields.some(f=>/3200|3[.,]200/.test(f.value)),'Synthetic net income extracted');
r=await request(root+'/api/cases/'+caseId+'/documents/'+doc.id+'/original',{headers:bearer});check(r.status===200&&createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex')===createHash('sha256').update(bytes).digest('hex'),'Private PDF round-trip preserves original');
r=await request(root+'/api/cases/'+caseId+'/documents/'+doc.id+'/review',{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify({version:item.version,values:doc.fields.map(f=>f.value)})});
check(r.status===200&&(await r.json()).documents.find(d=>d.id===doc.id).status==='verified','Human evidence review persisted');
const queued=new FormData();queued.set('file',new Blob([pdf(['SYNTHETIC QUEUED PAYSLIP','Arbeitnehmer: Test Person','Nettoeinkommen: 3100 EUR'])],{type:'application/pdf'}),'synthetic-queued-payroll.pdf');
r=await request(base+'/jobs',{method:'POST',headers:bearer,body:queued});check(r.status===202,'Asynchronous PDF job accepted');const job=await r.json();
let done;
for(let attempt=0;attempt<36;attempt++){
  await new Promise(resolve=>setTimeout(resolve,5000));r=await request(base,{headers:bearer});snapshot=await r.json();done=snapshot.jobs.find(j=>j.id===job.id);
  if(done&&['COMPLETE','FAILED'].includes(done.status))break;
}
check(done?.status==='COMPLETE'&&done.scan_result==='CLAMAV_CLEAN','Background worker + actual ClamAV scan + Azure job complete');
if(throughFrontend){
  r=await request(frontend+'/api/chat',{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify({caseId,locale:'en',messages:[{id:'cloud-check',role:'user',parts:[{type:'text',text:'Explain the verified synthetic payroll net income and cite the document. Require human review; do not make a credit decision.'}]}]})});
  check(r.status===200&&r.headers.get('x-ai-mode')==='azure-managed-identity','Vercel Nova uses real Azure OpenAI through Java Managed Identity');
  check((await r.text()).includes('text-delta'),'Nova response streaming protocol');
}else{
  r=await request(backend+'/api/assistant/chat',{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify({caseId,locale:'en',question:'Explain the verified synthetic payroll net income and cite the document. Require human review; do not make a credit decision.'})});
  check(r.status===200,'Java Nova request succeeds');const answer=await r.json();check(answer.mode==='azure-managed-identity'&&answer.answer?.length>30,'Real Azure OpenAI via VM Managed Identity');
}
r=await request(metadata.token_endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:'credit-intelligence-web',refresh_token:tokens.refresh_token})});check(r.status===200,'Refresh token flow');
const refreshed=await r.json();r=await request(realm+'/protocol/openid-connect/logout',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:'credit-intelligence-web',refresh_token:refreshed.refresh_token})});check(r.status===204,'Logout succeeds');
writeFileSync('.local/azure-vm/'+(throughFrontend?'frontend':'backend')+'-verification.json',JSON.stringify({verifiedAt:new Date().toISOString(),backend,frontend,caseId,checks},null,2),{mode:0o600});
console.log(`Verified ${checks.length} boundaries; only synthetic case ${caseId} created.`);
