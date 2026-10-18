import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';

// Opt-in integration test: creates two local dossiers and sends eight reviewed
// private Kaggle PDFs to the configured document provider. Never a cloud target.
export async function auditKaggle({request,check,bearer,web,api}){
  assert.equal(new URL(web).hostname,'localhost');assert.equal(new URL(api).hostname,'localhost');
  const catalogue=JSON.parse(readFileSync('lib/kaggle-reference-catalog.json','utf8'));
  const send=(url,data)=>request(url,{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify(data)});
  const get=async url=>{const r=await request(url,{headers:bearer});assert.ok(r.ok,`Read failed ${r.status}`);return r.json();};
  const library=web+'/api/research-references';
  check((await request(library)).status===401,'Kaggle catalogue requires Bearer access');
  check((await request(library,{headers:{Authorization:'Bearer invalid'}})).status===401,'Invalid Bearer rejected by Java');
  check((await request(library+'?sample=../../.env',{headers:bearer})).status===404,'Reference path traversal rejected');
  const ready=await get(library);
  check(ready.references.length===8&&ready.references.every(r=>r.available),'All eight hash-verified private PDFs are ready');
  for(const file of ['insurance-policy-fictional.pdf','insurance-claim-fictional.pdf','invoice-fictional.pdf']){
    check((await request(web+'/samples/'+file)).status===404,'Old self-authored PDF is no longer public: '+file);
  }
  for(const domain of ['insurance','general']){
    const samples=catalogue.filter(s=>s.domain===domain);
    const availability=await get(library+'?domain='+domain);
    check(availability.references.length===4&&availability.references.every(r=>samples.some(s=>s.id===r.id)),domain+' catalogue contains only its four documents');
    const created=await send(web+'/api/cases',{applicant:'Kaggle · '+(domain==='insurance'?'Insurance wording':'Invoice research'),purpose:'Private source-bound document research; no coverage, payment or tax decisions.',domain,amountEuro:0,coApplicant:'',version:0});
    check(created.status===201,domain+' research dossier created');let item=await created.json();const root=web+'/api/cases/'+item.id;
    for(const sample of samples){
      const prepared=await request(library+'?sample='+sample.id,{headers:bearer});
      check(prepared.ok&&prepared.headers.get('cache-control').includes('no-store'),'Private uncached PDF: '+sample.id);
      const bytes=Buffer.from(await prepared.arrayBuffer());
      check(createHash('sha256').update(bytes).digest('hex')===sample.sha256,'Source hash verified: '+sample.id);
      check((await request(web+'/samples/'+sample.file)).status===404,'PDF is not a public asset: '+sample.id);
      const form=new FormData();form.set('file',new Blob([bytes],{type:'application/pdf'}),sample.file);
      const accepted=await request(root+'/platform/jobs',{method:'POST',headers:bearer,body:form});
      check(accepted.status===202,'Queue accepted '+sample.id);let job=await accepted.json();
      const until=Date.now()+180000;
      while(Date.now()<until){await new Promise(resolve=>setTimeout(resolve,2500));job=(await get(root+'/platform')).jobs.find(row=>row.id===job.id)||job;if(['COMPLETE','FAILED'].includes(job.status))break;}
      check(job.status==='COMPLETE','Extraction complete: '+(job.error_code||sample.id));
      check(job.scan_result==='CLAMAV_CLEAN','ClamAV clean: '+sample.id);
      item=await get(root);const doc=item.documents.find(d=>d.id===job.document_id);
      check(doc?.type===sample.documentType,'Correct document classification: '+sample.id);
      check(doc?.analysisProvider==='azure-document-intelligence'&&doc.modelId==='prebuilt-layout','Real Azure prebuilt-layout: '+sample.id);
      check(doc.pages.length===sample.sourcePages.length&&doc.pages.every(p=>p.text.length>100),'All selected pages extracted: '+sample.id);
      const original=await request(root+'/documents/'+doc.id+'/original',{headers:bearer});
      check(original.ok&&createHash('sha256').update(Buffer.from(await original.arrayBuffer())).digest('hex')===sample.sha256,'Stored private original matches: '+sample.id);
      check((await request(root+'/documents/'+doc.id+'/original')).status===401,'Stored original requires access token');
      if(domain==='insurance')check(!doc.fields.some(f=>['premium','policyholder'].includes(f.label)),'No invented premium or policyholder');
      else {
        check(doc.fields.some(f=>f.label==='invoiceNumber'&&f.value.includes(sample.id.slice(8))),'Invoice identifier extracted from source');
        check(doc.tables.length>=2,'Invoice item and summary tables extracted');
      }
    }
    if(domain==='insurance')check(item.missingDocuments.includes('insurance-policy'),'Wording does not fulfill an individual-policy requirement');
    const question=domain==='insurance'?'What do the personal liability wording and policy coverage period say?':'What is the invoice number, currency and total of invoice 51109301?';
    const searched=await send(root+'/platform/search',{question});check(searched.ok,'Hybrid retrieval works: '+domain);
    check((await searched.json()).search.hits.some(h=>item.documents.some(d=>d.id===h.documentId)),'Retrieved evidence belongs to the dossier: '+domain);
    if(process.env.TEST_KAGGLE_CHAT==='1'){
      const response=await send(web+'/api/chat',{caseId:item.id,locale:'en',caseVersion:item.version,messages:[{id:randomUUID(),role:'user',parts:[{type:'text',text:question+' Cite the document and page. Preserve original currency. Mention missing context; make no insurance or payment decisions.'}]}]});
      check(response.ok&&response.headers.get('x-ai-mode')?.startsWith('azure-'),'Nova uses real Azure OpenAI: '+domain);
      const events=(await response.text()).split('\n').filter(l=>l.startsWith('data: ')&&l!=='data: [DONE]').map(l=>JSON.parse(l.slice(6)));
      check(events.some(e=>e.type==='source-document'&&item.documents.some(d=>e.sourceId.startsWith(d.id))),'Nova links the dossier evidence: '+domain);
      const answer=events.filter(e=>e.type==='text-delta').map(e=>e.delta||e.textDelta||'').join('');
      check(answer.length>80,'Nova returned a substantive answer: '+domain);
      if(domain==='general')check(/INR|₹|rupees/i.test(answer),'Nova preserves original INR currency');
    }
    console.log('Kaggle '+domain+' preview: '+web+'/en?case='+item.id+'#documents');
  }
}
