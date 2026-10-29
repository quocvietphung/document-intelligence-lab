import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

/** Existing labelled originals only; real offline inspection, no Azure request. */
export async function auditEvidenceQuality({request,check,bearer,web,api}){
  assert.equal(new URL(web).hostname,'localhost');assert.equal(new URL(api).hostname,'localhost');
  const id=process.env.TEST_QUALITY_CASE||'CR-cb06572e-ed8',root=web+'/api/cases/'+id;
  const caseResponse=await request(root,{headers:bearer});assert.equal(caseResponse.status,200,'Dossier API must be ready before quality acceptance');const item=await caseResponse.json();
  const tagged=item.documents.find(d=>d.name==='structure-regression.pdf'),scan=item.documents.find(d=>d.name==='scanned-skew-regression.pdf');
  assert.ok(tagged?.originalAvailable&&scan?.originalAvailable,'Run TEST_DOCUMENT_STRUCTURE=1 first or set TEST_QUALITY_CASE to its printed dossier');
  if(process.env.TEST_QUALITY_NOVA_CANCEL==='only'){await auditNovaCancellation({request,check,bearer,web,api,id,tagged,region:tagged.pages[0].regions.find(r=>r.text==='8,500')});return;}
  const endpoint=root+'/platform/inspection',post=(body)=>request(endpoint,{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify(body)});
  check((await request(endpoint)).status===401,'Inspection endpoint requires an access token');
  const state=await (await request(endpoint,{headers:bearer})).json();check(state.enabled&&state.workerReady,'Existing offline worker is ready for Python inspection');
  const region=tagged.pages[0].regions.find(r=>r.text==='8,500');assert.ok(region);
  const body={requestId:randomUUID(),caseVersion:item.version,documentId:tagged.id,page:1,value:region.text,sourceId:region.id,consent:true};
  check((await post({...body,consent:false})).status===400,'Inspection refuses missing consent');
  const altered=await post({...body,value:'3,500'});assert.equal(altered.status,422,await altered.text());check(true,'A client cannot replace the stored occurrence text');
  const queued=await post(body);check(queued.status===202,'Exact stored occurrence enters the private inspection spool');const run=await queued.json();
  check((await (await post(body)).json()).id===run.id,'Replayed request reuses the same receipt');
  check((await post({...body,value:'500'})).status===409,'A reused request ID cannot change the evidence');
  async function finished(runId){const deadline=Date.now()+170000;while(Date.now()<deadline){const data=await (await request(endpoint,{headers:bearer})).json();const current=data.runs.find(r=>r.id===runId);if(current&&current.status!=='QUEUED'){assert.equal(current.status,'COMPLETE',current.errorCode);return current;}await new Promise(resolve=>setTimeout(resolve,1500));}throw Error('Inspection did not complete');}
  const done=await finished(run.id);check(done.current&&done.result.candidates.length===1,'Python located the stored amount in the actual original');
  check(done.result.comparison.independentOcrText.includes('8,500')&&done.result.comparison.status==='AGREEMENT_NOT_VERIFIED','Actual Tesseract crop agrees without granting verification');
  const report=await request(endpoint+'/'+run.id+'/report',{headers:bearer});check(report.status===200&&report.headers.get('cache-control')==='no-store','Private report is authorized and never cached');
  const receipt=await report.json();check(receipt.originalIncluded===false&&receipt.document.ocrCorrections.length===tagged.ocrCorrections.length,'Report includes immutable correction history without embedding the whole PDF');
  const skewRequest={requestId:randomUUID(),caseVersion:item.version,documentId:scan.id,page:2,value:'Total: $500',consent:true};
  const skewQueued=await post(skewRequest);check(skewQueued.status===202,'Image-only skewed PDF uses the same existing queue');
  const skew=await finished((await skewQueued.json()).id);
  check(skew.result.candidates.length===4&&skew.result.candidates.every(c=>c.method==='tesseract'),'Four repeated scan values remain four explicit candidates');
  check(skew.result.coordinate_space==='displayed-page-normalized-top-left'&&skew.result.humanReviewRequired,'Original-page geometry remains unverified evidence');
  const cancelledId=randomUUID(),cancelUrl=root+'/platform/nova-runs/'+cancelledId;
  const cancelled=await request(cancelUrl+'/cancel',{method:'POST',headers:bearer});check(cancelled.status===200,'Owner can cancel a request before dispatch');
  const rejected=await request(api+'/api/assistant/chat',{method:'POST',headers:{...bearer,'Content-Type':'application/json','X-Nova-Request-Id':cancelledId},body:JSON.stringify({caseId:id,locale:'en',question:'Explain the recorded amount'})});
  check(rejected.status===409,'A cancelled request ID never reaches model dispatch');
  if(process.env.TEST_QUALITY_RETRIEVAL==='1'){
    const questions=['What is the inspection amount in USD?','Wie hoch ist der Prüfungsbetrag in USD?','Số tiền kiểm tra bằng USD là bao nhiêu?'].map(question=>({question,documentId:tagged.id,page:1}));
    const headers={...bearer,'Content-Type':'application/json'};
    const response=await request(root+'/platform/research/datasets',{method:'POST',headers,body:JSON.stringify({caseVersion:item.version,name:'Synthetic PDF quality EN-DE-VI',fields:[],questions,sourceChecked:true})});
    assert.equal(response.status,200);const dataset=await response.json();
    const submitted=await request(root+'/platform/research/runs',{method:'POST',headers,body:JSON.stringify({caseVersion:item.version,datasetId:dataset.id,suite:'RETRIEVAL'})});assert.equal(submitted.status,202);const job=await submitted.json();
    let measured;for(let n=0;n<90;n++){const state=await (await request(root+'/platform/research',{headers:bearer})).json();measured=state.runs.find(r=>r.id===job.id);if(measured)break;const failed=state.jobs.find(r=>r.id===job.id&&r.status==='FAILED');assert.ok(!failed,failed?.errorCode);await new Promise(resolve=>setTimeout(resolve,1000));}
    assert.ok(measured);assert.equal(measured.azureCalls,0);assert.equal(measured.localModelCalls,0);assert.ok(measured.variants.every(v=>v.samples===3&&v.rows.length===3));
    const report={format:'synthetic-multilingual-retrieval-v1',sourceExample:tagged.name,scope:'Three questions; one labelled original document/page per question; not representative multilingual accuracy',configuration:measured.configuration,variants:measured.variants.map(v=>({method:v.method,samples:v.samples,metrics:v.metrics,questions:v.rows.map((r,i)=>({locale:['en','de','vi'][i],rank:r.rank,passed:r.passed}))}))};
    const {writeFileSync}=await import('node:fs');writeFileSync('.local/multilingual-retrieval.json',JSON.stringify(report,null,2),{mode:0o600});
    check(true,'Actual original PDF has measured EN/DE/VI retrieval examples without an LLM/cloud call');
  }
  if(process.env.TEST_QUALITY_RESTART_RUNS==='1'){
    const {execFileSync}=await import('node:child_process');const {localCompose}=await import('./docker-local.mjs');const {args,env}=localCompose();
    execFileSync('docker',[...args,'restart','credit-api'],{env,stdio:'ignore'});
    let ready=false;for(let i=0;i<90;i++){try{ready=(await request(api+'/actuator/health')).ok;}catch{}if(ready)break;await new Promise(resolve=>setTimeout(resolve,1000));}
    assert.ok(ready,'API becomes healthy after restart');
    const persisted=await (await request(root+'/platform/nova-runs/'+cancelledId,{headers:bearer})).json();
    check(persisted.status==='CANCELLED_BEFORE_START'&&persisted.runtimeScope==='postgresql','Nova cancellation metadata survives a real API container restart');
    const duplicate=await request(api+'/api/assistant/chat',{method:'POST',headers:{...bearer,'Content-Type':'application/json','X-Nova-Request-Id':cancelledId},body:JSON.stringify({caseId:id,locale:'en',question:'Explain the recorded amount'})});
    check(duplicate.status===409,'Restart cannot redispatch an already cancelled request ID');
  }
  if(process.env.TEST_QUALITY_NOVA_CANCEL==='1')await auditNovaCancellation({request,check,bearer,web,api,id,tagged,region});
  console.log('Quality preview: '+web+'/en?case='+id+'#documents');
}

async function auditNovaCancellation({request,check,bearer,web,api,id,tagged,region}){
  const root=web+'/api/cases/'+id;
    const capabilities=await (await request(api+'/api/cases/ai-capabilities',{headers:bearer})).json();assert.equal(capabilities.chat.provider,'ollama','Live cancellation test refuses cloud inference');
    const liveId=randomUUID();const pending=request(api+'/api/assistant/chat',{method:'POST',headers:{...bearer,'Content-Type':'application/json','X-Nova-Request-Id':liveId},body:JSON.stringify({caseId:id,locale:'en',question:`Explain the recorded amount and its table context [${tagged.id}:p1:${region.id}]`})});
    let live;for(let i=0;i<100;i++){const r=await request(root+'/platform/nova-runs/'+liveId,{headers:bearer});if(r.ok){live=await r.json();if(live.phase==='GENERATING')break;}await new Promise(resolve=>setTimeout(resolve,200));}
    assert.equal(live?.phase,'GENERATING');assert.equal(live?.status,'RUNNING');const response=await request(root+'/platform/nova-runs/'+liveId+'/cancel',{method:'POST',headers:bearer});assert.equal(response.status,200);
    await pending;const final=await (await request(root+'/platform/nova-runs/'+liveId,{headers:bearer})).json();
    check(final.status==='RESPONSE_DISCARDED'&&final.providerStopConfirmed===false,'Actual local cancellation discards output and does not claim provider stop confirmation');
}
