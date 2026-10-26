import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

/** Explicit local acceptance: a new synthetic dossier, real scanned queue and actual Docling geometry.
 * The transcription is a labelled test annotation, not a claim that the engine made an OCR error.
 */
export async function auditEvidenceInspection({request,check,bearer,web,api}){
  assert.equal(new URL(web).hostname,'localhost');assert.equal(new URL(api).hostname,'localhost');
  const post=(url,body)=>request(url,{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const created=await post(web+'/api/cases',{applicant:'Synthetic source-location regression',purpose:'Repeated values, OCR transcription history and rotated-page abstention',amountEuro:0,coApplicant:'',version:0,domain:'general'});
  check(created.status===201,'Create isolated synthetic evidence dossier');let item=await created.json();
  const root=web+'/api/cases/'+item.id;
  const bytes=readFileSync('services/credit-api/src/test/resources/evidence/evidence-inspection-regression.pdf');
  const form=new FormData();form.set('requestId',randomUUID());form.set('name','Synthetic evidence regression');form.set('source','Self-authored MIT test fixture; not customer data');form.set('profile','general');form.append('files',new Blob([bytes],{type:'application/pdf'}),'evidence-inspection-regression.pdf');
  const queued=await request(root+'/platform/batches',{method:'POST',headers:bearer,body:form});check(queued.status===202,'Submit synthetic PDF through authenticated ClamAV/Docling queue');
  const deadline=Date.now()+240000;
  while(Date.now()<deadline){
    const response=await request(root,{headers:bearer});assert.ok(response.ok);item=await response.json();
    if(item.documents?.length)break;
    const platform=await (await request(root+'/platform',{headers:bearer})).json();
    assert.ok(!platform.jobs.some(j=>j.status==='FAILED'),'Synthetic extraction must not fail');
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  const doc=item.documents[0];assert.ok(doc,'Docling completed within deadline');
  check(doc.analysisProvider==='docling'&&doc.pages.length===2,'Actual Docling extracted both original pages');
  const duplicates=doc.pages[0].regions.filter(r=>r.text.includes('$500'));
  check(duplicates.length>=4&&new Set(duplicates.map(r=>r.id)).size===duplicates.length,'Repeated amount retains distinct source occurrence IDs');
  check(duplicates.every(r=>r.left>=0&&r.top>=0&&r.right<=1&&r.bottom<=1&&r.left<r.right&&r.top<r.bottom),'Stored provider bounds are normalized and valid');
  const table=doc.tables.find(t=>t.page===1&&t.cells.some(c=>c.text==='8,500'));
  check(table?.cells.some(c=>c.text==='Gross total')&&table.cells.some(c=>c.text==='USD'),'Actual table retains the amount, column heading and currency');
  check(doc.pages[0].regions.some(r=>r.table!=null&&r.row===1&&r.column===1&&r.text==='8,500'),'Actual table cell has its own source geometry');
  const region=duplicates[2],path=root+'/documents/'+doc.id+'/ocr-corrections';
  check((await request(path,{method:'POST',body:'{}'})).status===401,'OCR correction requires Bearer authentication');
  const body={version:item.version,page:1,sourceId:region.id,originalText:region.text,correctedText:region.text+' [synthetic annotation]',reason:'Acceptance-test annotation only; not an OCR error claim or human approval'};
  check((await post(path,{...body,originalText:'fabricated source'})).status===400,'Backend refuses fabricated OCR source text');
  check((await post(path,{...body,version:item.version+1})).status===409,'Backend refuses stale case version');
  const saved=await post(path,body);check(saved.ok,'Reviewer records separate transcription with exact source and reason');
  const updated=await saved.json(),after=updated.documents[0];
  check(JSON.stringify(after.pages)===JSON.stringify(doc.pages)&&JSON.stringify(after.fields)===JSON.stringify(doc.fields),'Recording a transcription leaves original OCR, geometry and fields unchanged');
  check(after.status==='review'&&after.ocrCorrections.length===1&&updated.audit.at(-1)[1]==='OCR_TRANSCRIPTION_RECORDED','Correction is audited without granting approval');
  const reloaded=await (await request(root,{headers:bearer})).json();
  check(reloaded.documents[0].ocrCorrections[0].correctedText===body.correctedText,'Separate correction persists through PostgreSQL readback');
  check((await request(root+'/documents/'+doc.id+'/original',{headers:bearer})).ok,'Original PDF remains available behind Bearer authorization');
  if(process.env.TEST_EVIDENCE_NOVA==='1'){
    const capabilities=await (await request(web+'/api/cases/ai-capabilities',{headers:bearer})).json();
    assert.equal(capabilities.chat.provider,'ollama','This inference acceptance is local-only');
    const cell=doc.pages[0].regions.find(r=>r.table!=null&&r.row===1&&r.column===1&&r.text==='8,500');
    const id=doc.id+':p1:'+cell.id;
    const reply=await post(web+'/api/chat',{caseId:item.id,locale:'en',caseVersion:updated.version,messages:[{id:randomUUID(),role:'user',parts:[{type:'text',text:`What amount, row label and currency are recorded at [${id}]? Answer in one short sentence and cite that exact source.`}]}]});
    check(reply.ok&&reply.headers.get('x-ai-mode')==='local-ollama','Actual local answer succeeds through the authenticated web proxy');
    const events=(await reply.text()).split('\n').filter(s=>s.startsWith('data: ')&&s!=='data: [DONE]').map(s=>JSON.parse(s.slice(6)));
    const answer=events.filter(e=>e.type==='text-delta').map(e=>e.delta||'').join('');
    const trust=events.find(e=>e.type==='data-nova-trust')?.data;
    check(answer.includes('8,500')&&answer.includes('USD')&&answer.includes('['+id+']'),'Real model answer cites the exact stored table occurrence with amount and currency');
    check(trust?.sources.some(s=>s.id===id&&s.locationState==='PROVIDER_RECORDED'&&s.ocrText==='8,500')&&trust.humanApproved===false,'Saved claim preserves exact OCR occurrence without granting human approval');
    check(trust.sources.length===1&&['Inspection example','Gross total','USD'].every(text=>trust.sources[0].excerpt.includes(text)),'Selected-occurrence answer excludes broad hits and retains raw row, column and unit context');
    const history=await (await request(root+'/trust',{headers:bearer})).json();
    check(history.answers.some(a=>a.id===trust.id&&a.answer===answer),'Actual model answer and sources persist in authenticated review history');
  }
  console.log(JSON.stringify({caseId:item.id,documentId:doc.id,duplicateRegions:duplicates.map(r=>r.id),region:region.id,scope:'Actual local Docling and persistence; no cloud call, no fabricated model answer, no human approval'}));
}
