// Renders the production Compose configuration with Docker Compose itself and proves that it contains
// no Spark service, image or build, with and without the optional analytics overlay and with every
// profile enabled. Usage: node scripts/check-production-compose.mjs
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {localCompose,localModel} from './docker-local.mjs';
import {missingServices,sparkFindings} from './compose-files.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');

function render(args,env){
  // --profile '*' enables every profile, so an optional profile cannot hide a Spark service.
  const output=execFileSync('docker',[...args,'--profile','*','config','--format','json'],{cwd:root,env,encoding:'utf8',maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});
  return JSON.parse(output);
}

let failed=false;
for(const variant of [{name:'production',analytics:false},{name:'production + analytics',analytics:true}]){
  const {args,env}=localCompose(process.env.OLLAMA_CHAT_MODEL||localModel,{analytics:variant.analytics});
  const config=render(args,env);
  const spark=sparkFindings(config);
  const missing=missingServices(config);
  const services=Object.keys(config.services).sort();
  console.log(`${variant.name}: ${services.length} services -> ${services.join(', ')}`);
  if(spark.length){failed=true;console.error(`  Spark found: ${spark.join('; ')}`);}
  else console.log('  Spark: none (no service, image or build)');
  if(missing.length){failed=true;console.error(`  Missing required services: ${missing.join(', ')}`);}
}
if(failed){console.error('Production Compose check failed.');process.exitCode=1;}
else console.log('Production Compose check passed.');
