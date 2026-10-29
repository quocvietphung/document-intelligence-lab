import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';

/** Explicit local acceptance. Uses existing auth, antivirus, Docling, queue and research API. */
export async function auditRagPdfs({request,check,bearer,web,api}){
  assert.equal(new URL(web).hostname,'localhost');assert.equal(new URL(api).hostname,'localhost');
  const catalogue=JSON.parse(readFileSync('lib/rag-pdf-sources.json','utf8')).sources,pack=JSON.parse(readFileSync('lib/rag-pdf-questions.json','utf8'));
  const checkpoint='.local/rag-benchmark/production-case.json',mode=process.env.TEST_RAG_PDFS;
  const get=async(url)=>{const response=await request(url,{headers:bearer});assert.ok(response.ok,`Read failed: ${response.status}`);return response.json();};
  const send=(url,body)=>request(url,{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify(body)});
  let caseId=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint)).caseId:undefined;
  if(!caseId){const r=await send(web+'/api/cases',{applicant:'Multi-domain PDF retrieval evaluation',purpose:'Public forms and fictional source examples; no customer decisions; local RAG measurement',domain:'general',coApplicant:'',amountEuro:0,version:0});assert.equal(r.status,201);caseId=(await r.json()).id;writeFileSync(checkpoint,JSON.stringify({caseId}),{mode:0o600});}
  const root=web+'/api/cases/'+caseId;
  if(mode==='prepare'){
    const state=await get(root),platform=await get(root+'/platform');
    const pendingNames=new Set(platform.jobs.filter(j=>['QUEUED','PROCESSING','SCANNING','ANALYZING','RETRY_WAIT','STORED','EXTRACTED'].includes(j.status)).map(j=>j.filename||j.name));
    const missing=catalogue.filter(source=>!state.documents.some(d=>d.name===source.file)&&!pendingNames.has(source.file));
    // Four uploads per batch; originals are private and still pass ClamAV before Docling.
    for(let offset=0;offset<missing.length;offset+=4){
      const form=new FormData();form.set('requestId',randomUUID());form.set('name','Reviewed PDF source benchmark');form.set('source','Hash-pinned public forms / fictional references; publisher attribution retained');form.set('profile','general');
      for(const source of missing.slice(offset,offset+4)){const bytes=readFileSync(source.preparedFile);assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);form.append('files',new Blob([bytes],{type:'application/pdf'}),source.file);}
      const r=await request(root+'/platform/batches',{method:'POST',headers:bearer,body:form});assert.equal(r.status,202,'Source batch must enter the authenticated queue');
    }
    const deadline=Date.now()+900000;let current;
    while(Date.now()<deadline){current=await get(root);if(catalogue.every(s=>current.documents.some(d=>d.name===s.file&&d.originalAvailable)))break;const p=await get(root+'/platform');const latest=new Map();for(const job of p.jobs)if(!latest.has(job.sha256))latest.set(job.sha256,job);const failed=[...latest.values()].filter(j=>j.status==='FAILED'&&catalogue.some(s=>s.sha256===j.sha256)&&!current.documents.some(d=>d.name===j.name));assert.equal(failed.length,0,'A failed PDF must not be reported as prepared');await new Promise(resolve=>setTimeout(resolve,5000));}
    check(catalogue.every(s=>current.documents.some(d=>d.name===s.file&&d.originalAvailable&&d.analysisProvider==='docling')),'Nine pinned PDF originals pass the local intake and actual Docling extraction');
    const platformAfter=await get(root+'/platform');check(platformAfter.jobs.filter(j=>j.scan_result==='CLAMAV_CLEAN').length>=9,'All nine originals passed enabled ClamAV scanning');
    console.log('PDF preview: '+web+'/en?case='+caseId+'#documents');return;
  }
  const item=await get(root);const mapping=new Map();
  for(const source of catalogue){const document=item.documents.find(d=>d.name===source.file&&d.originalAvailable);assert.ok(document,'Prepare each PDF before measuring');const r=await request(root+'/documents/'+document.id+'/original',{headers:bearer});assert.ok(r.ok);assert.equal(createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),source.sha256);mapping.set(source.id,document);}
  check(mapping.size===9,'Authenticated originals match all nine pinned source hashes');
  const questions=pack.questions.map(q=>{const relevant=q.relevant.map(s=>({documentId:mapping.get(s.sourceId).id,page:s.page}));return {question:q.question,documentId:relevant[0]?.documentId||'',page:relevant[0]?.page||0,relevant,answerable:q.answerable,split:q.split,locale:q.locale};});
  const research=root+'/platform/research',name='Reviewed PDF RAG · 77 questions · local v2';let snapshot=await get(research),reference=snapshot.datasets.find(d=>d.name===name&&d.sourceHash===snapshot.sourceHash);
  if(!reference){const response=await send(research+'/datasets',{caseVersion:item.version,name,fields:[],questions,sourceChecked:true});assert.ok(response.ok,`Reference save failed: ${response.status}`);reference=await response.json();}
  check(reference.questions.length===77,'Multi-source and unanswered references persist with tune/held-out groups');
  const noAuth=await request(research);check(noAuth.status===401,'Research metrics still require a Bearer token');
  const bad=await send(research+'/datasets',{caseVersion:item.version,name:'Invalid foreign source',fields:[],questions:[{question:'Unknown source',relevant:[{documentId:'foreign',page:1}],answerable:true}],sourceChecked:true});check(bad.status===422,'Additional relevant pages cannot cross dossier scope');
  const response=await send(research+'/runs',{caseVersion:item.version,datasetId:reference.id,suite:'RETRIEVAL'});assert.equal(response.status,202);const job=await response.json();let report;
  const deadline=Date.now()+300000;
  while(Date.now()<deadline){snapshot=await get(research);const current=snapshot.jobs.find(j=>j.id===job.id);assert.notEqual(current?.status,'FAILED',current?.errorCode);if(current?.status==='COMPLETE'){report=snapshot.runs.find(r=>r.id===job.id);break;}await new Promise(resolve=>setTimeout(resolve,2500));}
  assert.ok(report);check(report.variants.length===5&&report.variants.every(v=>v.groups.length===2),'Five real ranking variants retain separate tuning and held-out metrics');
  check(report.azureCalls===0&&report.variants.every(v=>v.metrics.unanswerableQuestions===8),'Eight unanswered questions remain explicit; no Azure or LLM judge score is invented');
  writeFileSync('.local/rag-benchmark/docling-results.json',JSON.stringify({format:'rag-pdf-production-results-v1',extraction:'Actual ClamAV → Docling → PostgreSQL → Java ranking; ranking metrics use isolated local corpus, not Qdrant latency',labelProvenance:pack.labelProvenance,scope:pack.scope,sourceHashes:Object.fromEntries(catalogue.map(s=>[s.id,s.sha256])),caseId,report},null,2),{mode:0o600});
  console.log('RAG preview: '+web+'/en?case='+caseId+'#experiments');
}
