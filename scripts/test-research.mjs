// Explicit local acceptance. Reuses approved fictional originals; no cloud AI calls or token output.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
export async function auditResearch({request,check,bearer,web,api}) {
  assert.equal(new URL(web).hostname,'localhost');assert.equal(new URL(api).hostname,'localhost');
  const get=async url=>{const r=await request(url,{headers:bearer});assert.ok(r.ok,`Read failed: ${r.status}`);return r.json();};
  const send=(url,body)=>request(url,{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const dossiers=await get(web+'/api/cases');
  const item=dossiers.find(c=>c.documents.some(d=>d.originalAvailable&&d.name==='datev-lodas-2025-robert-muster.pdf'));
  assert.ok(item,'An existing approved Robert-Muster original is required');
  const doc=item.documents.find(d=>d.originalAvailable&&d.name==='datev-lodas-2025-robert-muster.pdf');
  const root=`${web}/api/cases/${item.id}/platform/research`;
  check((await request(root)).status===401,'Research catalogue requires Bearer token');
  check((await request(`${api}/api/cases/${item.id}/platform/research`)).status===401,'Direct Java research API requires Bearer token');
  let snapshot=await get(root);check(snapshot.caseId===item.id&&snapshot.persistent,'Source research reads the authenticated persistent dossier');
  check(snapshot.documents.every(d=>item.documents.some(original=>original.id===d.id&&original.originalAvailable)),'Research inventory includes actual originals only');
  const body={caseVersion:item.version,name:'Local acceptance · independently checked DATEV',fields:[
    {documentId:doc.id,page:1,field:'netIncome',expected:'2.967,11'},
    {documentId:doc.id,page:1,field:'payoutAmount',expected:'deliberate-mismatch-for-test'},
    {documentId:doc.id,page:1,field:'testOnlyMissingField',expected:'deliberate-missing-reference'},
  ],questions:[{question:'Netto-Verdienst and Auszahlungsbetrag Robert-Muster',documentId:doc.id,page:1}],sourceChecked:true};
  check((await send(root+'/datasets',{...body,caseVersion:item.version+100})).status===409,'Stale dossier version cannot save references');
  check((await send(root+'/datasets',{...body,sourceChecked:false})).status===400,'Source-check acknowledgment is required');
  check((await send(root+'/datasets',{...body,fields:[{...body.fields[0],documentId:'foreign-document'}]})).status===422,'Foreign original cannot be labelled');
  check((await send(root+'/datasets',{...body,fields:[body.fields[0],body.fields[0]]})).status===422,'Duplicate field keys are rejected');
  let response=await send(root+'/datasets',body);check(response.ok,'Checked reference version saved through web proxy');const dataset=await response.json();
  const runBody={caseVersion:item.version,datasetId:dataset.id,suite:'EXTRACTION'};
  async function run(suite) {
    const r=await send(root+'/runs',{...runBody,suite});check(r.status===202,`${suite}: durable experiment accepted immediately`);const job=await r.json();
    const until=Date.now()+180000;
    while(Date.now()<until){const state=await get(root),current=state.jobs.find(j=>j.id===job.id);assert.notEqual(current?.status,'FAILED',current?.errorCode);if(current?.status==='COMPLETE'){const report=state.runs.find(r=>r.id===job.id);assert.ok(report);return report;}await new Promise(resolve=>setTimeout(resolve,2500));}
    throw new Error('Research worker did not finish within the acceptance window');
  }
  const extraction=await run('EXTRACTION'),metrics=extraction.variants[0].metrics;
  check(metrics.truePositive===1&&metrics.falsePositive===1&&metrics.falseNegative===2&&metrics.f1===40,'Metrics retain correct, mismatched and missing DATEV fields');
  check(extraction.azureCalls===0&&extraction.sourceHash===snapshot.sourceHash,'Run is source-bound and makes no new Azure request');
  const retrieval=await run('RETRIEVAL');check(retrieval.suite==='RETRIEVAL','Retrieval comparison executes on original page chunks');
  check(retrieval.variants.map(v=>v.method).join(',')==='BM25,VECTOR,HYBRID','BM25, vector and hybrid variants measured');
  check(retrieval.variants.every(v=>v.metrics.hitRateAt5===100&&v.rows.every(row=>row.hits.every(hit=>item.documents.some(d=>d.id===hit.documentId&&d.originalAvailable)))),'Retrieval hits only original evidence, never generated policy or summaries');
  const other=dossiers.find(c=>c.id!==item.id);assert.ok(other);
  check((await send(`${web}/api/cases/${other.id}/platform/research/runs`,{...runBody,caseVersion:other.version})).status===404,'Reference ID cannot cross dossier scope');
  response=await send(root+'/export',{caseVersion:item.version});check(response.ok,'Explicit private research export available');const bundle=await response.json();
  check(bundle.cloudUploaded===false&&bundle.destination==='browser-download-only','Export does not claim a Blob, ADF or Foundry connection');
  check(bundle.bronze.every(d=>d.originalIncluded===false)&&bundle.silver.some(d=>d.documentId===doc.id&&d.pages.length>0),'Research bundle includes actual extraction but no private PDF bytes');
  check(bundle.evaluationInputs.some(q=>q.documentId===doc.id&&q.context.length>0&&!('response' in q)),'JSONL-ready evaluation inputs contain real source context, not fabricated LLM responses');
  snapshot=await get(root);check(snapshot.datasets.some(d=>d.id===dataset.id)&&snapshot.runs.some(r=>r.id===extraction.id)&&snapshot.exports.some(e=>e.id===bundle.id),'Fresh authenticated read restores datasets, runs and export audit');
  const sql="SELECT count(*) FROM lab_records WHERE kind='document-experiment' AND id='"+extraction.id+"'";
  check(execFileSync('docker',['compose','exec','-T','case-db','psql','-U','credit_lab','-d','credit_cases','-At','-c',sql],{encoding:'utf8'}).trim()==='1','Experiment independently confirmed in PostgreSQL');
  const jobSql="SELECT payload::jsonb->>'status' FROM lab_records WHERE kind='document-experiment-job' AND id='"+retrieval.id+"'";
  check(execFileSync('docker',['compose','exec','-T','case-db','psql','-U','credit_lab','-d','credit_cases','-At','-c',jobSql],{encoding:'utf8'}).trim()==='COMPLETE','Completed durable job independently confirmed in PostgreSQL');
}
