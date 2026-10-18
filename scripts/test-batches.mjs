import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';

// Explicit local-only test. Uses two pinned public synthetic invoices with the configured provider.
export async function auditBatches({request,check,bearer,web,api}){
  assert.equal(new URL(web).hostname,'localhost');assert.equal(new URL(api).hostname,'localhost');
  const send=(url,body)=>request(url,{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const created=await send(web+'/api/cases',{applicant:'Kaggle · Batch intake verification',domain:'general',purpose:'Controlled two-invoice batch acceptance. No actual customer records or financial decisions.',coApplicant:'',amountEuro:0,version:0});
  check(created.status===201,'Created isolated local batch dossier');const item=await created.json(),root=web+'/api/cases/'+item.id,endpoint=root+'/platform/batches';
  check((await request(endpoint)).status===401,'Batch history requires Bearer token');
  check((await request(endpoint,{method:'POST'})).status===401,'Batch submit requires Bearer token');
  check((await request(endpoint,{method:'PATCH',headers:bearer})).status===405,'Batch intake exposes only intended methods');
  const references=JSON.parse(readFileSync('lib/kaggle-reference-catalog.json','utf8')).filter(s=>s.domain==='general').slice(0,2),files=[];
  for(const ref of references){const r=await request(web+'/api/research-references?sample='+ref.id,{headers:bearer});assert.ok(r.ok);const bytes=Buffer.from(await r.arrayBuffer());check(createHash('sha256').update(bytes).digest('hex')===ref.sha256,'Pinned invoice bytes: '+ref.file);files.push({ref,bytes});}
  const key=randomUUID();
  async function upload(requestId=key,name='Kaggle invoices · checked intake',count=2){const form=new FormData();form.set('requestId',requestId);form.set('name',name);form.set('source','Kaggle devp1866/high-quality-ocr-ready-invoice-pdfs v1 · synthetic');form.set('profile','invoice');for(let i=0;i<count;i++){const file=files[i%files.length];form.append('files',new Blob([file.bytes],{type:'application/pdf'}),file.ref.file);}return request(endpoint,{method:'POST',headers:bearer,body:form});}
  check((await upload(randomUUID(),'Invalid over-limit intake',5)).status===422,'More than four files rejected before any queue work');
  const accepted=await upload();check(accepted.status===202,'Two-file batch accepted');const receipt=await accepted.json();
  check(receipt.items.length===2&&receipt.items.every(i=>i.state==='ACCEPTED'&&i.jobId),'Each accepted file has its own durable job');
  const replay=await upload();check(replay.status===202&&(await replay.json()).id===receipt.id,'Identical request replay returns original receipt');
  check((await upload(key,'Changed metadata')).status===409,'Reused request ID cannot silently change source metadata');
  const duplicate=await upload(randomUUID());check(duplicate.status===202&&(await duplicate.json()).items.every(i=>i.state==='DUPLICATE'&&receipt.items.some(original=>original.jobId===i.jobId)),'Duplicate receipt links existing jobs rather than submitting another OCR job');
  const until=Date.now()+240000;let result;
  while(Date.now()<until){const r=await request(endpoint,{headers:bearer});assert.ok(r.ok);const snapshot=await r.json();assert.equal(snapshot.adfConnected,false);assert.equal(snapshot.cloudIngestionConnected,false);result=snapshot.batches.find(b=>b.id===receipt.id);if(result?.items.every(i=>['COMPLETE','FAILED','CANCELLED'].includes(i.status)))break;await new Promise(resolve=>setTimeout(resolve,2000));}
  check(result?.items.every(i=>i.status==='COMPLETE'&&i.documentId),'All accepted batch jobs finish with source-backed results');
  check(result.items.every(i=>!i.profileMismatch&&!i.missingFields?.length),'Invoice profile finds both number and observed gross total');
  const platform=await (await request(root+'/platform',{headers:bearer})).json();
  check(platform.jobs.length===2,'Replays and duplicates did not create extra processing jobs');
  for(const file of result.items){check(file.reviewStatus!=='verified','Extraction does not auto-approve evidence');const original=await request(root+'/documents/'+file.documentId+'/original',{headers:bearer});assert.ok(original.ok);check(createHash('sha256').update(Buffer.from(await original.arrayBuffer())).digest('hex')===file.sha256,'Stored original matches batch source hash');}
  check(platform.jobs.every(j=>j.scan_result==='CLAMAV_CLEAN'),'Every batch original passes through ClamAV');
  check(platform.jobs.every(j=>j.extraction?.provider==='azure-document-intelligence'),'Batch results record actual Azure extraction provenance');
  if(process.env.TEST_BATCH_CHAT==='1'){
    const current=await (await request(root,{headers:bearer})).json();
    const reply=await send(web+'/api/chat',{caseId:item.id,locale:'en',caseVersion:current.version,messages:[{id:randomUUID(),role:'user',parts:[{type:'text',text:'What is the gross invoice total for invoice 51109301? Preserve the original currency, cite the document and page, and distinguish extraction from human verification.'}]}]});
    check(reply.ok&&reply.headers.get('x-ai-mode')?.startsWith('azure-'),'Nova uses actual Azure OpenAI on the batch evidence');
    const events=(await reply.text()).split('\n').filter(l=>l.startsWith('data: ')&&l!=='data: [DONE]').map(l=>JSON.parse(l.slice(6)));
    const answer=events.filter(e=>e.type==='text-delta').map(e=>e.delta||e.textDelta||'').join('');
    check(answer.length>80&&/INR|₹|rupees/i.test(answer),'Nova returns a substantive answer retaining INR');
    check(events.some(e=>e.type==='source-document'&&current.documents.some(d=>e.sourceId.startsWith(d.id))),'Nova exposes links to original batch evidence');
  }
  check((await request(api+'/api/cases/unknown/platform/batches',{headers:bearer})).status===404,'Unknown/out-of-scope dossier cannot expose batch history');
  console.log('Batch preview: '+web+'/en?case='+item.id+'&pipeline=batches#pipeline');
}
