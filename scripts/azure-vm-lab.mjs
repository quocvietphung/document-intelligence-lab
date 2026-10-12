/** Explicit operator actions; no secret values or tokens are logged. */
import {execFileSync} from 'node:child_process';
import {mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync, copyFileSync, mkdtempSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=resolve(fileURLToPath(new URL('..',import.meta.url)));
const infra=join(repo,'infra/azure/vm-lab');
const privateDir=join(repo,'.local/azure-vm');
const action=process.argv[2];
function run(bin,args,options={}) { return execFileSync(bin,args,{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','inherit'],...options}); }
function tf(args,options={}) { return run('terraform',[`-chdir=${infra}`,...args],options); }
function outputs(){return JSON.parse(tf(['output','-json']));}
function value(o,k){if(!o[k]?.value)throw new Error(`Missing Terraform output ${k}`);return o[k].value;}
const key=join(privateDir,'id_ed25519');
function target(o){return `labadmin@${value(o,'public_ip')}`;}
function ssh(o,command,options={}) {
  return run('ssh',['-i',key,'-o','StrictHostKeyChecking=accept-new','-o',`UserKnownHostsFile=${join(privateDir,'known_hosts')}`,target(o),command],options);
}
if(action==='prepare'){
  mkdirSync(privateDir,{recursive:true,mode:0o700});chmodSync(privateDir,0o700);
  const account=JSON.parse(run('az',['account','show','-o','json']));
  if(account.state!=='Enabled')throw new Error('Subscription is not enabled');
  if(!existsSync(key))run('ssh-keygen',['-q','-t','ed25519','-N','','-C','credit-lab-azure','-f',key]);
  chmodSync(key,0o600);
  const ipv4=(await (await fetch('https://api.ipify.org',{signal:AbortSignal.timeout(10000)})).text()).trim();
  if(!/^\d{1,3}(\.\d{1,3}){3}$/.test(ipv4)||ipv4.split('.').some(n=>+n>255))throw new Error('Cannot restrict SSH: IPv4 not resolved');
  const shutdown=new Date(Date.now()+8*60*60*1000).toISOString().slice(11,16).replace(':','');
  const vars=join(infra,'operator.auto.tfvars.json');
  if(existsSync(vars))throw new Error('Operator variables already exist; preserve the original subscription and shutdown schedule.');
  writeFileSync(vars,JSON.stringify({subscription_id:account.id,ssh_public_key:readFileSync(key+'.pub','utf8').trim(),ssh_source_cidr:ipv4+'/32',shutdown_time_utc:shutdown},null,2),{mode:0o600});
  console.log(`Prepared dedicated SSH key, operator-only SSH and daily shutdown ${shutdown} UTC. No Azure resources created.`);
}else if(action==='plan'){
  const plan=join(privateDir,'deployment.tfplan');
  tf(['plan','-input=false','-out='+plan]);
  const summary=JSON.parse(tf(['show','-json',plan]));
  const resources=(summary.resource_changes??[]).filter(r=>r.mode==='managed');
  if(resources.some(r=>r.change.actions.includes('delete')))throw new Error('Destructive plan refused; review manually.');
  if(resources.some(r=>!r.address.startsWith('azurerm_')))throw new Error('Unexpected resource type');
  const creatingVm=resources.find(r=>r.type==='azurerm_linux_virtual_machine'&&r.change.actions.includes('create'));
  if(creatingVm){
    const vm=creatingVm.change.after;
    const families={Standard_D2as_v4:['standardDASv4Family',2],Standard_D2as_v5:['standardDASv5Family',2],Standard_D4as_v5:['standardDASv5Family',4],Standard_D2s_v5:['standardDSv5Family',2]};
    const selected=families[vm.size];if(!selected)throw new Error('VM cost/quota preflight required');
    const usage=JSON.parse(run('az',['vm','list-usage','--subscription',summary.variables.subscription_id.value,'--location',vm.location,'-o','json']));
    for(const name of [selected[0],'cores']){
      const quota=usage.find(q=>q.name.value.toLowerCase()===name.toLowerCase());
      if(!quota||Number(quota.currentValue)+selected[1]>Number(quota.limit))throw new Error(`Insufficient ${name} quota; no apply permitted. Choose an available reviewed SKU or request quota separately.`);
    }
  }
  chmodSync(plan,0o600);
  console.log('Plan reviewed: '+resources.filter(r=>r.change.actions.includes('create')).length+' creates; no deletions.');
}else if(action==='apply'){
  // Apply only the saved plan previously inspected by the operator.
  tf(['apply','-input=false',join(privateDir,'deployment.tfplan')],{stdio:'inherit'});
  const state=join(infra,'terraform.tfstate');if(existsSync(state))chmodSync(state,0o600);
}else if(action==='deploy'){
  const o=outputs(),host=new URL(value(o,'backend_url')).hostname;
  const dir=mkdtempSync(join(privateDir,'bundle-'));
  run('tar',['-czf',join(dir,'credit-api.tgz'),'--exclude=target','--exclude=.vercel','--exclude=.env*','-C',join(repo,'services'),'credit-api'],{env:{...process.env,COPYFILE_DISABLE:'1'}});
  for(const file of ['compose.yml','Caddyfile','Dockerfile.keycloak','bootstrap.sh'])copyFileSync(join(infra,file),join(dir,file));
  copyFileSync(join(repo,'infra/observability/otel.yml'),join(dir,'otel.yml'));
  copyFileSync(join(repo,'infra/keycloak/credit-intelligence-production-realm.json.template'),join(dir,'realm-template.json'));
  const bundle=join(privateDir,'backend.tgz');
  run('tar',['-czf',bundle,'-C',dir,'.'],{env:{...process.env,COPYFILE_DISABLE:'1'}});
  // The archive contains source only: no local DB volumes, private PDFs, envs or tokens.
  ssh(o,'sudo cloud-init status --wait && sudo test -d /opt/credit-lab && sudo docker compose version',{stdio:'inherit'});
  run('scp',['-i',key,'-o','StrictHostKeyChecking=accept-new','-o',`UserKnownHostsFile=${join(privateDir,'known_hosts')}`,bundle,`${target(o)}:/home/labadmin/backend.tgz`]);
  ssh(o,`sudo tar --no-same-owner -xzf /home/labadmin/backend.tgz -C /opt/credit-lab && sudo tar --no-same-owner -xzf /opt/credit-lab/credit-api.tgz -C /opt/credit-lab && sudo chown root:labadmin /opt/credit-lab && sudo chmod 0750 /opt/credit-lab && sudo bash /opt/credit-lab/bootstrap.sh '${host}' 'https://credit-intelligence-lab.vercel.app'`,{stdio:'inherit'});
}else if(action==='status'||action==='stop'||action==='start'){
  const o=outputs(),args=['--ids',value(o,'vm_id')];
  if(action==='status')console.log(run('az',['vm','get-instance-view',...args,'--query','instanceView.statuses[].displayStatus','-o','tsv']));
  else run('az',['vm',action==='stop'?'deallocate':'start',...args],{stdio:'inherit'});
}else if(action==='credentials'){
  const o=outputs();mkdirSync(privateDir,{recursive:true,mode:0o700});
  const raw=ssh(o,"sudo python3 -c \"from pathlib import Path; import json; d=dict(l.split('=',1) for l in Path('/opt/credit-lab/secrets/runtime.env').read_text().splitlines()); print(json.dumps({'username':'advisor.demo','password':d['ADVISOR_PASSWORD']}))\"");
  const credentials=JSON.parse(raw);if(!credentials.password||credentials.username!=='advisor.demo')throw new Error('Invalid credentials response');
  writeFileSync(join(privateDir,'advisor.json'),JSON.stringify(credentials,null,2),{mode:0o600});
  console.log('Saved private local credentials to .local/azure-vm/advisor.json (not Git, not logged).');
}else{
  console.log('Actions: prepare | plan | apply | deploy | credentials | status | stop | start');
  process.exitCode=action?1:0;
}
