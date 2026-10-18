"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {Download,FileSearch,RefreshCw,Sparkles} from "lucide-react";
import type {z} from "zod";
import {useAuth} from "@/components/auth/KeycloakProvider";
import {creditCaseSchema} from "@/lib/credit-api";
import {documentFocusText,uploadedEvidence} from "@/lib/document-focus";
import {workspaceText} from "@/lib/workspace-language";
import {downloadJson} from "@/lib/browser-download";
type Doc=z.infer<typeof creditCaseSchema>["documents"][number];
export function DocumentCorpus({caseId,locale,banking=false,inspect,ask}:{caseId:string;locale:string;banking?:boolean;inspect:(id:string)=>void;ask:(question:string)=>void}){
 const auth=useAuth(),t=documentFocusText(locale),field=workspaceText(locale);
 const [docs,setDocs]=useState<Doc[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false);
 const loadSequence=useRef(0);
 const load=useCallback(async(signal?:AbortSignal)=>{
  const sequence=++loadSequence.current;
  setLoading(true);setError(false);
  try{
   const response=await fetch("/api/cases/"+caseId,{headers:{Authorization:"Bearer "+auth.token},cache:"no-store",signal});
   if(!response.ok)throw new Error();
   const value=creditCaseSchema.parse(await response.json());
   if(value.id!==caseId||value.tenantId!==auth.tenantId)throw new Error();
   if(!signal?.aborted&&sequence===loadSequence.current)setDocs(uploadedEvidence(value.documents));
  }catch{if(!signal?.aborted&&sequence===loadSequence.current){setDocs([]);setError(true);}}finally{if(!signal?.aborted&&sequence===loadSequence.current)setLoading(false);}
 },[caseId,auth.token,auth.tenantId]);
 useEffect(()=>{const c=new AbortController();const timer=setTimeout(()=>void load(c.signal),0);return()=>{clearTimeout(timer);c.abort();};},[load]);
 const visible=loading||error?[]:banking?docs.filter(d=>d.type==="statement"||d.type==="invoice"||(/rechnung|invoice/i.test(d.name)&&d.type!=="income")):docs;
 function download(){
  const value={caseId,scope:"uploaded-originals-only",accuracy:null,documents:visible.map(d=>({id:d.id,name:d.name,type:d.type,status:d.status,provider:d.analysisProvider,model:d.modelId,fields:d.fields,pages:d.pages,tables:d.tables}))};
  downloadJson(value, `document-evidence-${caseId}.json`);
 }
 return <section className="research-workbench" aria-label={banking?t.banking:t.title}>
  <header className="research-header"><div><span className="lab-badge"><FileSearch size={15}/>{t.all}</span><h2>{banking?t.banking:t.title}</h2><p>{t.hint}</p></div><button className="button-secondary" disabled={loading} onClick={()=>void load()}><RefreshCw size={16}/>{t.refresh}</button></header>
  {error?<p className="notice-error" role="alert">{t.error}</p>:loading?<p role="status">{t.loading}</p>:null}
  <div data-page-tour={banking?"banking-documents":"research-selection"} className="lab-metrics">{[[t.documents,visible.length],[t.fields,visible.reduce((n,d)=>n+d.fields.length,0)],[t.tables,visible.reduce((n,d)=>n+(d.tables?.length||0),0)],[t.reviewed,visible.filter(d=>d.status==="verified").length]].map(([label,count])=><div className="lab-metric" key={String(label)}><span>{label}</span><strong>{loading||error?"—":count}</strong></div>)}</div>
  <p className="research-scope">{t.limits}</p>
  <div data-page-tour={banking?"banking-originals":"research-run"} className="research-runbar"><a className="button-primary" href={"?case="+encodeURIComponent(caseId)+"#documents"}>{t.upload}</a><button className="button-secondary" disabled={!visible.length||loading||error} onClick={download}><Download size={16}/>{t.json}</button></div>
  <div data-page-tour={banking?"banking-results":"research-results"}>
   {!loading&&!error&&!visible.length?<p className="research-empty">{banking?t.emptyBank:t.empty}</p>:null}
   {visible.map(doc=><article key={doc.id} className="research-variant"><div className="lab-section-heading"><h3>{doc.name}</h3><span className="lab-badge">{doc.status==="verified"?t.confirmed:t.pending}</span></div><p className="lab-caption">{t.provider}: <strong>{doc.analysisProvider||t.unknown}</strong> · {doc.modelId||t.unknown}</p>
    <div className="lab-table-wrap"><table className="audit-table"><caption className="sr-only">{doc.name}</caption><thead><tr><th>{t.fields}</th><th>{t.extraction}</th><th>{t.source}</th></tr></thead><tbody>{doc.fields.map((f,i)=><tr key={i}><th scope="row">{field(f.label)}</th><td>{f.value}</td><td>{t.page} {f.page||"—"}<small className="block">{f.evidence||t.unknown}</small></td></tr>)}</tbody></table></div>
    {!doc.fields.length?<p>{t.noFields}</p>:null}
    <div className="flex flex-wrap gap-3 mt-4"><button className="button-secondary" onClick={()=>inspect(doc.id)}><FileSearch size={16}/>{t.view}</button><button className="button-secondary" onClick={()=>ask(t.question+doc.name+" ["+doc.id+"]")}><Sparkles size={16}/>{t.ask}</button></div>
   </article>)}
  </div>
 </section>;
}
