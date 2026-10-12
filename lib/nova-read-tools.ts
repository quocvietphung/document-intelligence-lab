import type {WorkspaceCase} from "./credit-api";
import {bankingSchema,accountBalance,bankMoney} from "./banking";
import {platformSchema,searchSchema} from "./platform";
import {demoBanking,demoPlatform,demoSearch} from "./public-demo";
import type {WorkspaceTab} from "./nova-guide";
export type NovaReadResult={rows:string[];sources:{id:string;title:string;text:string}[];demo:boolean};
export async function novaReadTool(feature:WorkspaceTab,item:WorkspaceCase,locale:string,demo:boolean,token?:string,query?:string,signal?:AbortSignal):Promise<NovaReadResult>{
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(item.id))throw new Error("Invalid case");
  const root=`/api/cases/${item.id}`;
  async function read(path:string,question?:string){
    if(!token)throw new Error("Authentication required");
    const response=await fetch(root+path,{method:question?"POST":"GET",headers:{Authorization:`Bearer ${token}`,...(question?{"Content-Type":"application/json"}:{})},body:question?JSON.stringify({question}):undefined,cache:"no-store",signal});
    if(!response.ok)throw new Error("Read unavailable");return response.json();
  }
  const result:NovaReadResult={rows:[],sources:[],demo};
  if(feature==="documents") {result.sources=item.documents.filter(d=>d.status!=="missing").map(d=>({id:d.id+":p1",title:d.name,text:`${d.status} · ${d.analysisProvider||"unknown"} · ${(d.fields||[]).map(f=>`${f.label}: ${f.value}`).join("; ")}`}));return result;}
  if(feature==="overview") {result.rows=[`${item.id} · ${item.applicant}`,`${item.status} · ${item.progress}%`,...item.issues.map(i=>`${i.title}: ${i.detail}`)];return result;}
  if(feature==="audit") {result.rows=item.audit.map(row=>row.join(" · "));return result;}
  if(feature==="banking") {const bank=demo?demoBanking(item.id):bankingSchema.parse(await read("/banking"));if(bank.caseId!==item.id)throw new Error("Case mismatch");result.rows=[...bank.accounts.map(a=>`${a.label}: ${bankMoney(accountBalance(bank,a.id),locale)}`),...bank.transactions.slice(0,8).map(t=>`${t.date} · ${t.counterparty} · ${bankMoney(t.amountCents,locale)}`)];return result;}
  if(feature==="studio"&&query?.trim()){const bounded=query.trim().slice(0,2000);const data=demo?demoSearch(bounded):searchSchema.parse(await read("/platform/search",bounded));result.sources=data.search.hits.map(h=>({id:h.id,title:h.title,text:h.text}));result.rows=[data.search.backend];return result;}
  const data=demo?demoPlatform(item.id):platformSchema.parse(await read("/platform"));
  if(data.caseId!==item.id)throw new Error("Case mismatch");
  if(feature==="pipeline")result.rows=[data.documentPipeline.provider.activeProvider,data.documentPipeline.provider.modelId,...data.jobs.slice(0,10).map(j=>`${j.name}: ${j.status} · ${j.stage}`)];
  if(feature==="controls")result.rows=[...data.banking.alerts.map(a=>`${a.code}: ${a.detail}`),...data.banking.reconciliation.map(r=>`${r.field}: ${r.value} · ${r.state}`)];
  if(feature==="evaluation")result.rows=data.evaluations.slice(0,2).map(e=>`${e.version} · ${e.references} · Precision ${e.precision.toFixed(1)}% · Recall ${e.recall.toFixed(1)}% · F1 ${e.f1.toFixed(1)}%`);
  if(feature==="operations")result.rows=[data.architecture,data.documentPipeline.storage,data.documentPipeline.provider.activeProvider,data.limits];
  if(feature==="studio")result.rows=data.agents.map(a=>`${a.name}: ${a.tools.join(", ")}`);
  return result;
}
