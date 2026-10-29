import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {localCompose} from './docker-local.mjs';

export function retentionPlan(args,now=new Date()){
  const values={};let apply=false;
  for(let i=0;i<args.length;i++){const key=args[i];if(key==='--apply')apply=true;else if(['--tenant','--case','--before','--confirm-case'].includes(key)&&args[i+1]&&!Object.hasOwn(values,key))values[key]=args[++i];else throw Error('Invalid retention arguments');}
  if(!/^[A-Za-z0-9_-]{1,120}$/.test(values['--tenant']||'')||!/^[-A-Za-z0-9]{1,80}$/.test(values['--case']||''))throw Error('Supply one tenant and case');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(values['--before']||''))throw Error('Use an explicit UTC ISO cutoff');
  const date=new Date(values['--before']);
  const canonical=values['--before'].replace(/(?<!\.\d{3})Z$/,'.000Z');
  if(!Number.isFinite(date.getTime())||date.toISOString()!==canonical||date.getTime()>now.getTime()-86400000)throw Error('Supply a valid ISO cutoff at least one day in the past');
  if(apply&&values['--confirm-case']!==values['--case'])throw Error('Apply requires --confirm-case matching the case');
  return {tenant:values['--tenant'],caseId:values['--case'],before:date.toISOString(),apply};
}
function main(){
  const plan=retentionPlan(process.argv.slice(2));const {args,env}=localCompose();
  // Inputs have strict alphabets; SQL contains no document text or credentials.
  const where=`tenant='${plan.tenant}' AND case_id='${plan.caseId}' AND kind IN ('inspection-run','trust-answer','trust-feedback') AND created_at < '${plan.before}'::timestamptz AND COALESCE(payload::jsonb->>'status','') NOT IN ('QUEUED','RUNNING')`;
  let sql=`SELECT json_build_object('kind',kind,'records',count(*)) FROM lab_records WHERE ${where} GROUP BY kind ORDER BY kind`;
  if(plan.apply){const id=randomUUID();sql=`BEGIN; WITH removed AS (DELETE FROM lab_records WHERE ${where} RETURNING kind), summary AS (SELECT kind,count(*) AS records FROM removed GROUP BY kind) INSERT INTO lab_records(tenant,case_id,kind,id,created_at,payload) SELECT '${plan.tenant}','${plan.caseId}','history-purge','${id}',CURRENT_TIMESTAMP,json_build_object('actor','local-operator','cutoff','${plan.before}','removed',COALESCE(json_agg(summary),'[]'::json))::text FROM summary; COMMIT; SELECT payload FROM lab_records WHERE tenant='${plan.tenant}' AND case_id='${plan.caseId}' AND kind='history-purge' AND id='${id}';`;}
  const result=execFileSync('docker',[...args,'exec','-T','case-db','psql','-U','credit_lab','-d','credit_cases','-v','ON_ERROR_STOP=1','-tA','-c',sql],{env,encoding:'utf8',maxBuffer:1_000_000});
  console.log(plan.apply?'Explicit scoped history purge completed. Private originals, fields, corrections, reviewer tasks and references remain.':'DRY RUN: no deletion. Originals, corrections, tasks and reference datasets are outside this policy.');console.log(result.trim()||'No eligible history records.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main();
