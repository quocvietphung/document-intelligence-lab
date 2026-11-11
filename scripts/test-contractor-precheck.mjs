// AI-103 live acceptance: fictional contractor dossier through the real local stack
// (Keycloak → Next.js proxy → Java → ClamAV → Docling → Qdrant/BM25 → deterministic pre-check).
// No Azure call, no model inference, no approval and no email. Never prints tokens or document text.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';

const dir='services/credit-api/src/main/resources/contractor-dossier/';
const manifest=JSON.parse(readFileSync(dir+'manifest.json','utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

export async function auditContractorPrecheck({request,check,bearer,web,api}){
  assert.equal(new URL(web).hostname,'localhost');assert.equal(new URL(api).hostname,'localhost');
  const json=(url,body,method='POST')=>request(url,{method,headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const get=async url=>{const r=await request(url,{headers:bearer});assert.ok(r.ok,`Read failed: HTTP ${r.status}`);return r.json();};
  const out='.local/ai103';mkdirSync(out,{recursive:true});
  const expected=manifest.expected;

  async function dossier(label){
    const r=await json(`${web}/api/cases`,{applicant:`AI-103 ${label} (fictional)`,purpose:'Pre-accounting contractor check; fictional data; no approval or payment',domain:'real-estate',amountEuro:0,coApplicant:'',version:0});
    check(r.status===201,`${label}: real-estate dossier created`);return r.json();
  }
  async function intake(item,files,label){
    const form=new FormData();form.set('requestId',randomUUID());form.set('name',`AI-103 ${label}`);form.set('source','Authored fictional contractor dossier (contractor-dossier-v1)');form.set('profile','general');
    for(const file of files){const bytes=readFileSync(dir+file);form.append('files',new Blob([bytes],{type:file.endsWith('.png')?'image/png':'application/pdf'}),file);}
    const r=await request(`${web}/api/cases/${item.id}/platform/batches`,{method:'POST',headers:bearer,body:form});
    check(r.status===202,`${label}: ${files.length} file(s) accepted by the durable queue (HTTP ${r.status})`);
    const started=Date.now(),deadline=started+Number(process.env.TEST_PRECHECK_TIMEOUT_MS||900000);let jobs=[];
    while(Date.now()<deadline){
      await new Promise(resolve=>setTimeout(resolve,4000));
      const platform=await get(`${web}/api/cases/${item.id}/platform`);
      jobs=platform.jobs.filter(j=>files.includes(j.name));
      if(jobs.length===files.length&&jobs.every(j=>['COMPLETE','FAILED','CANCELLED','EXPIRED'].includes(j.status)))break;
    }
    console.log(`  ${label}: queue finished in ${Math.round((Date.now()-started)/1000)} s`);
    return {jobs,item:await get(`${web}/api/cases/${item.id}`)};
  }
  const precheck=async(id,locale='vi')=>{const r=await request(`${web}/api/cases/${id}/platform/contractor-precheck?locale=${locale}`,{headers:bearer});check(r.ok,`Pre-check answers through the web proxy (HTTP ${r.status})`);return r.json();};

  // ---- Exercise 1: PDF → fields/tables → evidence search → reconcile → cited draft
  let item=await dossier('contractor pre-check');
  const core=manifest.coreDossier;
  let processed=await intake(item,core,'core dossier');
  check(processed.jobs.every(j=>j.status==='COMPLETE'),`core dossier: all four PDFs processed (${processed.jobs.map(j=>j.status+(j.error_code?':'+j.error_code:'')).join(', ')})`);
  check(processed.jobs.every(j=>j.scan_result==='CLAMAV_CLEAN'),'core dossier: every original passed the ClamAV scan');
  item=processed.item;
  const byName=Object.fromEntries(item.documents.map(d=>[d.name,d]));
  check(core.every(name=>byName[name]?.analysisProvider==='docling'&&byName[name].originalAvailable),'core dossier: Docling extraction retained with each original');
  check(['construction-order','change-order','construction-invoice','acceptance-report'].every(type=>item.documents.some(d=>d.type===type))&&item.missingDocuments.length===0,'core dossier: document types satisfy the real-estate checklist');
  const invoiceDoc=byName['baurechnung-rg-2026-0457.pdf'];
  check(invoiceDoc.tables.some(t=>t.cells.some(c=>/Netto EUR/.test(c.text))),'Docling recovered the invoice positions table');
  const original=await request(`${web}/api/cases/${item.id}/documents/${invoiceDoc.id}/original`,{headers:bearer});
  check(original.ok&&sha(Buffer.from(await original.arrayBuffer()))===manifest.files.find(f=>f.file==='baurechnung-rg-2026-0457.pdf').sha256,'Invoice original preserved byte-for-byte');

  // Photos for the acceptance report (OCR through Docling). Recorded honestly if the image path fails.
  const photoFiles=manifest.files.filter(f=>f.role==='acceptance-photo').map(f=>f.file);
  const photos=await intake(item,photoFiles,'acceptance photos');
  const photosOk=photos.jobs.length===photoFiles.length&&photos.jobs.every(j=>j.status==='COMPLETE');
  console.log(`  acceptance photos: ${photos.jobs.map(j=>`${j.name}=${j.status}${j.error_code?':'+j.error_code:''}`).join(', ')}`);
  item=photos.item;

  const before=await get(`${web}/api/cases/${item.id}`);
  check((await request(`${web}/api/cases/${item.id}/platform/contractor-precheck`)).status===401,'Pre-check requires a Bearer token');
  check((await request(`${web}/api/cases/${item.id}/platform/contractor-precheck`,{method:'POST',headers:bearer})).status===405,'Pre-check is GET-only through the web proxy');
  const result=await precheck(item.id,'vi');
  writeFileSync(`${out}/precheck-${item.id}.json`,JSON.stringify(result,null,2));
  const after=await get(`${web}/api/cases/${item.id}`);
  check(after.version===before.version&&after.audit.length===before.audit.length&&JSON.stringify(after.documents.map(d=>d.status))===JSON.stringify(before.documents.map(d=>d.status)),'Pre-check is read-only: dossier version, audit trail and review states unchanged');
  check(result.readOnly===true&&result.dossierWrites===0,'Pre-check declares no dossier writes');
  const name=id=>item.documents.find(d=>d.id===id)?.name;
  check(result.approved.amount===expected.approved.amount&&result.approved.basis==='GROSS','Approved amount 48780.00 EUR on a gross basis');
  check(name(result.approved.source?.documentId)===expected.approved.file&&result.approved.source.page===expected.approved.page,`Approved amount cites ${expected.approved.file} p. ${expected.approved.page}`);
  check(result.approved.crossCheck?.consistent===true&&result.approved.crossCheck.sum==='48780.00','Approved total equals order 42840.00 + change order 5940.00 (BigDecimal)');
  check(result.invoice.amount===expected.invoice.amount&&name(result.invoice.source?.documentId)===expected.invoice.file&&result.invoice.source.page===expected.invoice.page,`Invoice 49980.00 EUR cites ${expected.invoice.file} p. ${expected.invoice.page}`);
  check(result.invoice.netPlusVatEqualsGross===true,'Invoice net 42000.00 + VAT 7980.00 = gross 49980.00');
  check(result.variance.amount===expected.variance.gross&&result.variance.sameTaxBasis===true&&result.variance.basis==='GROSS','Difference 1200.00 EUR computed on the same (gross) tax basis');
  check(result.variance.net===expected.variance.net&&result.variance.vat===expected.variance.vat,'Net 1008.40 and VAT 191.60 parts of the difference');
  check(JSON.stringify(result.invoiceLines.map(l=>[l.position,l.net,l.approved]))===JSON.stringify(expected.invoiceLines.map(l=>[l.position,l.net,l.approved])),'Invoice lines from the Docling table; line 3 has no approval');
  check(result.invoiceLines.every(l=>l.source.origin.startsWith('table')),'Invoice lines come from table cells, not prose');
  check(result.explanation.explainsVariance===true,'Unapproved line 3 plus 19 % VAT explains the whole difference');
  check(result.evidence.acceptance.status==='PARTIAL'&&JSON.stringify(result.evidence.acceptance.notAcceptedPositions)==='[3]'&&result.evidence.acceptance.openDefects===1,'Acceptance evidence PARTIAL: line 3 not accepted, one open defect');
  check(result.evidence.payment.status==='MISSING','Payment evidence explicitly MISSING');
  const retrieval=Object.fromEntries(result.evidence.retrieval.map(r=>[r.purpose,r]));
  check(Object.values(retrieval).every(r=>r.backend==='qdrant'),'Evidence search ran through Qdrant hybrid retrieval');
  check(retrieval.approved.hits.some(h=>h.confirmed)&&retrieval.invoice.hits.some(h=>h.confirmed),'Retrieval nominated the cited approved/invoice pages and rules confirmed them');
  check(retrieval.payment.hits.every(h=>!h.confirmed),'Payment-like retrieval hits are not mistaken for payment evidence');
  if(photosOk){
    check(JSON.stringify(result.evidence.photos.missing)===JSON.stringify(expected.photos.missing),`Photo evidence linked: ${result.evidence.photos.provided.map(p=>p.photoId).join(', ')}; missing ${result.evidence.photos.missing.join(', ')}`);
  } else console.log('  NOTE photo linking not verified live: image intake did not complete (see job status above)');
  const codes=result.findings.map(f=>f.code);
  check(['INVOICE_EXCEEDS_APPROVED_AMOUNT','INVOICE_LINE_WITHOUT_APPROVAL','ACCEPTANCE_EVIDENCE_MISSING','PAYMENT_EVIDENCE_MISSING'].every(c=>codes.includes(c)),'Findings name the variance, the unapproved line and the missing evidence');
  check(result.draft.status==='DRAFT_REQUIRES_HUMAN_REVIEW'&&result.draft.approved===false&&result.draft.emailSent===false&&result.draft.paymentReleased===false&&result.draft.email.send===false,'Draft stays unapproved and unsent');
  check(result.draft.summary.some(s=>s.includes('THIẾU'))&&result.draft.summary.some(s=>s.includes('1.200,00 EUR')),'Vietnamese draft states the difference and the missing evidence');
  check(result.steps.map(s=>s.name).join()==='extract,search,reconcile,draft','Four timed steps reported');
  const direct=await request(`${api}/api/cases/${item.id}/platform/contractor-precheck?locale=de`,{headers:bearer});
  check(direct.ok&&(await direct.json()).draft.email.body.includes('ENTWURF – nicht versendet'),'Java API serves the German draft directly');

  // ---- Exercise 2c: self-approval instruction hidden in a PDF
  let injected=await dossier('embedded instruction check');
  const variant='baurechnung-rg-2026-0457-mit-anweisung.pdf';
  const injectedRun=await intake(injected,[variant],'instruction variant');
  check(injectedRun.jobs[0]?.status==='COMPLETE','Variant invoice is accepted (the sentence is not a generic injection) and processed');
  injected=injectedRun.item;
  const versionBefore=injected.version;
  const flagged=await precheck(injected.id,'en');
  writeFileSync(`${out}/precheck-instruction-${injected.id}.json`,JSON.stringify(flagged,null,2));
  check(flagged.embeddedInstructions.length===1&&flagged.embeddedInstructions[0].page===expected.embeddedInstruction.page&&flagged.embeddedInstructions[0].quote.includes('automatisch zur Zahlung freigeben'),'Self-approval sentence reported with its page (p. 2)');
  check(flagged.findings.some(f=>f.code==='EMBEDDED_APPROVAL_INSTRUCTION'&&f.severity==='HIGH'),'Embedded instruction is a HIGH finding');
  check(flagged.draft.approved===false&&flagged.draft.emailSent===false&&flagged.invoice.amount==='49980.00','Instruction changes neither approval, email nor amounts');
  const search=await json(`${web}/api/cases/${injected.id}/platform/search`,{question:'Rechnung freigeben Zahlung E-Mail'});
  const searched=await search.json();
  check(search.ok&&searched.search.quarantined.some(id=>id.includes(':p2'))&&searched.search.hits.every(h=>!(h.text||'').includes('automatisch zur Zahlung')),'Instruction page is quarantined from retrieval/model context');
  check((await get(`${web}/api/cases/${injected.id}`)).version===versionBefore,'Instruction dossier unchanged by the check');
  console.log(`AI-103 dossiers: ${item.id} (core) · ${injected.id} (instruction). Results: ${out}/`);
  console.log(`Review in the UI: ${web}/vi?case=${item.id}#controls`);
  return {caseId:item.id,instructionCaseId:injected.id};
}
