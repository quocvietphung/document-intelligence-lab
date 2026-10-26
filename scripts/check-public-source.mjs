import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// Filename guard, not a secret scanner or legal clearance. Never prints file contents.
export function publicationRisk(path){
  if(/(?:^|\/)(?:\.local|\.vercel|\.terraform|node_modules|\.next)(?:\/|$)/.test(path))return 'private/generated directory';
  if(/(?:^|\/)\.env(?:\.|$)/.test(path)&&!['.env.example','.env.azure.example'].includes(path))return 'private environment configuration';
  if(/\.(?:tfstate(?:\..*)?|tfplan|pem|key|p12|pfx|safetensors|gguf|onnx|bin)$/i.test(path)||/\.tfvars(?:\.json)?$/.test(path))return 'state, credential or model artifact';
  if(/\.(?:sql|dump|bak)$/i.test(path)&&!path.startsWith('services/credit-api/src/main/resources/db/migration/')&&!/^services\/document-etl\/dbt\/models\/[\w-]+\.sql$/.test(path))return 'database export';
  if(/\.pdf$/i.test(path)&&!/^services\/credit-api\/src\/test\/resources\/evidence\/(?:evidence-inspection-regression|structure-regression|scanned-skew-regression)\.pdf$/.test(path)&&!/^services\/credit-api\/src\/test\/resources\/legacy-(payroll|research)\/[\w-]+\.pdf$/.test(path))return 'PDF without an approved test-fixture location';
  return null;
}

export function checkPublicSource(){
  const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
  const risks=files.flatMap(path=>{const reason=publicationRisk(path);return reason?[{path,reason}]:[];});
  if(JSON.parse(readFileSync('package.json','utf8')).license!=='MIT')risks.push({path:'package.json',reason:'missing MIT metadata'});
  for(const path of ['LICENSE','CONTRIBUTING.md','SECURITY.md','THIRD_PARTY_NOTICES.md']){
    try{if(!readFileSync(path,'utf8').trim())throw new Error();}catch{risks.push({path,reason:'missing publication documentation'});}
  }
  return {files:files.length,risks};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const result=checkPublicSource();
  for(const risk of result.risks)console.error(`${risk.path}: ${risk.reason}`);
  console.log(`Public-source filename check: ${result.files} files; ${result.risks.length} risks. Secret/history and asset-rights reviews are separate.`);
  process.exitCode=result.risks.length?1:0;
}
