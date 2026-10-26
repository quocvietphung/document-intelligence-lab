import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

/** Actual local upload → ClamAV → Docling → SQL → authenticated web DTO. */
export async function auditDocumentStructure({request,check,bearer,web,api}){
  assert.equal(new URL(web).hostname,'localhost');assert.equal(new URL(api).hostname,'localhost');
  const post=(url,body)=>request(url,{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const created=await post(web+'/api/cases',{applicant:'Synthetic structure and reading-order acceptance',purpose:'Tagged multi-column PDF and self-authored scanned examples; not customer data',amountEuro:0,coApplicant:'',version:0,domain:'general'});
  check(created.status===201,'Create isolated structural-preservation dossier');let item=await created.json();
  console.log('Structure dossier: '+item.id);
  const root=web+'/api/cases/'+item.id,form=new FormData();form.set('requestId',randomUUID());form.set('name','Synthetic structural regression');form.set('source','Self-authored MIT fixtures; not accessibility-certified reference PDFs');form.set('profile','general');
  const files=['structure-regression.pdf','scanned-skew-regression.pdf'];
  for(const file of files)form.append('files',new Blob([readFileSync('services/credit-api/src/test/resources/evidence/'+file)],{type:'application/pdf'}),file);
  check((await request(root+'/platform/batches',{method:'POST',headers:bearer,body:form})).status===202,'Native-tag and scanned fixtures accepted into the authenticated queue');
  const deadline=Date.now()+300000;
  while(Date.now()<deadline){
    const response=await request(root,{headers:bearer});assert.ok(response.ok);item=await response.json();if(item.documents.length===files.length)break;
    const platform=await (await request(root+'/platform',{headers:bearer})).json();
    assert.ok(!platform.jobs.some(j=>j.status==='FAILED'),'No structural regression job may be reported as successful after failure');
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  check(item.documents.length===files.length,'Both actual Docling extractions are attached with originals');
  const doc=item.documents.find(d=>d.name==='structure-regression.pdf'),scan=item.documents.find(d=>d.name==='scanned-skew-regression.pdf');
  check(doc.analysisProvider==='docling'&&doc.structure?.origin==='docling-layout','Layout origin is explicitly Docling inference');
  check(doc.structure.nativeTags==='PRESENT_NOT_VALIDATED'&&scan.structure.nativeTags==='ABSENT','Native PDF tag presence is separate from inferred layout');
  check(doc.structure.blocks.some(b=>b.kind==='section_header')&&doc.structure.blocks.some(b=>b.kind==='table'),'Actual headings and table remain in the recorded hierarchy');
  check(doc.pages[0].text.indexOf('Read this left column first.')>=0&&doc.pages[0].text.indexOf('Read this left column first.')<doc.pages[0].text.indexOf('2. Recorded amounts'),'Actual two-column text follows the recorded body order instead of PDF paint order');
  check(doc.tables.some(t=>t.cells.some(c=>c.columnHeader===true)),'Provider-reported table header roles survive persistence and web decoding');
  check(scan.pages.length===2&&scan.pages.every(p=>p.text.trim()),'Image-only upright/skewed pages have actual extracted text, not fabricated success');
  const region=doc.pages[0].regions.find(r=>r.text&&r.text.length<500);assert.ok(region);
  const revised=await post(root+'/documents/'+doc.id+'/ocr-corrections',{version:item.version,page:1,sourceId:region.id,originalText:region.text,correctedText:region.text+' [synthetic annotation]',reason:'Structural persistence test; no approval or OCR error assertion'});
  check(revised.ok,'Separate OCR transcription can be recorded for a structured document');
  const updated=await revised.json(),after=updated.documents.find(d=>d.id===doc.id);
  check(JSON.stringify(after.structure)===JSON.stringify(doc.structure)&&JSON.stringify(after.tables)===JSON.stringify(doc.tables),'OCR correction preserves layout, reading order and table roles/spans');
  const loaded=await (await request(root,{headers:bearer})).json();
  check(JSON.stringify(loaded.documents.find(d=>d.id===doc.id).structure)===JSON.stringify(doc.structure),'Structure survives PostgreSQL readback');
  console.log('Structure preview: '+web+'/en?case='+item.id+'#documents');
}
