import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,realpathSync,statSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {localCompose} from './docker-local.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const flags=process.argv.slice(2);
if(flags.length!==2||flags[0]!=='--input')throw Error('Usage: node scripts/run-document-classification.mjs --input /path/to/classification-input.json');
const input=realpathSync(resolve(flags[1]));if(statSync(input).size>2_000_000)throw Error('Benchmark input exceeds the bounded request size');
const value=JSON.parse(readFileSync(input,'utf8'));
if(value.format!=='classification-input-v1'||typeof value.datasetJson!=='string'||createHash('sha256').update(value.datasetJson).digest('hex')!==value.datasetFingerprint)throw Error('Export a verified benchmark input from Research lab first');
const {args,env}=localCompose(undefined,{analytics:true}),result='/data/classification-cli/'+randomUUID();
const run=command=>execFileSync('docker',command,{cwd:root,env,stdio:'inherit'});
run([...args,'build','ml-worker']);run([...args,'run','--rm','--no-deps','analytics-init']);
run(['run','--rm','--network','none','--read-only','--memory','768m','--cpus','1','--tmpfs','/tmp:size=128m,mode=1777',
  '--mount',`type=bind,source=${input},target=/input.json,readonly`,'--mount','type=volume,source=credit-intelligence-lab_lab_analytics,target=/data',
  '--entrypoint','python','document-lab-analytics:1','classification.py','--input','/input.json','--output',result+'/report.json',
  '--models-root',result+'/model','--tracking-uri','sqlite:////data/tracking/mlflow.db']);
console.log('Private benchmark and model artifacts: '+result+' (analytics volume). No operational document type was changed.');
