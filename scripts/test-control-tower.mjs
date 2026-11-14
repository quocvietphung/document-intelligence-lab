// Control Tower acceptance on the local stack: the contractor dossier (fictional PDFs) runs through review, the ETL
// worker (Bronze -> Silver -> reviewed Gold -> marts -> Power BI export) and the case API. No cloud call.
// Run: TEST_CONTROL_TOWER=1 TEST_WEB_URL=http://localhost:3001 node scripts/test-oauth.mjs
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';

const CORE=['bauauftrag-wv-2026-031.pdf','nachtrag-n01-wv-2026-031.pdf','baurechnung-rg-2026-0457.pdf','abnahmeprotokoll-ap-2026-019.pdf'];
const INSTRUCTION='baurechnung-rg-2026-0457-mit-anweisung.pdf';

export async function auditControlTower({request,check,bearer,web}){
  const json=async(path,options={})=>{const r=await request(`${web}${path}`,{...options,headers:{...bearer,'Content-Type':'application/json',...(options.headers||{})}});return {status:r.status,body:r.status===204?null:await r.json().catch(()=>null)};};
  const list=(await json('/api/cases')).body||[];
  const names=c=>new Set((c.documents||[]).map(d=>d.name));
  const newest=(predicate)=>list.filter(predicate).sort((a,b)=>String(b.submittedAt||'').localeCompare(String(a.submittedAt||''))||String(b.id).localeCompare(String(a.id)))[0];
  const core=newest(c=>CORE.every(n=>names(c).has(n))&&!names(c).has(INSTRUCTION));
  const variant=newest(c=>names(c).has(INSTRUCTION));
  check(Boolean(core),`contractor dossier with the four PDFs found (${core?.id})`);
  const report={core:core?.id,instruction:variant?.id,runs:{}};

  async function review(caseId){
    let item=(await json(`/api/cases/${caseId}`)).body;let reviewed=0;
    for(const doc of item.documents.filter(d=>d.originalAvailable&&d.fields?.length&&d.status!=='verified')){
      const r=await json(`/api/cases/${caseId}/documents/${doc.id}/review`,{method:'POST',body:JSON.stringify({version:item.version,values:doc.fields.map(f=>f.value)})});
      if(r.status===200){item=r.body;reviewed++;}
    }
    return {item,reviewed,verified:item.documents.filter(d=>d.status==='verified').length};
  }
  async function etl(caseId,version){
    const started=await json(`/api/cases/${caseId}/platform/etl`,{method:'POST',body:JSON.stringify({caseVersion:version,requestId:randomUUID(),consent:true})});
    check([200,202].includes(started.status),`${caseId}: ETL run accepted (HTTP ${started.status})`);
    const id=started.body?.id;
    for(let attempt=0;attempt<90;attempt++){
      const state=(await json(`/api/cases/${caseId}/platform/etl`)).body;
      const run=state?.runs?.find(r=>r.id===id)||state?.runs?.find(r=>r.id===started.body?.actualId);
      if(run&&['COMPLETE','FAILED','STALE'].includes(run.status))return run;
      await new Promise(resolve=>setTimeout(resolve,2000));
    }
    return {status:'TIMEOUT'};
  }

  const reviewed=await review(core.id);
  check(reviewed.verified>0,`core dossier: ${reviewed.verified} documents reviewed (${reviewed.reviewed} in this run)`);
  const run=await etl(core.id,reviewed.item.version);
  check(run.status==='COMPLETE',`core dossier: ETL run complete (${run.status})`);
  const tower=run.result?.controlTower;
  check(Boolean(tower),'core dossier: Control Tower marts in the run result');
  const kpi=key=>tower.kpis.find(k=>k.key===key);
  check(tower.dataQuality.every(c=>c.passed),`data-quality checks passed (${tower.dataQuality.length})`);
  check(tower.rowCounts.bronze===reviewed.item.documents.length&&tower.rowCounts.silver>0&&tower.rowCounts.reviewedGold>0,`Bronze ${tower.rowCounts.bronze}, Silver ${tower.rowCounts.silver}, reviewed Gold ${tower.rowCounts.reviewedGold}`);
  check(tower.lineage.some(e=>e.from==='bronze_documents'&&e.to==='silver_fields'),'lineage Bronze -> Silver recorded');
  check(tower.retrieval.filter(r=>!r.expectedAbstain).every(r=>r.passed),`retrieval: expected pages found (${tower.retrieval.filter(r=>!r.expectedAbstain).map(r=>`${r.case} rank ${r.rank}`).join(', ')})`);
  check(tower.retrieval.some(r=>r.case==='payment'&&r.expectedAbstain&&r.abstained),'payment question: no dated payment confirmation, abstained');
  check(tower.citations.length===2&&tower.citations.every(c=>c.pageMatch),`citations: 48.780,00 and 49.980,00 on page 2 (${tower.citations.map(c=>`${c.value} ${c.found}`).join('; ')})`);
  check(tower.export.length===19&&tower.export.every(f=>f.csv&&f.parquet),`Power BI export: ${tower.export.length} tables as CSV and Parquet`);
  check(tower.stages.length>=4&&tower.stages.every(s=>s.mode==='measured'),`stage latency measured (${tower.stages.map(s=>`${s.stage} ${s.latencyMs} ms`).join(', ')})`);
  check(kpi('estimated_cost_per_document_eur').mode==='configured','cost is labelled configured, not measured');
  report.runs.core={id:run.id,rowCounts:tower.rowCounts,kpis:tower.kpis,stages:tower.stages,retrieval:tower.retrieval,citations:tower.citations,export:tower.export.map(f=>`${f.table}:${f.rows}`),
    observations:tower.drill.map(d=>({document:d.documentName,page:d.page,field:d.field,raw:d.rawValue,normalized:d.normalizedValue,reviewed:d.reviewedValue,box:d.boundingBox,mode:d.mode}))};

  if(variant){
    const reviewedVariant=await review(variant.id);
    const second=await etl(variant.id,reviewedVariant.item.version);
    check(second.status==='COMPLETE',`instruction dossier: ETL run complete (${second.status})`);
    const instructionTower=second.result?.controlTower;
    const blocked=instructionTower?.kpis.find(k=>k.key==='prompt_injection_blocked_rate');
    const issues=(second.result?.qualityIssues||[]).filter(i=>i.code==='UNTRUSTED_INSTRUCTION_PAGE');
    check(Boolean(instructionTower)&&(blocked.mode==='not-run'||blocked.value===1),`instruction page fields kept out of reviewed Gold (rate ${blocked?.value ?? 'not run'}, ${issues.length} fields flagged)`);
    report.runs.instruction={id:second.id,rowCounts:instructionTower?.rowCounts,blocked,flaggedFields:issues.length};
  }

  // Files exist in the ETL volume; the simulated OCR fixture is applied to a copy of the evidence only through the CLI.
  const scope=run.result.scope;const folder=`/data/assets/${scope}/${run.id}`;
  const files=execFileSync('docker',['exec','credit-intelligence-lab-etl-1','sh','-c',`ls ${folder}/powerbi | wc -l`],{encoding:'utf8'}).trim();
  check(Number(files)>=40,`export folder holds ${files} files`);
  // The container's root filesystem is read-only; /tmp is a writable tmpfs, so the fixture is streamed in through stdin.
  execFileSync('docker',['exec','-i','credit-intelligence-lab-etl-1','sh','-c','cat > /tmp/ocr-misread.sample.json'],{input:readFileSync('labs/ai103/fixtures/capability/ocr-misread.sample.json')});
  const rebuilt=JSON.parse(execFileSync('docker',['exec','credit-intelligence-lab-etl-1','/opt/venv/bin/python','/app/control_tower.py',folder,'--simulate-ocr','/tmp/ocr-misread.sample.json'],{encoding:'utf8'}).trim().split('\n').pop());
  check(rebuilt.dataQuality===true,`simulated OCR rebuild: quality checks passed, ${rebuilt.rowCounts.fact_field_observation} observations`);
  const simulated=execFileSync('docker',['exec','credit-intelligence-lab-etl-1','sh','-c',`grep -c ',simulated,' ${folder}/powerbi/fact_field_observation.csv; grep ',simulated,' ${folder}/powerbi/fact_field_observation.csv | head -1`],{encoding:'utf8'});
  check(/48\.730,00/.test(simulated)&&/48\.780,00/.test(simulated)&&/corrected/.test(simulated),'simulated OCR row keeps raw 48.730,00, reviewed 48.780,00, status corrected');
  const cases=execFileSync('docker',['exec','credit-intelligence-lab-etl-1','sh','-c',`cat ${folder}/powerbi/evaluation_cases.jsonl`],{encoding:'utf8'});
  check(/"expected": "48.780,00"/.test(cases)&&/"measurementMode": "simulated"/.test(cases),'correction became a reusable evaluation case (simulated)');
  report.simulatedRebuild={rowCounts:rebuilt.rowCounts,files:rebuilt.files};
  mkdirSync('.local/control-tower',{recursive:true});
  writeFileSync('.local/control-tower/acceptance.json',JSON.stringify(report,null,2));
  console.log(`Control Tower: core ${core.id} run ${run.id}; results in .local/control-tower/acceptance.json`);
}
