// Explicit local acceptance: fictional research PDFs only; never print access tokens or model text.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';

export async function auditDomains({request,check,bearer,web,api}) {
  assert.equal(new URL(web).hostname,'localhost');assert.equal(new URL(api).hostname,'localhost');
  const headers={...bearer,'Content-Type':'application/json'};
  const send=(url,data,method='POST')=>request(url,{method,headers,body:JSON.stringify(data)});
  const get=async url=>{const r=await request(url,{headers:bearer});assert.ok(r.ok,`Read failed: ${r.status}`);return r.json();};
  const sql=query=>execFileSync('docker',['compose','exec','-T','case-db','psql','-U','credit_lab','-d','credit_cases','-At','-c',query],{encoding:'utf8'}).trim();
  const before=await get(`${web}/api/cases`);
  const oldDatev=before.flatMap(c=>c.documents.filter(d=>d.originalAvailable&&d.name.startsWith('datev-')).map(d=>({caseId:c.id,id:d.id,name:d.name})));
  for(const domain of ['banking','insurance','general']) {
    let r=await send(`${web}/api/cases`,{applicant:`Domain acceptance ${domain}`,purpose:'Fictional document research acceptance',domain,amountEuro:0,coApplicant:'',version:0});
    check(r.status===201,`${domain}: dossier created without loan amount`);let item=await r.json();
    const root=`${web}/api/cases/${item.id}`;
    check(item.domain===domain&&item.missingDocuments.length===(domain==='banking'?2:domain==='insurance'?1:0),`${domain}: domain-specific checklist`);
    r=await request(root);check(r.status===401,`${domain}: anonymous dossier read blocked`);
    r=await send(root,{applicant:item.applicant,purpose:'Updated research objective',amountEuro:0,coApplicant:'',version:item.version},'PATCH');
    check(r.ok,`${domain}: compatible edit accepted`);item=await r.json();check(item.domain===domain,`${domain}: domain preserved on old-style edit`);
    const stored=JSON.parse(sql(`SELECT payload FROM credit_cases WHERE id='${item.id}'`));check(stored.domain===domain,`${domain}: domain persisted in PostgreSQL`);
    r=await send(root+'/trust/prompt',{taskId:'reconcile',locale:'en',caseVersion:item.version});check(r.ok,`${domain}: controlled task available`);
    const draft=await r.json();check(draft.automaticSend===false,`${domain}: task never sends automatically`);
    if(domain==='banking')continue;
    const files=domain==='insurance'?['insurance-policy-fictional.pdf','insurance-claim-fictional.pdf']:['invoice-fictional.pdf'];
    for(const file of files) {
      const bytes=readFileSync('services/credit-api/src/test/resources/legacy-research/'+file);
      const form=new FormData();form.set('file',new Blob([bytes],{type:'application/pdf'}),file);
      r=await request(root+'/platform/jobs',{method:'POST',headers:bearer,body:form});
      check(r.status===202,`${domain}: fictional PDF accepted by async queue`);let job=await r.json();
      const until=Date.now()+180000;
      while(Date.now()<until){await new Promise(resolve=>setTimeout(resolve,2500));const platform=await get(root+'/platform');job=platform.jobs.find(j=>j.id===job.id)||job;if(['COMPLETE','FAILED'].includes(job.status))break;}
      check(job.status==='COMPLETE',`${domain}: PDF processed (${job.error_code||job.status})`);
      check(job.scan_result==='CLAMAV_CLEAN',`${domain}: ClamAV scanned the source`);
      item=await get(root);const doc=item.documents.find(d=>d.id===job.document_id);
      check(doc?.analysisProvider==='azure-document-intelligence'&&doc.modelId==='prebuilt-layout',`${domain}: actual Azure layout provenance`);
      const expected=file.includes('policy')?'insurance-policy':file.includes('claim')?'insurance-claim':'invoice';
      check(doc.type===expected,`${domain}: extracted text classified as ${expected}`);
      if(expected==='insurance-policy')check(['policyNumber','premium','deductible','coverageStart','coverageEnd'].every(k=>doc.fields.some(f=>f.label===k)),`${domain}: supported policy fields extracted with evidence`);
      if(expected==='invoice')check(doc.fields.some(f=>f.label==='invoiceTotal'&&f.value.includes('119')),`${domain}: invoice total extracted`);
      r=await request(root+`/documents/${doc.id}/original`,{headers:bearer});
      const hash=data=>createHash('sha256').update(data).digest('hex');
      check(r.ok&&hash(Buffer.from(await r.arrayBuffer()))===hash(bytes),`${domain}: private original preserved byte-for-byte`);
      r=await request(root+`/documents/${doc.id}/original`);check(r.status===401,`${domain}: original requires Bearer token`);
    }
    check(!item.missingDocuments.includes('income')&&!item.missingDocuments.includes('statement'),`${domain}: no unrelated banking requirement`);
    r=await send(root+'/platform/search',{question:domain==='insurance'?'What are the policy number, premium and deductible?':'What is the invoice number and total amount?'});
    check(r.ok,`${domain}: hybrid retrieval works`);const search=await r.json();
    check(search.search.backend==='qdrant'&&search.search.hits.some(h=>item.documents.some(d=>h.documentId===d.id)),`${domain}: Qdrant returns only selected dossier evidence`);
    r=await send(`${web}/api/chat`,{caseId:item.id,locale:'en',caseVersion:item.version,messages:[{id:randomUUID(),role:'user',parts:[{type:'text',text:domain==='insurance'?'List the policy number, annual premium and deductible in the uploaded fictional insurance policy. Cite page sources. Do not decide coverage or claim settlement.':'What is the invoice number and total in this fictional invoice? Cite its page source; do not make a payment.'}]}]});
    check(r.ok&&r.headers.get('x-ai-mode')?.startsWith('azure-'),`${domain}: Nova uses actual Azure OpenAI`);
    const raw=await r.text();const events=raw.split('\n').filter(l=>l.startsWith('data: ')&&l!=='data: [DONE]').map(l=>JSON.parse(l.slice(6)));
    const answer=events.filter(e=>e.type==='text-delta').map(e=>e.delta||e.textDelta||'').join('');
    check(answer.length>60,`${domain}: model returned a non-empty explanation`);
    check(events.some(e=>e.type==='source-document'&&item.documents.some(d=>e.sourceId.startsWith(d.id))),`${domain}: answer carries selected original sources`);
    check(domain==='insurance'?answer.includes('480')&&answer.includes('250'):answer.includes('119'),`${domain}: answer retains relevant source amounts`);
    const persisted=await get(root+'/trust');check(Array.isArray(persisted.answers)&&persisted.answers.length>0,`${domain}: AI answer history persisted`);
  }
  for(const ref of oldDatev){const r=await request(`${web}/api/cases/${ref.caseId}/documents/${ref.id}/original`,{headers:bearer});check(r.ok,`Existing DATEV original remains private and accessible: ${ref.name}`);}
  for(const file of ['datev-lodas-2025-robert-muster.pdf','datev-lodas-2025-melanie-muster.pdf']){
    check(readFileSync('.local/reference-pdfs/'+file).subarray(0,5).toString()==='%PDF-',`Private DATEV file retained: ${file}`);
    check((await request(web+'/demo/'+file)).status===404,'DATEV original is not a public static asset');
  }
}
