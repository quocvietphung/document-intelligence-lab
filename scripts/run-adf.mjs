import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';

/** Uses an EXISTING operator-approved pipeline; never creates a resource or exposes localhost. */
export function adfRequest(input,env){
  const resource=env.AZURE_ADF_RESOURCE_ID,pipeline=env.AZURE_ADF_PIPELINE;
  if(!resource?.match(/^\/subscriptions\/[a-fA-F0-9-]{36}\/resourceGroups\/[a-zA-Z0-9_.()-]{1,90}\/providers\/Microsoft\.DataFactory\/factories\/[a-zA-Z0-9-]{3,63}$/)||!pipeline?.match(/^[a-zA-Z0-9_-]{1,80}$/))throw new Error('Configure an existing Data Factory resource ID and pipeline');
  if(input.schemaVersion!=='adf-intake-request-v1'||!input.requestId?.match(/^[a-fA-F0-9-]{36}$/)||!input.caseId?.match(/^[-a-zA-Z0-9]{1,80}$/)||!input.sourcePrefix?.match(/^[a-f0-9]{64}\/$/))throw new Error('Invalid scoped ADF request');
  return {url:`https://management.azure.com${resource}/pipelines/${pipeline}/createRun?api-version=2018-06-01`,body:{labRequestId:input.requestId,labCaseId:input.caseId,labSourcePrefix:input.sourcePrefix}};
}
export function runAdf(input,env,execute,invoke=execFileSync){
  const request=adfRequest(input,env);
  if(!execute)return {mode:'validation-only',cloudCalled:false,parameters:Object.keys(request.body)};
  const value=JSON.parse(invoke('az',['rest','--method','POST','--url',request.url,'--body',JSON.stringify(request.body),'--output','json'],{encoding:'utf8',timeout:30000,maxBuffer:100000,stdio:['ignore','pipe','pipe'],env:{...env,AZURE_EXTENSION_USE_DYNAMIC_INSTALL:'no'}}));
  if(!value.runId?.match(/^[a-fA-F0-9-]{36}$/))throw new Error('Data Factory did not return a run ID');
  return {mode:'azure-data-factory',cloudCalled:true,runId:value.runId,requestId:input.requestId};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const inputPath=process.argv[2];if(!inputPath)throw new Error('Usage: node scripts/run-adf.mjs .local/request.json [--execute-cloud --ack-remote-connectivity]');
    if(statSync(inputPath).size>100000)throw new Error('ADF request too large');
    const input=JSON.parse(readFileSync(inputPath,'utf8'));const execute=process.argv.includes('--execute-cloud');
    if(execute&&!process.argv.includes('--ack-remote-connectivity'))throw new Error('Review pipeline connectivity and permissions first; Azure cannot call Mac localhost');
    adfRequest(input,process.env);
    if(execute){const receipt=resolve('.local/adf-runs',`${input.requestId}.json`);mkdirSync(dirname(receipt),{recursive:true,mode:0o700});writeFileSync(receipt,JSON.stringify({state:'SUBMITTING',requestId:input.requestId}),{flag:'wx',mode:0o600});
      try{const result=runAdf(input,process.env,true);writeFileSync(receipt,JSON.stringify(result),{mode:0o600});console.log(JSON.stringify(result));}catch{throw new Error('Submission uncertain. Inspect the private receipt and Azure run history before retrying; never assume exactly-once execution');}
    }else console.log(JSON.stringify(runAdf(input,process.env,false)));
  }catch(error){console.error(error instanceof Error?error.message:'ADF request failed');process.exitCode=1;}
}
