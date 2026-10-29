import {execFileSync,spawn} from 'node:child_process';
import {createReadStream,createWriteStream,mkdirSync,readFileSync,writeFileSync,statSync,realpathSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {createHash,randomUUID} from 'node:crypto';
import {localCompose} from './docker-local.mjs';

const {args,env}=localCompose(undefined,{analytics:true}),base=resolve('.local/backups');
const run=(a)=>execFileSync('docker',a,{env,encoding:'utf8',maxBuffer:8_000_000}).trim();
const compose=(a)=>run([...args,...a]);
async function stream(args,file,input=false){
  const process=spawn('docker',args,{env,stdio:['pipe','pipe','pipe']});process.stderr.resume();
  const done=new Promise((ok,fail)=>{process.on('error',fail);process.on('close',code=>code===0?ok():fail(Error('Docker backup/restore step failed; inspect local service health.')));});
  const io=input?pipeline(createReadStream(file),process.stdin):pipeline(process.stdout,createWriteStream(file,{flags:'wx',mode:0o600}));
  if(input)process.stdout.resume();else process.stdin.end();
  await Promise.all([io,done]);
}
async function digest(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
const volumeKinds=['lab_documents','lab_etl','lab_vectors','lab_limits','lab_analytics'];
function archivePathsSafe(list){return list.split('\n').filter(Boolean).every(p=>!p.startsWith('/')&&!p.split('/').includes('..'));}
async function backup(){
  const folder=join(base,'workspace-'+new Date().toISOString().replaceAll(':','-'));mkdirSync(folder,{recursive:true,mode:0o700});
  const configuration=JSON.parse(compose(['config','--format','json']));
  const services=['web','credit-api','keycloak','etl','qdrant','redis','ml-worker','mlflow'];const paused=[];
  const resume=()=>{let failed=false;for(const id of paused.splice(0).reverse())try{run(['unpause',id]);}catch{failed=true;}if(failed)throw Error('Some services could not resume; inspect Docker paused containers.');};
  const interrupted=()=>{try{resume();}finally{process.exit(130);}};
  process.once('SIGINT',interrupted);process.once('SIGTERM',interrupted);
  const manifest={format:'private-workspace-backup-v1',consistency:'writers-paused; volume files are crash-consistent, not Qdrant logical snapshots',
    omitted:['model weights','antivirus signatures','cloud resources','Azure credentials','host browser downloads'],files:[],volumes:[]};
  try{
    for(const service of services){const id=compose(['ps','-q',service]);if(id&&run(['inspect','--format','{{.State.Running}} {{.State.Paused}}',id])==='true false'){run(['pause',id]);paused.push(id);}}
    for(const [service,user,database] of [['case-db','credit_lab','credit_cases'],['identity-db','keycloak','keycloak']]){
      const file=database+'.dump';await stream([...args,'exec','-T',service,'pg_dump','-U',user,'-Fc',database],join(folder,file));manifest.files.push({file,sha256:await digest(join(folder,file)),kind:'database',database});
    }
    for(const kind of volumeKinds){
      const volume=configuration.volumes?.[kind]?.name;if(!volume)throw Error('Required volume absent: '+kind);
      try{run(['volume','inspect','--format','{{.Name}}',volume]);}catch(error){if(kind==='lab_analytics'){manifest.omitted.push('analytics volume has not been created');continue;}throw error;}const file=kind+'.tar.gz';
      await stream(['run','--rm','--network','none','--read-only','--memory','64m','--mount',`type=volume,source=${volume},target=/data,readonly`,'busybox:1.37','tar','-czf','-','-C','/data','.'],join(folder,file));
      manifest.files.push({file,sha256:await digest(join(folder,file)),kind:'volume',volumeKind:kind});manifest.volumes.push(kind);
    }
    const references=resolve('.local/reference-pdfs');
    if(statSync(references,{throwIfNoEntry:false})?.isDirectory()){
      const file='reference-pdfs.tar.gz';await stream(['run','--rm','--network','none','--read-only','--memory','64m','--mount',`type=bind,source=${references},target=/data,readonly`,'busybox:1.37','tar','-czf','-','-C','/data','.'],join(folder,file));
      manifest.files.push({file,sha256:await digest(join(folder,file)),kind:'references'});
    }
    writeFileSync(join(folder,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});
    console.log('Private workspace backup: '+folder+' · '+manifest.files.length+' streamed archives. Models/signature caches are excluded.');
  }finally{process.removeListener('SIGINT',interrupted);process.removeListener('SIGTERM',interrupted);resume();}
}
async function verify(path,keep=false){
  const folder=realpathSync(path),root=realpathSync(base);if(!folder.startsWith(root+sep))throw Error('Use a backup under .local/backups');
  const manifest=JSON.parse(readFileSync(join(folder,'manifest.json'),'utf8'));
  if(manifest.format!=='private-workspace-backup-v1'||!Array.isArray(manifest.files)||manifest.files.length>10)throw Error('Invalid manifest');
  const suffix=randomUUID().slice(0,8);
  // Verify every byte before creating any isolated restore destination.
  for(const item of manifest.files){if(!/^[a-z_-]+\.(dump|tar\.gz)$/.test(item.file)||await digest(join(folder,item.file))!==item.sha256)throw Error('Archive integrity check failed');}
  const created=[];
  try{for(const item of manifest.files){
    const file=join(folder,item.file);
    if(item.kind==='database'){
      const identity=item.database==='keycloak';if(!identity&&item.database!=='credit_cases')throw Error('Unknown database');
      const service=identity?'identity-db':'case-db',user=identity?'keycloak':'credit_lab',database='restore_workspace_'+(identity?'identity_':'cases_')+suffix;
      compose(['exec','-T',service,'createdb','-U',user,database]);created.push({service,user,database});
      await stream([...args,'exec','-T',service,'pg_restore','-U',user,'-d',database,'--no-owner'],file,true);
      console.log('Restored isolated database: '+database);
    }else if(item.kind==='volume'||item.kind==='references'){
      const volume='document-lab-restore-'+suffix+'-'+(item.volumeKind||'references');
      if(!/^document-lab-restore-[a-f0-9]{8}-[a-z_]+$/.test(volume))throw Error('Invalid restore volume');
      const source=`type=bind,source=${folder},target=/backup,readonly`;
      const list=run(['run','--rm','--network','none','--read-only','--mount',source,'busybox:1.37','tar','-tzf','/backup/'+item.file]);
      if(!archivePathsSafe(list))throw Error('Unsafe archive paths');
      if(run(['volume','ls','--format','{{.Name}}']).split('\n').includes(volume))throw Error('Restore volume already exists');
      run(['volume','create','--label','document-lab.restore-check=true',volume]);created.push({volume});
      run(['run','--rm','--network','none','--read-only','--memory','256m','--mount',source,'--mount',`type=volume,source=${volume},target=/restore`,'busybox:1.37','tar','-xzf','/backup/'+item.file,'-C','/restore']);
      console.log('Restored isolated volume: '+volume);
    }else throw Error('Unknown archive kind');
  }
  }finally{if(!keep)for(const item of created.reverse()){if(item.volume)run(['volume','rm',item.volume]);else compose(['exec','-T',item.service,'dropdb','-U',item.user,item.database]);}}
  console.log('All archive hashes and isolated restores passed. Live databases/volumes were not replaced. '+(keep?'Test copies remain for inspection.':'Only this run’s temporary restore copies were removed.'));
}
const [mode,path,flag]=process.argv.slice(2);
if(mode==='--create'&&!path)await backup();else if(mode==='--verify'&&path&&(!flag||flag==='--keep-restores'))await verify(path,flag==='--keep-restores');else throw Error('Usage: node scripts/backup-workspace.mjs --create | --verify .local/backups/workspace-...');
