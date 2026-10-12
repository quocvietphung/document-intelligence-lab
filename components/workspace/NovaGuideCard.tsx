"use client";
import {useEffect,useRef,useState} from "react";
import {ArrowUpRight,BookOpen,Search} from "lucide-react";
import {useAuth} from "@/components/auth/KeycloakProvider";
import type {WorkspaceCase} from "@/lib/credit-api";
import {featureHref,guideSchema,novaFeature,novaGuideLabels,type WorkspaceTab} from "@/lib/nova-guide";
import {novaReadTool,type NovaReadResult} from "@/lib/nova-read-tools";

export function NovaGuideCard({guide,locale,item,navigate,openSource}:{guide:unknown;locale:string;item:WorkspaceCase;navigate:(tab:WorkspaceTab)=>void;openSource:(id:string)=>void}){
  const parsed=guideSchema.safeParse(guide),auth=useAuth(),t=novaGuideLabels(locale);
  const [query,setQuery]=useState("");const [result,setResult]=useState<NovaReadResult>();const [busy,setBusy]=useState(false);const [error,setError]=useState(false);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  if(!parsed.success)return null;
  async function run(id:WorkspaceTab){
    if(controller.current)return;
    const abort=new AbortController();controller.current=abort;setBusy(true);setError(false);setResult(undefined);
    try{const data=await novaReadTool(id,item,locale,auth.mode==="demo",auth.token,query,abort.signal);if(!abort.signal.aborted)setResult(data);}catch{if(!abort.signal.aborted)setError(true);}finally{if(!abort.signal.aborted)setBusy(false);controller.current=null;}
  }
  return <div className="nova-guide">
    {parsed.data.features.map(id=>{const f=novaFeature(id,locale);return <details key={id} open={parsed.data.features.length===1}><summary><BookOpen size={14}/>{f.title}</summary><p>{f.description}</p><ol>{f.steps.map(step=><li key={step}>{step}</li>)}</ol><div className="nova-guide-actions"><a href={featureHref(locale,id)} onClick={e=>{e.preventDefault();navigate(id);}}>{t.open}<ArrowUpRight size={13}/></a><button disabled={busy} onClick={()=>void run(id)}>{t.read}</button></div>{id==="studio"?<form onSubmit={e=>{e.preventDefault();if(query.trim())void run("studio");}}><label>{t.query}<input value={query} onChange={e=>setQuery(e.target.value)} maxLength={2000}/></label><button disabled={busy||!query.trim()}><Search size={13}/>{t.search}</button></form>:null}</details>;})}
    {busy?<p role="status">{t.loading}</p>:null}{error?<p className="notice-error" role="alert">{t.error}</p>:null}
    {result?<div className="nova-tool-result"><strong>{result.demo?t.demo:t.live}</strong>{result.rows.map((row,i)=><p key={i}>{row}</p>)}{result.sources.map(source=><details key={source.id}><summary>{source.title}</summary><p>{source.text}</p><code>[{source.id}]</code>{item.documents.some(d=>source.id.startsWith(d.id+":"))?<button onClick={()=>openSource(source.id)}>{t.open}</button>:null}</details>)}{!result.rows.length&&!result.sources.length?<p>{t.empty}</p>:null}</div>:null}
  </div>;
}
