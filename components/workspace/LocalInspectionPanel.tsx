"use client";
/* eslint-disable @next/next/no-img-element -- Private bounded data-URI crops must never use an image proxy. */
import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@/components/auth/KeycloakProvider';
import {localInspectionSchema,localInspectionText,type InspectionCandidate} from '@/lib/local-inspection';
import {downloadBlob} from '@/lib/browser-download';
import type {EvidenceSelection} from '@/lib/evidence-inspection';
import {z} from 'zod';

export function LocalInspectionPanel({caseId,documentId,caseVersion,page,selection,locale,onSelect}:{caseId:string;documentId:string;caseVersion:number;page:number;selection?:EvidenceSelection;locale:string;onSelect:(c:InspectionCandidate)=>void}){
  const auth=useAuth(),t=localInspectionText(locale),root=`/api/cases/${caseId}/platform/inspection`;
  const [data,setData]=useState<z.infer<typeof localInspectionSchema>>(),[value,setValue]=useState((selection?.value||'').slice(0,500)),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  const requestId=useRef<string|undefined>(undefined);
  const load=useCallback(async(signal?:AbortSignal)=>{if(!auth.token)return;try{const r=await fetch(root,{headers:{Authorization:`Bearer ${auth.token}`},cache:'no-store',signal});if(!r.ok)throw Error();const result=localInspectionSchema.parse(await r.json());if(!signal?.aborted){setData(result);setError(false);}}catch{if(!signal?.aborted)setError(true);}},[root,auth.token]);
  useEffect(()=>{const controller=new AbortController(),timer=setTimeout(()=>void load(controller.signal),0);return()=>{clearTimeout(timer);controller.abort();};},[load]);
  const pending=data?.runs.some(r=>r.status==='QUEUED');
  useEffect(()=>{if(!pending)return;const controller=new AbortController(),timer=setInterval(()=>void load(controller.signal),3000);return()=>{clearInterval(timer);controller.abort();};},[load,pending]);
  const runs=data?.runs.filter(r=>r.documentId===documentId&&r.page===page&&r.value===value).slice(0,3)||[];
  async function run(){if(busy||!consent||!value.trim()||!auth.token)return;setBusy(true);setError(false);requestId.current??=crypto.randomUUID();
    const sourceId=selection?.region&&selection.region.text===value?selection.region.id:undefined;
    try{const r=await fetch(root,{method:'POST',headers:{Authorization:`Bearer ${auth.token}`,'Content-Type':'application/json'},body:JSON.stringify({requestId:requestId.current,caseVersion,documentId,page,value,sourceId,consent:true})});if(!r.ok)throw Error();requestId.current=undefined;await load();}catch{setError(true);}finally{setBusy(false);}}
  async function report(id:string){try{const r=await fetch(`${root}/${id}/report`,{headers:{Authorization:`Bearer ${auth.token}`},cache:'no-store'});if(!r.ok)throw Error();downloadBlob(await r.blob(),'private-evidence-report.json');}catch{setError(true);}}
  return <details className="document-text-evidence local-inspection"><summary>{t.title}</summary><p>{t.hint}</p>
    <label>{t.value}<input value={value} maxLength={500} onChange={e=>{setValue(e.target.value);requestId.current=undefined;setConsent(false);}}/></label>
    <label className="lab-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{t.consent}</label>
    <button type="button" className="button-secondary" disabled={busy||pending||!consent||!value.trim()||!data?.workerReady} onClick={()=>void run()}>{t.run}</button>
    {data&&!data.workerReady?<p>{t.ready}</p>:null}{pending?<p role="status">{t.pending}</p>:null}{error?<p className="notice-error" role="alert">{t.failed}</p>:null}
    {runs.map((run,index)=><details className="source-page" key={run.id} open={index===0}><summary>{index===0?t.latest:t.previous} · {t[run.status]}</summary>{!run.current?<p>{t.stale}</p>:null}{run.errorCode?<code>{run.errorCode}</code>:null}
      {run.result?<><p>{t.manual}</p>{!run.result.candidates.length?<p>{t.none}</p>:<div className="trust-action-row" aria-label={t.choose}>{run.result.candidates.map((c,i)=><button type="button" className="button-secondary" disabled={!run.current} key={c.id} onClick={()=>onSelect(c)}>{t.candidate} {i+1} · {c.method} · {c.deskew_degrees}°</button>)}</div>}
        <h4>{t.comparison}</h4><p>{t[run.result.comparison.status]}</p>{run.result.comparison.numericDisagreement?<p className="notice-error">{t.numeric}</p>:null}
        {run.result.comparison.cropPng?<figure><img className="inspection-source-crop" src={`data:image/png;base64,${run.result.comparison.cropPng}`} alt={t.crop}/><figcaption>{t.crop}</figcaption></figure>:null}
        <div className="evidence-comparison-grid"><section><h4>{t.recorded}</h4><pre>{run.result.comparison.recordedText||'—'}</pre></section><section><h4>{t.observed}</h4><pre>{run.result.comparison.independentOcrText||'—'}</pre></section></div>
        <details><summary>{t.privacy}</summary><pre>{JSON.stringify(run.result.engine_versions,null,2)}</pre></details><button type="button" className="button-secondary" disabled={!run.current} onClick={()=>void report(run.id)}>{t.report}</button>
      </>:null}</details>)}
  </details>;
}
