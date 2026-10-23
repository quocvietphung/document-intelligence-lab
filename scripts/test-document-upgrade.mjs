import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {workflowPdfSamples,workflowPdfExample} from '../lib/ai-pdf-examples.ts';

// Explicit local acceptance on a real, previously scanned PDF. No Azure calls or invented scores.
export async function auditDocumentUpgrade({request,check,bearer,web,api}){
  assert.equal(new URL(web).hostname,'localhost');assert.equal(new URL(api).hostname,'localhost');
  const send=(url,body)=>request(url,{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const get=async url=>{const response=await request(url,{headers:bearer});assert.ok(response.ok,`Authenticated read HTTP ${response.status}`);return response.json();};
  const caseId=process.env.TEST_UPGRADE_CASE||'CR-485a8c32-047',root=`${web}/api/cases/${caseId}`,research=root+'/platform/research',etl=root+'/platform/etl';
  const item=await get(root),doc=item.documents.find(d=>d.name==='kaggle-invoice-51109301.pdf'&&d.originalAvailable);
  assert.ok(doc,'Prepare the pinned invoice through Docling before this acceptance');
  check(doc.analysisProvider==='docling','Invoice has actual Docling provenance, not fixed reference values');
  check((await request(etl)).status===401,'ETL requires Bearer authentication');
  check((await request(`${api}/api/cases/${caseId}/platform/etl`)).status===401,'Direct Java ETL also requires authentication');
  check((await send(etl,{caseVersion:item.version,requestId:randomUUID(),consent:false})).status===400,'ETL requires explicit private-data consent');
  check((await send(etl,{caseVersion:item.version+1,requestId:randomUUID(),consent:true})).status===409,'Stale source versions cannot enqueue analytics');
  const datasetResponse=await send(research+'/datasets',{caseVersion:item.version,name:'Invoice 51109301 · checked upgrade reference',sourceChecked:true,
    fields:[{documentId:doc.id,page:1,field:'invoiceNumber',expected:'51109301'}],questions:[{documentId:doc.id,page:1,question:'What invoice number is stated in the original document?'}]});
  check(datasetResponse.ok,'Independent PDF field/page reference saved');const dataset=await datasetResponse.json();
  const observed=[];
  for(const suite of ['EXTRACTION','RETRIEVAL','CHUNKING',...(process.env.TEST_PROMPTING==='1'?['PROMPTING']:[])]){
    const queued=await send(research+'/runs',{caseVersion:item.version,datasetId:dataset.id,suite});check(queued.status===202,`${suite}: durable run queued`);const job=await queued.json();
    let report;const deadline=Date.now()+480000;
    while(Date.now()<deadline){const state=await get(research),current=state.jobs.find(j=>j.id===job.id);assert.notEqual(current?.status,'FAILED',current?.errorCode);report=state.runs.find(r=>r.id===job.id);if(report)break;await new Promise(resolve=>setTimeout(resolve,2000));}
    assert.ok(report,`${suite}: run completed within deadline`);check(report.azureCalls===0&&report.sourceHash===dataset.sourceHash,`${suite}: result tied to the same PDF fingerprint, no cloud call`);
    if(suite==='CHUNKING')check(['FIXED','RECURSIVE','SEMANTIC','HIERARCHICAL'].every(method=>report.variants.some(v=>v.method===method&&v.chunks>0)), 'All four real chunking strategies measured without replacing the live index');
    if(suite==='PROMPTING'){
      check(report.localModelCalls===2&&report.variants.length===2,'Two actual local prompt variants recorded');
      check(report.variants.every(v=>v.metrics.schemaValidity===100),'Both real prompt variants return valid schema-constrained output');
      // A comparison is allowed to show that few-shot is worse. Recompute every score
      // independently; an abstention or wrong answer must remain a measured failure.
      for(const variant of report.variants){const row=variant.rows[0],page=doc.pages.find(p=>p.number===1);
        const supported=Boolean(row.actual&&row.quote&&page.text.includes(row.quote)&&row.quote.includes(row.actual)&&row.sourceId===doc.id+':p1');
        const correct=supported&&row.actual==='51109301';
        check(variant.metrics.sourceQuoteMatch===(supported?100:0)&&variant.metrics.exactMatch===(correct?100:0)&&row.passed===correct,variant.method+': scores independently match actual PDF evidence; failures are not relabelled as passes');
      }
      check(report.variants.some(v=>v.metrics.exactMatch===100),'At least one actual local variant matches the independent original; no universal few-shot improvement claimed');
    }
    observed.push({suite,id:report.id,variants:report.variants.map(v=>({method:v.method,metrics:v.metrics,chunks:v.chunks}))});
  }
  const configuration=await get(etl);check(configuration.workerReady&&configuration.cloudCalls===0,'Private offline Docker ETL worker ready');
  const body={caseVersion:item.version,requestId:randomUUID(),consent:true};const queued=await send(etl,body);check(queued.status===202,'ETL accepted with consent');const receipt=await queued.json();
  const repeated=await send(etl,body);check(repeated.ok&&(await repeated.json()).id===receipt.id,'Same request preserves its original receipt');
  let finished;const deadline=Date.now()+240000;
  while(Date.now()<deadline){const state=await get(etl);finished=state.runs.find(r=>r.id===receipt.id);assert.ok(!['FAILED','STALE'].includes(finished?.status),finished?.errorCode);if(finished?.status==='COMPLETE')break;await new Promise(resolve=>setTimeout(resolve,2000));}
  check(finished?.status==='COMPLETE'&&finished.result.dbtVerified,'Real DuckDB transforms and dbt checks completed');
  check(finished.result.method==='document-medallion-v2','Current ETL normalization method, not a reused v1 receipt');
  check(finished.result.documents.some(d=>d.id===doc.id)&&finished.result.bronze>=1&&finished.result.silver>=2,'Bronze/Silver contain the actual extracted invoice');
  if(item.documents.every(d=>d.status!=='verified'))check(finished.result.gold===0,'Unreviewed evidence is excluded from Gold, not silently approved');
  check(finished.result.qualityIssues.some(q=>q.code==='AMBIGUOUS_DATE_PRESERVED'),'Day/month ambiguity is recorded, not guessed');
  for(const layer of ['bronze','silver','gold']){
    const url=etl+'/'+receipt.id+'/'+layer;check((await request(url)).status===401,`${layer}: private Parquet requires a token`);
    const response=await request(url,{headers:bearer}),bytes=Buffer.from(await response.arrayBuffer());
    check(response.ok&&bytes.subarray(0,4).toString()==='PAR1',`${layer}: real Parquet download, not JSON renamed as Parquet`);
    check(createHash('sha256').update(bytes).digest('hex')===finished.result.artifacts.find(a=>a.name===layer+'.parquet').sha256,`${layer}: artifact integrity matches its receipt`);
  }
  const reuse=await send(etl,{...body,requestId:randomUUID()});check(reuse.ok&&(await reuse.json()).id===receipt.id,'Unchanged evidence reuses its previous ETL result');
  const capabilities=await get(web+'/api/cases/ai-capabilities');
  const report={time:new Date().toISOString(),caseId,document:doc.name,sourceFingerprint:dataset.sourceHash,referenceId:dataset.id,configuredChat:capabilities.chat,
    experiments:observed,etlId:receipt.id,artifacts:finished.result.artifacts,counts:{bronze:finished.result.bronze,silver:finished.result.silver,gold:finished.result.gold},
    examples:Object.keys(workflowPdfSamples).map(id=>({id,...workflowPdfExample(id,'en'),verification:['document','tables','search','embeddings','experiments','lineage'].includes(id)?'See scoped measured checks in this report':'Not executed by this acceptance script'})),
    scope:'One synthetic invoice and explicit local checks, not a claim that all models, workflows or arbitrary PDFs pass'};
  mkdirSync('.local/verification',{recursive:true});writeFileSync('.local/verification/document-upgrade-latest.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({caseId,document:doc.name,referenceId:dataset.id,experiments:observed,etlId:receipt.id,counts:report.counts,report:'.local/verification/document-upgrade-latest.json',scope:report.scope}));
}
