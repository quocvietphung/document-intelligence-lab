import {spawnSync,execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const localModel='qwen3:4b-instruct-2507-q4_K_M';
export const ollamaImage='document-lab-ollama-cpu:0.40.6';
export function validateModel(value){if(!/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,99}$/.test(value)||value.includes('..')||value.includes('://')||/(?:-cloud|:cloud)(?::.*)?$/i.test(value))throw Error('Select a local model identifier, not a URL or cloud model');return value;}
export function localCompose(model=localModel){return {args:['compose','-f','docker-compose.yml','-f','docker-compose.platform.yml','-f','docker-compose.docling.yml','-f','docker-compose.nova-local.yml'],env:{...process.env,OLLAMA_CHAT_MODEL:validateModel(model)}};}
export function warmupRequest(model=localModel){return JSON.stringify({model:validateModel(model),prompt:'',stream:false,keep_alive:'30m',options:{num_ctx:4096}});}
function run(args,options={}){const result=spawnSync('docker',args,{cwd:root,stdio:'inherit',...options});if(result.error||result.status!==0)throw Error('Docker step failed; existing documents and databases were not removed');return result;}
function output(args){return execFileSync('docker',args,{cwd:root,encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe']}).trim();}
export function freeDiskKb(value,minimumGiB=8){const available=Number(value.trim().split('\n').at(-1)?.trim().split(/\s+/)[3]);if(!Number.isFinite(available)||available<minimumGiB*1024*1024)throw Error(`Keep at least ${minimumGiB} GiB available inside Docker. Do not delete database/PDF volumes`);return available;}
async function main(){
  const flags=process.argv.slice(2);if(flags.some(flag=>!['--prepare-model','--no-build'].includes(flag)))throw Error('Usage: node scripts/docker-local.mjs [--prepare-model] [--no-build]');
  const {args,env}=localCompose(process.env.OLLAMA_CHAT_MODEL||localModel);
  output(['info','--format','{{.ServerVersion}}']);
  try{output(['image','inspect','busybox:1.37']);}catch{run(['pull','busybox:1.37']);}
  freeDiskKb(output(['run','--rm','--pull','never','--network','none','busybox:1.37','df','-Pk','/']),flags.includes('--prepare-model')?8:1);
  if(flags.includes('--prepare-model')){
    console.log(`Explicit local model preparation: ${env.OLLAMA_CHAT_MODEL}. This downloads weights, not an Azure request.`);
    // Reuse the already built pinned CPU engine; model preparation must not re-fetch its full upstream image.
    try{output(['image','inspect',ollamaImage]);}catch{run([...args,'build','ollama'],{env});}
    // Only this newly created ephemeral container is stopped; its named model volume persists.
    const name='document-lab-model-setup';
    if(output(['ps','-aq','--filter',`name=^/${name}$`]))throw Error('A model-preparation container already exists. Inspect it before retrying; nothing was removed');
    const id=output(['run','-d','--rm','--name',name,'--network','bridge','--memory','5g','--cpus','3','-e','OLLAMA_NO_CLOUD=1','-v','credit-intelligence-lab_lab_ollama:/root/.ollama',ollamaImage]);
    try{
      let ready=false;for(let n=0;n<30;n++){const probe=spawnSync('docker',['exec',id,'ollama','list'],{stdio:'ignore',timeout:5000});if(probe.status===0){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,1000));}
      if(!ready)throw Error('Model-preparation daemon did not become ready');
      run(['exec',id,'ollama','pull',env.OLLAMA_CHAT_MODEL]);
      run(['exec',id,'ollama','show',env.OLLAMA_CHAT_MODEL]);
    }finally{run(['stop',id]);}
  }
  // Start only the engine first and fail fast when weights have not been explicitly prepared.
  run([...args,'up','-d','--no-deps','--no-build','ollama'],{env});
  let engineReady=false;for(let n=0;n<30;n++){const probe=spawnSync('docker',[...args,'exec','-T','ollama','ollama','list'],{env,cwd:root,stdio:'ignore',timeout:5000});if(probe.status===0){engineReady=true;break;}await new Promise(resolve=>setTimeout(resolve,1000));}
  if(!engineReady)throw Error('Local model engine did not become ready; inspect the ollama service logs');
  const installed=spawnSync('docker',[...args,'exec','-T','ollama','ollama','show',env.OLLAMA_CHAT_MODEL],{env,cwd:root,stdio:'ignore',timeout:15000});
  if(installed.status!==0)throw Error('Model not installed. Explicitly prepare it with: node scripts/docker-local.mjs --prepare-model');
  console.log('Starting local Docling + Nova. No Azure credentials or model fallback are enabled.');
  // Ordinary app builds must not re-download the large upstream engine after cache cleanup.
  if(!flags.includes('--no-build')){
    // Do not compete with resident model/cache RAM while rebuilding the app.
    run([...args,'stop','ollama'],{env});
    run([...args,'build','web','credit-api'],{env});
  }
  run([...args,'up','-d','--no-build','--wait','--wait-timeout','420'],{env});
  console.log('Loading the selected local model into RAM; no document or question is sent.');
  run(['run','--rm','--read-only','--memory','64m','--network','credit-intelligence-lab_local_models','--pull','never','busybox:1.37','wget','-qO-','-T','300','--header','Content-Type: application/json','--post-data',warmupRequest(env.OLLAMA_CHAT_MODEL),'http://ollama:11434/api/generate']);
  run([...args,'exec','-T','ollama','ollama','show',env.OLLAMA_CHAT_MODEL],{env});
  console.log('Local workspace: http://localhost:3000/en · Sign in with your existing Keycloak lab account.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error instanceof Error?error.message:'Local startup failed');process.exitCode=1;});
