import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';

// Opt-in local acceptance against an existing permitted PDF. No new review/approval or LLM call.
export async function auditDocumentAnalytics({request,check,bearer,web,api}){
  assert.equal(new URL(web).hostname,'localhost');assert.equal(new URL(api).hostname,'localhost');
  const caseId=process.env.TEST_ANALYTICS_CASE||'CR-485a8c32-047',root=`${web}/api/cases/${caseId}`,etl=root+'/platform/etl',analytics=root+'/platform/analytics';
  const get=async url=>{const response=await request(url,{headers:bearer});assert.ok(response.ok,`Authenticated read HTTP ${response.status}`);return response.json();};
  const send=(url,body)=>request(url,{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify(body)});
  check((await request(analytics)).status===401,'Analytics UI proxy requires a Bearer token');
  check((await request(`${api}/api/cases/${caseId}/platform/analytics`)).status===401,'Direct Java analytics also requires a Bearer token');
  const before=await get(root),doc=before.documents.find(d=>d.originalAvailable&&d.analysisProvider==='docling');assert.ok(doc,'Prepare a real Docling PDF before this acceptance');
  const original=await request(root+`/documents/${doc.id}/original`,{headers:bearer});check(original.ok,'Existing original remains privately accessible');
  const bytes=Buffer.from(await original.arrayBuffer());check(bytes.subarray(0,5).toString()==='%PDF-','Evidence source is an actual PDF');
  const requestId=randomUUID();const created=await send(etl,{requestId,caseVersion:before.version,consent:true});check(created.status===202,'Current ETL snapshot queued');const receipt=await created.json();
  let run;const deadline=Date.now()+180000;
  while(Date.now()<deadline){const state=await get(etl);run=state.runs.find(r=>r.id===receipt.id);assert.ok(!['FAILED','STALE'].includes(run?.status),run?.errorCode);if(run?.status==='COMPLETE')break;await new Promise(resolve=>setTimeout(resolve,1500));}
  check(run?.status==='COMPLETE'&&run.result.method==='document-medallion-v3','Versioned analytical tables completed through real Docker ETL/dbt');
  for(const name of ['document-facts','field-observations','invoice-lines','quality-findings']){
    const exported=await request(etl+`/${run.id}/${name}`,{headers:bearer});check(exported.ok&&Buffer.from(await exported.arrayBuffer()).subarray(0,4).toString()==='PAR1',`${name}: protected export contains actual Parquet bytes`);
  }
  const projected=await get(analytics);check(projected.report?.id===run.id&&projected.report.result.analytics.sourceHash===run.sourceHash,'Analytics projection uses the exact current PDF fingerprint');
  check(projected.report.result.analytics.documents===before.documents.filter(d=>d.originalAvailable).length,'Document count is derived from actual dossier originals');
  check((await send(analytics,{requestId:randomUUID(),caseVersion:before.version+1,etlRunId:run.id,consent:true})).status===409,'Stale source versions cannot queue ML');
  check(projected.workerReady,'Optional offline ML worker is ready');
  const experimentId=randomUUID(),body={requestId:experimentId,caseVersion:before.version,etlRunId:run.id,consent:true};
  const queued=await send(analytics,body);check(queued.status===202,'Private cohort experiment queued with explicit consent');const job=await queued.json();
  const replay=await send(analytics,body);check(replay.status===202&&(await replay.json()).id===job.id,'Repeated experiment request returns its receipt');
  let experiment;const mlDeadline=Date.now()+120000;
  while(Date.now()<mlDeadline){const state=await get(analytics);experiment=state.experiments.find(r=>r.id===job.id);assert.ok(!['FAILED','STALE'].includes(experiment?.status),experiment?.errorCode);if(experiment?.status==='COMPLETE')break;await new Promise(resolve=>setTimeout(resolve,1500));}
  check(experiment?.status==='COMPLETE','Offline ML worker returned a validated, source-bound receipt');
  check(experiment.result.status==='INSUFFICIENT_BASELINE','Small PDF set explicitly abstains from statistical inference');
  check(experiment.result.precision===null&&experiment.result.recall===null&&experiment.result.prAuc===null,'Unlabelled PDF set has no fabricated anomaly accuracy');
  check(experiment.result.tracking==='RECORDED'&&experiment.result.trackingRunId,'Actual local MLflow run was persisted');
  const after=await get(root);check(after.version===before.version&&JSON.stringify(after.documents)===JSON.stringify(before.documents),'Analytics did not alter PDF evidence, OCR or review decisions');
  mkdirSync('.local',{recursive:true});writeFileSync('.local/document-analytics-acceptance.json',JSON.stringify({caseId,etlRunId:run.id,scope:run.scope,experimentId:job.id,pdfSha256:createHash('sha256').update(bytes).digest('hex'),analytics:projected.report.result.analytics,experiment:experiment.result},null,2),{mode:0o600});
  console.log('Local preview: '+web+'/en?case='+caseId+'&pipeline=assets#pipeline');
}
