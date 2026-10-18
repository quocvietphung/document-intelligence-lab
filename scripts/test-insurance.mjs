import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';

export async function auditInsurance({request,check,bearer,web,api}){
  assert.equal(new URL(web).hostname,'localhost');assert.equal(new URL(api).hostname,'localhost');
  const catalogue=JSON.parse(readFileSync('lib/kaggle-reference-catalog.json','utf8')).filter(row=>row.domain==='insurance');
  const send=(url,data)=>request(url,{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify(data)});
  const get=async url=>{const r=await request(url,{headers:bearer});assert.ok(r.ok,`Read failed ${r.status}`);return r.json();};
  const library=web+'/api/insurance-references';
  check((await request(library)).status===401,'Insurance catalogue requires Bearer access');
  check((await request(library,{headers:{Authorization:'Bearer invalid'}})).status===401,'Invalid Bearer rejected by Java');
  const availability=await get(library);
  check(catalogue.every(s=>availability.references.some(r=>r.id===s.id&&r.available===true)),'Both hash-verified private Kaggle excerpts are ready');
  check((await request(library+'?sample=../../.env',{headers:bearer})).status===404,'Reference path traversal is rejected');
  const created=await send(web+'/api/cases',{applicant:'Insurance · Kaggle policy wording',purpose:'Historical US reference excerpts: definitions, conditions and exclusions. No coverage decisions.',domain:'insurance',amountEuro:0,coApplicant:'',version:0});
  check(created.status===201,'Insurance research dossier created');let item=await created.json();const root=web+'/api/cases/'+item.id;
  for(const sample of catalogue){
    const prepared=await request(library+'?sample='+sample.id,{headers:bearer});
    check(prepared.ok&&prepared.headers.get('cache-control').includes('no-store'),'Private reference served without caching: '+sample.id);
    const bytes=Buffer.from(await prepared.arrayBuffer());
    check(createHash('sha256').update(bytes).digest('hex')===sample.sha256,'Exact reviewed reference bytes: '+sample.id);
    check((await request(web+'/samples/'+sample.file)).status===404,'Kaggle PDF is not a public asset: '+sample.id);
    const form=new FormData();form.set('file',new Blob([bytes],{type:'application/pdf'}),sample.file);
    const accepted=await request(root+'/platform/jobs',{method:'POST',headers:bearer,body:form});
    check(accepted.status===202,'Durable queue accepted '+sample.id);let job=await accepted.json();
    const until=Date.now()+180000;
    while(Date.now()<until){await new Promise(resolve=>setTimeout(resolve,2500));job=(await get(root+'/platform')).jobs.find(row=>row.id===job.id)||job;if(['COMPLETE','FAILED'].includes(job.status))break;}
    check(job.status==='COMPLETE','Extraction complete: '+(job.error_code||sample.id));
    check(job.scan_result==='CLAMAV_CLEAN','ClamAV scanned '+sample.id);
    item=await get(root);const doc=item.documents.find(d=>d.id===job.document_id);
    check(doc?.type==='insurance-wording','Reference wording is not an individual policy');
    check(doc?.analysisProvider==='azure-document-intelligence'&&doc.modelId==='prebuilt-layout','Real Azure Document Intelligence provenance');
    check(doc.pages.length===2&&doc.pages.every(p=>p.text.length>100),'Both selected pages have real extracted text');
    const original=await request(root+'/documents/'+doc.id+'/original',{headers:bearer});
    check(original.ok&&createHash('sha256').update(Buffer.from(await original.arrayBuffer())).digest('hex')===sample.sha256,'Stored private original is byte-identical');
    check((await request(root+'/documents/'+doc.id+'/original')).status===401,'Stored original is not anonymous');
    check(!doc.fields.some(f=>['premium','policyholder'].includes(f.label)),'No fabricated premium or policyholder');
  }
  check(item.missingDocuments.includes('insurance-policy'),'Reference wording does not fulfill the individual policy checklist');
  const search=await send(root+'/platform/search',{question:'What are the policy coverage period and fire or lightning exclusions?'});
  check(search.ok,'Hybrid evidence search works for insurance excerpts');const data=await search.json();
  check(data.search.hits.some(hit=>item.documents.some(d=>d.id===hit.documentId)),'Search returns the selected insurance evidence');
  if(process.env.TEST_INSURANCE_CHAT==='1'){
    const response=await send(web+'/api/chat',{caseId:item.id,locale:'en',caseVersion:item.version,messages:[{id:randomUUID(),role:'user',parts:[{type:'text',text:'Explain the policy coverage period and one fire or lightning exclusion explicitly stated in the Shelter excerpt. Cite its excerpt page and mention missing context. Do not decide any real insurance claim.'}]}]});
    check(response.ok&&response.headers.get('x-ai-mode')?.startsWith('azure-'),'Nova called Azure OpenAI');
    const events=(await response.text()).split('\n').filter(line=>line.startsWith('data: ')&&line!=='data: [DONE]').map(line=>JSON.parse(line.slice(6)));
    check(events.some(e=>e.type==='source-document'&&item.documents.some(d=>e.sourceId.startsWith(d.id))),'Nova answer links the selected source documents');
    check(events.filter(e=>e.type==='text-delta').map(e=>e.delta||e.textDelta||'').join('').length>80,'Nova returned a completed substantive answer');
  }
  console.log('Insurance preview: '+web+'/en?case='+item.id+'#documents');
}
