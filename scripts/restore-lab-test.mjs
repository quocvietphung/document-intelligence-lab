import {spawnSync} from "node:child_process";
import {readFileSync,realpathSync} from "node:fs";
import {resolve,sep} from "node:path";

// Never overwrites the live application database or the Keycloak realm.
const [kind,file]=process.argv.slice(2);
if(!["cases","identity"].includes(kind)||!file)throw new Error("Usage: node scripts/restore-lab-test.mjs cases|identity .local/backups/<date>/<file>.dump");
const backup=realpathSync(file),root=realpathSync(".local/backups");
if(!backup.startsWith(root+sep)||!backup.endsWith(".dump"))throw new Error("Use a local backup created by backup-lab.mjs.");
const service=kind==="cases"?"case-db":"identity-db",user=kind==="cases"?"credit_lab":"keycloak";
const db="restore_lab_"+kind+"_"+Date.now();
let result=spawnSync("docker",["compose","exec","-T",service,"createdb","-U",user,db],{encoding:"utf8"});
if(result.status!==0)throw new Error("Could not create isolated restore database.");
result=spawnSync("docker",["compose","exec","-T",service,"pg_restore","-U",user,"-d",db,"--no-owner"],{input:readFileSync(resolve(backup)),maxBuffer:1_000_000});
if(result.status!==0)throw new Error("Restore failed. The isolated test database remains available for inspection.");
console.log("Restored into isolated test database "+db+". Live app and identity databases are unchanged.");
