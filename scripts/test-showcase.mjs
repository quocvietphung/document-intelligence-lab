// Fresh-clone acceptance: repository-authored fictional invoice, no Azure calls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export async function auditShowcase({request,check,bearer,web,api}) {
  assert.equal(new URL(web).hostname,'localhost','Showcase acceptance is local-only');
  assert.equal(new URL(api).hostname,'localhost','Showcase acceptance is local-only');
  const send=(url,body)=>request(url,{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const get=async url=>{const r=await request(url,{headers:bearer});assert.ok(r.ok,`Authenticated read failed: ${r.status}`);return r.json();};
  const status=await get(web+'/api/cases/document-analysis/status');
  check(status.mode==='local','Fresh-clone profile uses local extraction, not Azure');
  const created=await send(web+'/api/cases',{applicant:'Showcase · fictional invoice',purpose:'Local document research acceptance; no payments',domain:'general',amountEuro:0,coApplicant:'',version:0});
  check(created.status===201,'Create a general research dossier without a loan amount');
  let item=await created.json();const root=`${web}/api/cases/${item.id}`;
  const bytes=readFileSync(new URL('../services/credit-api/src/test/resources/legacy-research/invoice-fictional.pdf',import.meta.url));
  const upload=new FormData();upload.set('file',new Blob([bytes],{type:'application/pdf'}),'invoice-fictional.pdf');
  const queued=await request(root+'/platform/jobs',{method:'POST',headers:bearer,body:upload});
  check(queued.status===202,'Upload returns a durable processing job');const job=await queued.json();
  let complete;
  const deadline=Date.now()+180000;
  while(Date.now()<deadline) {
    complete=(await get(root+'/platform')).jobs.find(j=>j.id===job.id);
    assert.notEqual(complete?.status,'FAILED',`Document failed: ${complete?.error_code}`);
    if(complete?.status==='COMPLETE')break;
    await new Promise(resolve=>setTimeout(resolve,2500));
  }
  check(complete?.status==='COMPLETE'&&complete.scan_result==='CLAMAV_CLEAN','ClamAV scan and local PDF extraction complete');
  item=await get(root);const doc=item.documents.find(d=>d.id===complete.document_id);
  check(Boolean(doc?.originalAvailable&&doc.pages.length&&doc.analysisProvider!=='azure-document-intelligence'),'Actual local extraction and original provenance are retained');
  check(doc.type==='invoice'&&doc.fields.some(f=>f.label==='invoiceTotal'&&f.value.includes('119')),'Invoice type and known fictional total extracted');
  check((await request(root)).status===401,'Anonymous dossier access rejected');
  const originalUrl=root+`/documents/${doc.id}/original`;
  check((await request(originalUrl)).status===401,'Original requires a Bearer token');
  const original=await request(originalUrl,{headers:bearer});const digest=data=>createHash('sha256').update(data).digest('hex');
  check(original.ok&&digest(Buffer.from(await original.arrayBuffer()))===digest(bytes),'Private original is byte-identical to the uploaded PDF');
  const search=await send(root+'/platform/search',{question:'What is the invoice total amount?'});
  check(search.ok,'Evidence search is available');const retrieved=await search.json();
  check(retrieved.search.backend==='qdrant'&&retrieved.search.hits.some(h=>h.documentId===doc.id),'Qdrant hybrid retrieval finds this original');
  const research=root+'/platform/research',snapshot=await get(research);
  const saved=await send(research+'/datasets',{caseVersion:item.version,name:'Fictional invoice · known fixture reference v1',sourceChecked:true,fields:[],questions:[{question:'What is the invoice total amount?',documentId:doc.id,page:1}]});
  check(saved.ok,'Save source-bound question reference without using predictions as field labels');const dataset=await saved.json();
  const accepted=await send(research+'/runs',{caseVersion:item.version,datasetId:dataset.id,suite:'RETRIEVAL'});
  check(accepted.status===202,'Research worker accepts a durable retrieval job');const researchJob=await accepted.json();
  let result;const until=Date.now()+180000;
  while(Date.now()<until) {
    const current=await get(research),task=current.jobs.find(j=>j.id===researchJob.id);
    assert.notEqual(task?.status,'FAILED',`Experiment failed: ${task?.errorCode}`);
    result=current.runs.find(r=>r.id===researchJob.id);if(result)break;
    await new Promise(resolve=>setTimeout(resolve,2500));
  }
  check(Boolean(result&&result.azureCalls===0&&result.sourceHash===snapshot.sourceHash),'Research result persists with source fingerprint and zero new Azure calls');
  check(result.variants.map(v=>v.method).join(',')==='BM25,VECTOR,HYBRID','All three retrieval methods are measured');
  const exported=await send(research+'/export',{caseVersion:item.version});check(exported.ok,'Private research export works on a fresh dossier');
  const bundle=await exported.json();check(bundle.cloudUploaded===false&&bundle.destination==='browser-download-only'&&bundle.evaluationInputs.some(q=>q.documentId===doc.id&&q.context&&!('response' in q)),'Export contains source context, not fabricated answers or cloud uploads');
  console.log(`Showcase dossier: ${item.id}`);
}
