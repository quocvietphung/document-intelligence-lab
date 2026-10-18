import {spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function docker(args){
  const result=spawnSync('docker',args,{cwd:root,stdio:'inherit'});
  if(result.error||result.status!==0){console.error('Local Docling check stopped; inspect the preceding error. Existing app services and volumes were not removed.');process.exit(result.status||1);}
}

// A full Docker disk can stop PostgreSQL, not just a model download. Fail early.
const disk=spawnSync('docker',['run','--rm','--network','none','busybox:1.37','df','-Pk','/'],{cwd:root,encoding:'utf8'});
const available=Number(disk.stdout?.trim().split('\n').at(-1)?.trim().split(/\s+/)[3]);
if(disk.status!==0||!Number.isFinite(available)||available<12*1024*1024){
  console.error('Docling check needs at least 12 GiB available inside Docker for images/build cache and a database safety margin. Free unused build cache with permission or increase Docker disk capacity; never delete database volumes. No app services were changed.');
  process.exit(1);
}

// Only the optional parser is started. The user's existing API/provider stays unchanged.
docker(['compose','-f','docker-compose.yml','-f','docker-compose.platform.yml','-f','docker-compose.docling.yml',
  'up','-d','--no-deps','--wait','--wait-timeout','360','docling']);
// Build stage contains Maven and its dependency cache; host Java/Maven are unnecessary.
const image='document-intelligence-lab-docling-check:local';
docker(['build','--target','docling-check','-t',image,'services/credit-api']);
docker(['run','--rm','--network','credit-intelligence-lab_document_parser','-w','/workspace',
  '-e','DOCLING_LIVE_URL=http://docling:5001',image,
  'mvn','--offline','--batch-mode','-q','-Dtest=DoclingDocumentIntelligenceLiveTest','test']);
console.log('PASS: Java → real local Docling → synthetic PDF text/table → reviewable evidence. No Azure inference. Parser remains available; the app provider was not switched.');
