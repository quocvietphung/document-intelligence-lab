import {spawnSync} from "node:child_process";
import {mkdirSync,writeFileSync,chmodSync} from "node:fs";
import {resolve} from "node:path";

// Local backups include user evidence. Keep them outside Git; never print their content.
const target=resolve(".local/backups",new Date().toISOString().replaceAll(":","-"));
mkdirSync(target,{recursive:true,mode:0o700});
for(const [service,user,db] of [["case-db","credit_lab","credit_cases"],["identity-db","keycloak","keycloak"]]){
  const result=spawnSync("docker",["compose","exec","-T",service,"pg_dump","-U",user,"-Fc",db],{maxBuffer:100_000_000});
  if(result.status!==0)throw new Error("Backup failed; check Docker and service health.");
  const file=resolve(target,db+".dump");writeFileSync(file,result.stdout,{mode:0o600});chmodSync(file,0o600);
}
console.log("Database backups created in "+target+". Test restore in a separate database; see docs/RELIABILITY_LAB.md.");
