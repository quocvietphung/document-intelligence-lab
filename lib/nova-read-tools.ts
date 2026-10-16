import type {WorkspaceCase} from "./credit-api";
import {toWorkspaceCase} from "./credit-api";
import {uploadedEvidence} from "./document-focus";
import {platformSchema,searchSchema} from "./platform";
import {documentFocusText} from "./document-focus";
import type {WorkspaceTab} from "./nova-guide";
import {documentResearchSchema} from './document-research';
export type NovaReadResult={rows:string[];sources:{id:string;title:string;text:string}[];demo:boolean};
export async function novaReadTool(feature:WorkspaceTab,item:WorkspaceCase,locale:string,demo:boolean,token?:string,query?:string,signal?:AbortSignal):Promise<NovaReadResult>{
  if(demo||!token)throw new Error("Authentication required; original document evidence requires authentication");
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(item.id))throw new Error("Invalid case");
  const root=`/api/cases/${item.id}`;
  async function read(path:string,question?:string){
    if(!token)throw new Error("Authentication required");
    const response=await fetch(root+path,{method:question?"POST":"GET",headers:{Authorization:`Bearer ${token}`,...(question?{"Content-Type":"application/json"}:{})},body:question?JSON.stringify({question}):undefined,cache:"no-store",signal});
    if(!response.ok)throw new Error("Read unavailable");return response.json();
  }
  const result:NovaReadResult={rows:[],sources:[],demo};
  if(feature==='experiments') {
    const data=documentResearchSchema.parse(await read('/platform/research'));
    if(data.caseId!==item.id)throw new Error('Case mismatch');
    result.rows=[`${data.documents.length} PDF · ${data.datasets.length} reference versions · ${data.runs.length} experiments`,...data.runs.slice(0,5).map(r=>`${r.datasetName} · ${r.suite} · ${r.durationMs} ms · 0 Azure calls`)];return result;
  }
  if(feature==="documents"||feature==="banking"||feature==="evaluation") {
    const current=toWorkspaceCase(await read(""));
    if(current.id!==item.id||current.tenantId!==item.tenantId)throw new Error("Case mismatch");
    const documents=uploadedEvidence(current.documents);
    result.sources=documents.flatMap(d=>{
      const pages=[...new Set([...(d.pages||[]).map(p=>p.number),...(d.fields||[]).flatMap(f=>f.page?[f.page]:[])])];
      if(!pages.length)return [{id:d.id,title:d.name,text:`${d.status} · ${d.analysisProvider||"unknown"}`}];
      return pages.map(page=>({id:`${d.id}:p${page}`,title:`${d.name} · ${page}`,text:(d.fields||[]).filter(f=>f.page===page).map(f=>`${f.label}: ${f.value} · ${f.evidence||""}`).join("; ")||(d.pages||[]).find(p=>p.number===page)?.text.slice(0,1200)||""}));
    });
    result.rows=documents.length?documents.map(d=>`${d.name} · ${d.status}`):[documentFocusText(locale)[feature==="banking"?"emptyBank":"empty"]];
    return result;
  }
  if(feature==="overview") {result.rows=[`${item.id} · ${item.applicant}`,`${item.status} · ${item.progress}%`,...item.issues.map(i=>`${i.title}: ${i.detail}`)];return result;}
  if(feature==="audit") {result.rows=item.audit.map(row=>row.join(" · "));return result;}
  if(feature==="studio"&&query?.trim()){const bounded=query.trim().slice(0,2000);const data=searchSchema.parse(await read("/platform/search",bounded));result.sources=data.search.hits.map(h=>({id:h.id,title:h.title,text:h.text}));result.rows=[data.search.backend];return result;}
  const data=platformSchema.parse(await read("/platform"));
  if(data.caseId!==item.id)throw new Error("Case mismatch");
  if(feature==="pipeline")result.rows=[data.documentPipeline.provider.activeProvider,data.documentPipeline.provider.modelId,...data.jobs.slice(0,10).map(j=>`${j.name}: ${j.status} · ${j.stage}`)];
  if(feature==="controls")result.rows=[...data.banking.alerts.map(a=>`${a.code}: ${a.detail}`),...data.banking.reconciliation.map(r=>`${r.field}: ${r.value} · ${r.state}`)];
  if(feature==="operations")result.rows=[data.architecture,data.documentPipeline.storage,data.documentPipeline.provider.activeProvider,data.limits];
  if(feature==="studio")result.rows=data.agents.map(a=>`${a.name}: ${a.tools.join(", ")}`);
  return result;
}
