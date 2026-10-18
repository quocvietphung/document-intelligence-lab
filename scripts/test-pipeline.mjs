import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

// Local opt-in acceptance. Creates one test dossier, processes a pinned Kaggle
// invoice, tests cancellation and blocks a non-executable active-content marker.
export async function auditPipeline({request,check,bearer,web,api}){
  assert.equal(new URL(web).hostname,'localhost');assert.equal(new URL(api).hostname,'localhost');
  const send=(url,body)=>request(url,{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const get=async url=>{const r=await request(url,{headers:bearer});assert.ok(r.ok,'Authenticated read: '+r.status);return r.json();};
  const created=await send(web+'/api/cases',{applicant:'Kaggle · Pipeline verification',domain:'general',purpose:'Controlled pipeline acceptance using Kaggle invoices and an inert rejected-input security test. No financial decisions.',coApplicant:'',amountEuro:0,version:0});
  check(created.status===201,'Created isolated local pipeline test dossier');const item=await created.json();const root=web+'/api/cases/'+item.id,platform=root+'/platform';
  check((await request(platform)).status===401,'Pipeline status requires Bearer token');
  check((await request(platform+'/jobs/missing/cancel',{method:'POST'})).status===401,'Cancellation requires Bearer token');
  check((await send(platform+'/jobs/missing/cancel',{})).status===404,'Unknown/cross-scope job unavailable');
  check((await request(platform+'/jobs/missing/cancel',{headers:bearer})).status===405,'Cancellation is POST only');
  const samples=JSON.parse(readFileSync('lib/kaggle-reference-catalog.json','utf8')).filter(s=>s.domain==='general');
  async function upload(bytes,name){const form=new FormData();form.set('file',new Blob([bytes],{type:'application/pdf'}),name);return request(platform+'/jobs',{method:'POST',headers:bearer,body:form});}
  async function sampleBytes(sample){const r=await request(web+'/api/research-references?sample='+sample.id,{headers:bearer});assert.ok(r.ok);return Buffer.from(await r.arrayBuffer());}
  async function wait(id){const until=Date.now()+180000;while(Date.now()<until){const job=(await get(platform)).jobs.find(j=>j.id===id);if(job&&['COMPLETE','FAILED','CANCELLED'].includes(job.status))return job;await new Promise(resolve=>setTimeout(resolve,1500));}throw Error('Pipeline timed out');}
  const source=await sampleBytes(samples[0]);const queued=await upload(source,samples[0].file);check(queued.status===202,'Kaggle invoice queued');const receipt=await queued.json();
  check((await upload(source,samples[0].file)).status===409,'Duplicate bytes are not queued twice');
  const job=await wait(receipt.id);check(job.status==='COMPLETE','Kaggle extraction complete');
  check(job.scan_result==='CLAMAV_CLEAN','ClamAV scanned original');
  check(['RECEIVED','SCAN','EXTRACT','VALIDATE','ATTACH','HUMAN_REVIEW'].every(stage=>job.events.some(e=>e.stage===stage)),'All six stages have recorded database events');
  check(job.events.every((e,i)=>i===0||e.id>job.events[i-1].id),'Stage event IDs preserve recorded order');
  check(job.extraction.provider==='azure-document-intelligence'&&job.extraction.modelId==='prebuilt-layout','Actual Azure extraction provenance');
  check(job.extraction.pages===1&&job.extraction.tables===2&&job.extraction.fields>=1,'Persisted page, field and table counts');
  check(job.reviewStatus!=='verified','Pipeline never approves AI values as human-reviewed');
  check(Boolean(job.finishedAt)&&Date.parse(job.finishedAt)>=Date.parse(job.createdAt),'Completion timestamp is recorded');
  check(job.sha256===samples[0].sha256,'Pipeline preserves pinned source hash');
  const original=await request(root+'/documents/'+job.document_id+'/original',{headers:bearer});
  check(createHash('sha256').update(Buffer.from(await original.arrayBuffer())).digest('hex')===job.sha256,'Stored original matches hash');
  check((await send(platform+'/jobs/'+job.id+'/cancel',{})).status===409,'Completed job cannot be cancelled');
  check((await send(platform+'/jobs/'+job.id+'/retry',{})).status===409,'Completed job cannot be retried');
  let cancelled=false;
  for(const sample of samples.slice(1)){
    const pending=await upload(await sampleBytes(sample),sample.file);assert.equal(pending.status,202);const task=await pending.json();
    const result=await send(platform+'/jobs/'+task.id+'/cancel',{});
    if(result.ok){const saved=await wait(task.id);check(saved.status==='CANCELLED'&&saved.events.at(-1).status==='CANCELLED','Queued job cancellation persists with history');check(saved.document_id===null&&!saved.canCancel,'Cancelled waiting job did not create evidence');cancelled=true;break;}
    check(result.status===409,'A worker-start race does not pretend cancellation succeeded');await wait(task.id);
  }
  check(cancelled,'At least one waiting Kaggle job cancelled successfully');
  const rejected=await upload(Buffer.from('%PDF-1.7\n/JavaScript\nInert test marker, not an executable PDF'),'rejected-input-control.pdf');assert.equal(rejected.status,202);const bad=await wait((await rejected.json()).id);
  check(bad.status==='FAILED'&&bad.error_code==='ACTIVE_CONTENT_BLOCKED','Active-content marker is blocked before analysis');
  check(bad.attempt===1&&!bad.nextAttemptAt,'Security failure is not automatically retried');
  check(!bad.retryEligible&&(await send(platform+'/jobs/'+bad.id+'/retry',{})).status===409,'Blocked content cannot use manual retry');
  check(!bad.extraction&&bad.document_id===null,'Blocked input produces no invented extraction');
  console.log('Pipeline preview: '+web+'/en?case='+item.id+'#pipeline');
}
