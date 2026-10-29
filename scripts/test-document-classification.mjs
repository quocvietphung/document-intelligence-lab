import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';

// Explicit local acceptance. Uses bundled authored PDFs; never sends dossier text to a model.
export async function auditDocumentClassification({request,check,bearer,web,api}){
  assert.equal(new URL(web).hostname,'localhost');assert.equal(new URL(api).hostname,'localhost');
  const caseId=process.env.TEST_CLASSIFICATION_CASE||'CR-485a8c32-047',caseRoot=`${web}/api/cases/${caseId}`,root=caseRoot+'/platform/classification';
  const get=async url=>{const r=await request(url,{headers:bearer});assert.ok(r.ok,`Read HTTP ${r.status}`);return r.json();};
  const send=body=>request(root,{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify(body)});
  check((await request(root)).status===401,'Classification proxy requires Bearer authentication');
  check((await request(`${api}/api/cases/${caseId}/platform/classification`)).status===401,'Direct Java classification requires Bearer authentication');
  check((await request(root+'/documents/bench-0001')).status===401,'Benchmark PDF rendering is also authenticated');
  const before=await get(caseRoot),data=await get(root),input=await get(root+'/input');
  check(data.dataset.samples.length===66&&data.dataset.splitUnit==='template-family','Actual labelled PDF corpus and template-family split available');
  check(createHash('sha256').update(input.datasetJson).digest('hex')===data.datasetFingerprint,'Export matches the exact Java PDFBox/rule observations');
  const rows=JSON.parse(input.datasetJson),groups=new Map();
  for(const row of rows){assert.ok(!groups.has(row.group)||groups.get(row.group)===row.split);groups.set(row.group,row.split);}
  check(rows.length===66&&rows.filter(r=>r.split==='train').length===36,'Entire source families stay in a single split');
  for(const id of ['bench-0001','bench-0013','bench-0066']){
    const r=await request(root+'/documents/'+id,{headers:bearer}),bytes=Buffer.from(await r.arrayBuffer());const sample=data.dataset.samples.find(s=>s.id===id);
    check(r.ok&&bytes.subarray(0,5).toString()==='%PDF-'&&createHash('sha256').update(bytes).digest('hex')===sample.sha256,`${id}: actual PDF bytes match the labelled corpus hash`);
  }
  check(data.workerReady,'Existing optional local ML worker is ready');
  const body={requestId:randomUUID(),caseVersion:before.version,datasetFingerprint:data.datasetFingerprint,consent:true};
  check((await send({...body,consent:false})).status===400,'No benchmark starts without explicit consent');
  check((await send({...body,caseVersion:before.version+1})).status===409,'Changed dossier versions are rejected');
  check((await send({...body,datasetFingerprint:'0'.repeat(64)})).status===409,'Changed benchmark versions are rejected');
  const response=await send(body);check(response.status===202,'Classification queued through the real Java/file-spool boundary');const receipt=await response.json();
  const replay=await send(body);check(replay.status===202&&(await replay.json()).id===receipt.id,'Repeated request reuses its immutable receipt');
  let run;const deadline=Date.now()+120_000;
  while(Date.now()<deadline){const current=await get(root);run=current.runs.find(r=>r.id===receipt.id);assert.notEqual(run?.status,'FAILED',run?.errorCode);if(run?.status==='COMPLETE')break;await new Promise(resolve=>setTimeout(resolve,1500));}
  check(run?.status==='COMPLETE','Docker worker trained and evaluated the real PDF text');
  const report=run.result;check(report.datasetFingerprint===data.datasetFingerprint&&report.modelInputs.join()==='pageText','Result is dataset-bound and metadata is excluded from model features');
  check(report.scoreCalibrated===false&&report.documentTypesChanged===0&&report.cloudCalls===0,'Uncalibrated scores and research-only scope stay explicit');
  for(const split of ['test','validation'])for(const method of ['rule','model']){
    const observed=report.rows.filter(r=>r.split===split),key=method==='rule'?'ruleLabel':'modelLabel',metric=report.metrics[split][method];
    check(metric.samples===12&&metric.confusionMatrix.flat().reduce((a,b)=>a+b,0)===12,`${split}/${method}: every PDF is counted, including review cases`);
    for(const row of metric.perClass){const tp=observed.filter(r=>r.label===row.label&&r[key]===row.label).length,fp=observed.filter(r=>r.label!==row.label&&r[key]===row.label).length,fn=observed.filter(r=>r.label===row.label&&r[key]!==row.label).length;
      const p=tp+fp?tp/(tp+fp):0,r=tp+fn?tp/(tp+fn):0,f=p+r?2*p*r/(p+r):0;
      assert.ok(Math.abs(row.precision-p)<1e-12&&Math.abs(row.recall-r)<1e-12&&Math.abs(row.f1-f)<1e-12);}
  }
  check(report.rows.filter(r=>r.split==='test').every(r=>r.ruleType===rows.find(s=>s.id===r.id).ruleType),'Rule baseline is the actual Java output for the same PDFs');
  check(report.challenge.samples===6&&report.challenge.missedReview.length+report.challenge.reviewRouted===6,'Every challenge routing failure remains visible');
  check(report.tracking==='RECORDED'&&report.trackingRunId,'Actual local MLflow classification run persisted');
  const after=await get(caseRoot);check(after.version===before.version&&JSON.stringify(after.documents)===JSON.stringify(before.documents),'Benchmark changed no operational PDF, OCR, type or approval');
  mkdirSync('.local',{recursive:true});writeFileSync('.local/classification-acceptance.json',JSON.stringify({caseId,runId:run.id,datasetFingerprint:data.datasetFingerprint,report},null,2),{mode:0o600});
  console.log(`Local classification preview: ${web}/en?case=${caseId}#experiments`);
}
