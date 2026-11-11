import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {basename} from 'node:path';
import {pathToFileURL} from 'node:url';

// Before/after measurement of Nova's evidence context on fixed fictional PDFs.
// Every variant asks the same questions about the same uploaded documents; only the context switches change
// (NOVA_CONTEXT_* / NOVA_PROMPT_STATIC_FIRST on the credit-api container). The output holds numbers, document
// names, citation IDs and pass/fail checks — never prompts, answers or document text.

const fixtures='services/credit-api/src/main/resources';
export const benchmarkDossiers={
  construction:{profile:'general',applicant:'Nova benchmark · fictional construction documents',files:[
    'use-cases/projektbewertung-musterquartier.pdf','use-cases/projektstatus-musterquartier.pdf','use-cases/bauvertrag-musterquartier.pdf',
    'use-cases/eingangsrechnung-musterquartier.pdf','use-cases/email-nachtragsangebot-musterquartier.pdf','use-cases/esg-nachweise-musterquartier.pdf',
    'real-estate/fictional-construction-order.pdf','real-estate/fictional-change-order.pdf','real-estate/fictional-construction-invoice.pdf',
    'real-estate/fictional-acceptance-report.pdf','real-estate/fictional-site-meeting-minutes.pdf'].map(file=>`${fixtures}/${file}`)},
  // Approved public fictional DATEV samples, prepared locally (git-ignored) by scripts/prepare-datev-reference.py.
  payroll:{profile:'payroll',applicant:'Nova benchmark · fictional DATEV payroll samples',files:[
    '.local/reference-pdfs/datev-lodas-2025-robert-muster.pdf','.local/reference-pdfs/datev-lodas-2025-melanie-muster.pdf']},
};

// Missing evidence: the answer must contain a negation; reject lists catch invented values.
const abstain=/\b(?:not|no|cannot|isn't|doesn't|nicht|kein(?:e|en|er|es|em)?|fehl(?:t|en))\b|không|chưa/i;
// pairs: every [label, value] must appear in the same line or sentence, so net income and payout are never swapped.
export const benchmarkQuestions=[
  {id:'amount-forecast',dossier:'construction',locale:'de',kind:'amount',question:'Welche prognostizierten Gesamtkosten nennt die Projektbewertung?',expect:['16.750.000,00'],sources:['projektbewertung']},
  {id:'amount-gross',dossier:'construction',locale:'vi',kind:'amount',question:'Hóa đơn RE-2026-0311 nêu tổng tiền sau thuế (Bruttobetrag) là bao nhiêu?',expect:['49.980,00'],reject:['198.250,00'],sources:['eingangsrechnung']},
  {id:'amount-change-offer',dossier:'construction',locale:'en',kind:'amount',question:'Which change-order amount does the offer NA-2026-007 state?',expect:['18.400,00'],reject:['12.600,00'],sources:['email-nachtragsangebot']},
  {id:'date-topping-out',dossier:'construction',locale:'de',kind:'date',question:'Wann ist das Richtfest geplant?',expect:['14.11.2026'],sources:['projektstatus']},
  {id:'date-energy',dossier:'construction',locale:'en',kind:'date',question:'Until when is the energy certificate valid?',expect:['2036'],sources:['esg-nachweise']},
  {id:'multi-order-invoice',dossier:'construction',locale:'en',kind:'multi-source',question:'For order AUF-2026-081, list the order sum, the approved change-order sum and the invoice amount, each with its document source.',
    expect:['184.450,00','12.600,00','198.250,00'],sources:['fictional-construction-order','fictional-change-order','fictional-construction-invoice']},
  {id:'missing-market-value',dossier:'construction',locale:'de',kind:'missing',question:'Wie hoch ist der Verkehrswert laut Gutachten?',reject:['Verkehrswert von','Verkehrswert beträgt','Verkehrswert liegt bei']},
  {id:'missing-paid',dossier:'construction',locale:'en',kind:'missing',question:'Has invoice RE-2026-0311 already been paid?',reject:['has been paid','was paid on','paid in full']},
  {id:'payroll-net-payout',dossier:'payroll',locale:'de',kind:'amount',question:'Wie hoch sind Netto-Verdienst und Auszahlungsbetrag von Robert Muster? Nenne beide Werte getrennt.',
    expect:['2.967,11','2.882,11'],pairs:[[/netto/i,'2.967,11'],[/auszahl/i,'2.882,11']],sources:['robert-muster']},
  {id:'payroll-compare',dossier:'payroll',locale:'en',kind:'multi-source',question:"Compare the two DATEV sample PDFs. List each document's net earnings and payout separately with document sources.",
    expect:['2.967,11','2.882,11','4.212,90','3.069,93'],pairs:[[/net/i,'2.967,11'],[/payout|paid out|pay-out/i,'2.882,11'],[/net/i,'4.212,90'],[/payout|paid out|pay-out/i,'3.069,93']],sources:['robert-muster','melanie-muster']},
];

const plain=value=>value.replace(/\s|EUR|€/g,'');
const sentences=answer=>answer.split(/\n|(?<=[.!?])\s+/).map(line=>line.trim()).filter(Boolean);
const uncertain=/\b(?:not|no|cannot|whether|unknown|unclear|nicht|kein(?:e|en|er|es|em)?|ob|unbekannt)\b|không|chưa|liệu/i;
const amount=/\d[\d.]*,\d{2}/g;
const lastMatch=(label,text)=>{let last=-1;for(const m of text.matchAll(new RegExp(label.source,label.flags.replace('g','')+'g')))last=m.index;return last;};
/** The label nearest before a value (since the previous amount) must be its own label; a label after the value counts only if none precedes it. */
export function paired(answer,pairs){
  const labels=pairs.map(([label])=>label);
  return pairs.every(([label,value])=>answer.split(/\n/).some(line=>{
    const at=line.indexOf(value);if(at<0)return false;
    const before=line.slice(0,at),previous=[...before.matchAll(amount)].at(-1),segment=previous?before.slice(previous.index+previous[0].length):before;
    const after=line.slice(at+value.length),next=after.search(amount),following=next<0?after:after.slice(0,next);
    const nearestBefore=labels.map(l=>({l,i:lastMatch(l,segment)})).filter(x=>x.i>=0).sort((x,y)=>y.i-x.i)[0];
    const nearestAfter=labels.map(l=>({l,i:following.search(l)})).filter(x=>x.i>=0).sort((x,y)=>x.i-y.i)[0];
    const chosen=(nearestBefore||nearestAfter)?.l;
    return chosen?.source===label.source;
  }));
}
/** Pass/fail checks on one answer. Text is only inspected here and never written to the output. */
export function grade(question,result,documents){
  const answer=String(result.answer||''),flat=plain(answer),ids=(result.sources||[]).map(s=>s.id);
  const cited=[...answer.matchAll(/\[([^\]\n]{1,150})\]/g)].map(m=>m[1].trim());
  const documentOf=id=>documents.find(d=>id.startsWith(d.id+':'))?.name||'';
  const sent=[...new Set(ids.map(documentOf).filter(Boolean))],citedDocuments=[...new Set(cited.map(documentOf).filter(Boolean))];
  const checks={
    citationsValid:cited.length>0&&cited.every(id=>ids.includes(id)),
    // The evidence sent to the model still contains every needed document (independent of model wording).
    evidenceKept:(question.sources||[]).every(key=>sent.some(name=>name.includes(key))),
    sourcesCited:(question.sources||[]).every(key=>citedDocuments.some(name=>name.includes(key))),
    valuesPresent:(question.expect||[]).every(value=>flat.includes(plain(value))),
    // A rejected amount must not appear at all; a rejected claim counts only outside a negated or open question.
    noWrongValue:!(question.reject||[]).some(value=>/\d/.test(value)?answer.includes(value):sentences(answer).some(line=>line.includes(value)&&!uncertain.test(line))),
    pairsKept:paired(answer,question.pairs||[]),
    abstained:question.kind!=='missing'||abstain.test(answer.replace(/\[[^\]\n]*\]/g,'')),
  };
  if(question.kind==='missing'){checks.sourcesCited=true;checks.valuesPresent=true;checks.evidenceKept=true;}
  return {checks,passed:Object.values(checks).every(Boolean),sentDocuments:sent.length,citedDocuments:citedDocuments.map(name=>basename(name,'.pdf'))};
}

export async function benchmarkNova({request,check,bearer,web,api}){
  assert.equal(new URL(web).hostname,'localhost');assert.equal(new URL(api).hostname,'localhost');
  // CPU answers may use the full 360-second local model deadline; fetch's default 300-second header wait is shorter.
  const {Agent,setGlobalDispatcher}=await import('undici');setGlobalDispatcher(new Agent({headersTimeout:420_000,bodyTimeout:420_000}));
  const variant=process.env.TEST_NOVA_VARIANT||'unnamed',out=process.env.TEST_NOVA_BENCHMARK_OUT;
  const only=new Set((process.env.TEST_NOVA_BENCHMARK_ONLY||'').split(',').filter(Boolean));
  const json={'Content-Type':'application/json'};
  const reuse=Object.fromEntries((process.env.TEST_NOVA_BENCHMARK_CASES||'').split(',').filter(Boolean).map(pair=>pair.split(':')));
  const cases={};
  for(const [key,dossier] of Object.entries(benchmarkDossiers)){
    if(!benchmarkQuestions.some(q=>q.dossier===key&&(!only.size||only.has(q.id))))continue;
    let item;
    if(reuse[key]){assert.match(reuse[key],/^CR-[-a-zA-Z0-9]+$/);item=await (await request(`${web}/api/cases/${reuse[key]}`,{headers:bearer})).json();}
    else{
      for(const file of dossier.files)assert.ok(existsSync(file),`Missing local fixture ${file}`);
      const created=await request(`${web}/api/cases`,{method:'POST',headers:{...bearer,...json},body:JSON.stringify({applicant:dossier.applicant,domain:'general',purpose:'Nova context benchmark on fictional documents; no decisions',coApplicant:'',amountEuro:0,version:0})});
      check(created.status===201,`${key}: benchmark dossier created`);item=await created.json();
      // The document queue accepts at most four files per batch.
      for(let start=0;start<dossier.files.length;start+=4){
        const form=new FormData();form.set('requestId',randomUUID());form.set('name',`Nova benchmark ${key} ${start/4+1}`);form.set('source','Fictional benchmark fixtures');form.set('profile',dossier.profile);
        for(const file of dossier.files.slice(start,start+4))form.append('files',new Blob([readFileSync(file)],{type:'application/pdf'}),basename(file));
        const intake=await request(`${web}/api/cases/${item.id}/platform/batches`,{method:'POST',headers:bearer,body:form});
        check(intake.status===202,`${key}: batch ${start/4+1} accepted into the document queue`);
      }
      const deadline=Date.now()+900_000;
      while(Date.now()<deadline){item=await (await request(`${web}/api/cases/${item.id}`,{headers:bearer})).json();if(item.documents?.filter(d=>d.originalAvailable).length>=dossier.files.length)break;await new Promise(resolve=>setTimeout(resolve,3000));}
      check(item.documents.filter(d=>d.originalAvailable).length>=dossier.files.length,`${key}: every original analysed and retained`);
    }
    cases[key]=item;console.log(`Benchmark dossier ${key}: ${item.id} (${item.documents.length} documents)`);
  }
  // Retrieval only (no model call): scores and sizes of the hits Nova would receive, for choosing context limits.
  if(process.env.TEST_NOVA_SEARCH_ONLY==='1'){
    for(const question of benchmarkQuestions.filter(q=>!only.size||only.has(q.id))){
      const item=cases[question.dossier],name=id=>basename(item.documents.find(d=>id.startsWith(d.id+':'))?.name||id,'.pdf');
      const search=await (await request(`${web}/api/cases/${item.id}/platform/search`,{method:'POST',headers:{...bearer,...json},body:JSON.stringify({question:question.question})})).json();
      console.log(`${question.id}: `+search.search.hits.map(h=>`${name(h.id)}${h.id.slice(h.id.indexOf(':p'))} ${h.kind} score=${h.score} chars=${h.text.length}`).join(' | '));
    }
    return;
  }
  // Warm the model and the index once, so the first measured question does not pay for loading.
  const warm=Object.values(cases)[0];
  if(warm&&process.env.TEST_NOVA_SKIP_WARMUP!=='1')await request(`${api}/api/assistant/chat`,{method:'POST',headers:{...bearer,...json},body:JSON.stringify({caseId:warm.id,locale:'en',question:'Which documents are in this dossier?'})}).catch(error=>console.log(`Warm-up did not complete: ${error.cause?.code||error.name}`));
  const rows=[];
  for(const question of benchmarkQuestions.filter(q=>!only.size||only.has(q.id))){
    const item=cases[question.dossier];const started=Date.now();
    let reply;
    try{reply=await request(`${api}/api/assistant/chat`,{method:'POST',headers:{...bearer,...json},body:JSON.stringify({caseId:item.id,locale:question.locale,question:question.question})});}
    catch(error){const code=error.cause?.code||error.name;rows.push({variant,id:question.id,kind:question.kind,status:code,wallMs:Date.now()-started,passed:false});console.log(`${question.id}: ${code}`);continue;}
    const wallMs=Date.now()-started;
    if(!reply.ok){rows.push({variant,id:question.id,kind:question.kind,status:reply.status,wallMs,passed:false});console.log(`${question.id}: HTTP ${reply.status}`);continue;}
    const result=await reply.json(),metrics=result.metrics||{};
    const graded=grade(question,result,item.documents);
    rows.push({variant,id:question.id,kind:question.kind,status:reply.status,wallMs,...metrics,...graded});
    console.log(`${question.id}: ${graded.passed?'PASS':'FAIL'} ${JSON.stringify(graded.checks)} wall=${wallMs}ms sources=${metrics.evidenceSources} chars=${metrics.evidenceChars} in=${metrics.inputTokens} out=${metrics.outputTokens}`);
  }
  if(out)writeFileSync(out,JSON.stringify({variant,cases:Object.fromEntries(Object.entries(cases).map(([k,v])=>[k,v.id])),rows},null,2));
  check(rows.length>0,`${variant}: ${rows.filter(r=>r.passed).length}/${rows.length} benchmark answers passed every check`);
}

const median=values=>{const sorted=values.filter(v=>typeof v==='number').sort((a,b)=>a-b);if(!sorted.length)return null;const mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:Math.round((sorted[mid-1]+sorted[mid])/2);};
const sum=values=>values.filter(v=>typeof v==='number').reduce((a,b)=>a+b,0);
/**
 * Markdown before/after table from result files written by benchmarkNova. Sizes and latency are compared only on
 * questions that every run answered, so a timeout in one run does not look like a saving.
 */
export function compare(files){
  const runs=files.map(file=>JSON.parse(readFileSync(file,'utf8')));
  const ids=[...new Set(runs.flatMap(run=>run.rows.map(r=>r.id)))];
  const common=ids.filter(id=>runs.every(run=>typeof run.rows.find(r=>r.id===id)?.inputTokens==='number'));
  const lines=[`Sizes and latency below cover the ${common.length} questions answered in every run (${common.join(', ')}).`,'',
    '| Variant | Passed | Evidence kept | Median latency ms | Evidence sources | Evidence chars | Prompt chars | Input tokens (Ollama) | Output tokens | Removed sources |','|---|---|---|---|---|---|---|---|---|---|'];
  for(const run of runs){
    const rows=run.rows,shared=rows.filter(r=>common.includes(r.id));
    lines.push(`| ${run.variant} | ${rows.filter(r=>r.passed).length}/${rows.length} | ${rows.filter(r=>r.checks?.evidenceKept).length}/${rows.length} | ${median(shared.map(r=>r.latencyMs))} | ${sum(shared.map(r=>r.evidenceSources))} | ${sum(shared.map(r=>r.evidenceChars))} | ${sum(shared.map(r=>r.promptChars))} | ${sum(shared.map(r=>r.inputTokens))} | ${sum(shared.map(r=>r.outputTokens))} | ${sum(shared.map(r=>r.removedSources))} |`);
  }
  lines.push('','| Question | '+runs.map(r=>r.variant).join(' | ')+' |','|---|'+runs.map(()=>'---|').join(''));
  for(const id of ids)lines.push(`| ${id} | `+runs.map(run=>{
    const r=run.rows.find(row=>row.id===id);if(!r)return '–';
    if(!r.checks)return `FAIL (${typeof r.status==='number'?'HTTP '+r.status:r.status}) · ${r.wallMs} ms`;
    const failed=Object.entries(r.checks).filter(([,ok])=>!ok).map(([name])=>name);
    return `${r.passed?'pass':'FAIL'}${failed.length?' ('+failed.join(', ')+')':''} · ${r.evidenceSources} src · ${r.evidenceChars} chars · ${r.inputTokens} in · ${r.latencyMs} ms`;
  }).join(' | ')+' |');
  return lines.join('\n');
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
  const [command,...files]=process.argv.slice(2);
  if(command!=='--compare'||!files.length)throw Error('Usage: node scripts/benchmark-nova.mjs --compare baseline.json variant.json …  (runs are started through TEST_NOVA_BENCHMARK=1 node scripts/test-oauth.mjs)');
  console.log(compare(files));
}
