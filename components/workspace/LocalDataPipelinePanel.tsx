"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@/components/auth/KeycloakProvider';
import {localEtlSchema,etlText,etlIssueMessage,type LocalEtl} from '@/lib/local-etl';
import {downloadBlob} from '@/lib/browser-download';

export function LocalDataPipelinePanel({caseId,caseVersion,locale,inspect}:{caseId:string;caseVersion:number;locale:string;inspect?:(id:string,page?:number)=>void}){
  const auth=useAuth(),t=etlText(locale),root=`/api/cases/${encodeURIComponent(caseId)}/platform/etl`;
  const [data,setData]=useState<LocalEtl>(),[error,setError]=useState(false),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false);
  const sequence=useRef(0),inFlight=useRef(false);
  const writable=auth.authenticated&&auth.roles.some(r=>r==='ADVISOR'||r==='ADMIN');
  const load=useCallback(async(signal?:AbortSignal)=>{
    const seq=++sequence.current;
    try{if(!auth.token)throw Error();const response=await fetch(root,{headers:{Authorization:`Bearer ${auth.token}`},cache:'no-store',signal});if(!response.ok)throw Error();
      const value=localEtlSchema.parse(await response.json());if(value.caseId!==caseId||value.caseVersion!==caseVersion)throw Error();
      if(!signal?.aborted&&seq===sequence.current){setData(value);setError(false);}
    }catch{if(!signal?.aborted&&seq===sequence.current)setError(true);}
  },[root,auth.token,caseId,caseVersion]);
  useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>void load(controller.signal),0);return()=>{clearTimeout(timer);controller.abort();};},[load]);
  const pending=data?.runs.some(r=>r.status==='QUEUED'||r.status==='RUNNING');
  useEffect(()=>{if(!pending)return;const controller=new AbortController();const timer=setInterval(()=>void load(controller.signal),2500);return()=>{clearInterval(timer);controller.abort();};},[pending,load]);
  async function action(task:()=>Promise<void>){if(inFlight.current)return;inFlight.current=true;setBusy(true);setError(false);try{await task();}catch{setError(true);}finally{inFlight.current=false;setBusy(false);}}
  const latest=data?.runs.find(r=>r.current&&r.status==='COMPLETE');
  return <section className="surface lab-section" aria-label={t.title}>
    <div className="lab-section-heading"><div><h2>{t.title}</h2><p className="lab-caption">{t.hint}</p></div><button className="button-secondary" disabled={busy} onClick={()=>void load()}>{t.refresh}</button></div>
    <p role="status" className="lab-caption">{data?.workerReady?t.ready:t.off}</p>
    {error?<p role="alert" className="notice-error">{t.error}</p>:null}
    <details className="research-reference-details"><summary>{t.example}</summary><p>{t.exampleHint}</p><a className="button-link" href={`?case=${encodeURIComponent(caseId)}#documents`}>{locale==='vi'?'Mở tài liệu':locale==='de'?'Dokumente öffnen':'Open documents'}</a></details>
    <label className="research-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={busy||pending}/>{t.consent}</label>
    <button className="button-primary" disabled={!writable||!consent||!data?.workerReady||busy||pending} onClick={()=>void action(async()=>{const response=await fetch(root,{method:'POST',headers:{Authorization:`Bearer ${auth.token}`,'Content-Type':'application/json'},body:JSON.stringify({caseVersion,requestId:crypto.randomUUID(),consent:true})});if(!response.ok)throw Error();await load();})}>{busy||pending?t.busy:t.run}</button>
    <p className="lab-caption">{t.unreviewed} {t.dateHint}</p>
    <div className="research-lineage">{(['bronze','silver','gold'] as const).map(layer=><article key={layer}><h3>{t[layer]}</h3><strong>{latest?.result?.[layer]??'—'}</strong></article>)}</div>
    {latest?.result?<p className="lab-caption">{t.history}: {latest.result.historyVersions} · {latest.result.dbtVerified?t.checks:t.unknown}</p>:null}
    <h3>{t.runs}</h3>{!data?.runs.length?<p className="lab-caption">{t.empty}</p>:null}
    {data?.runs.map(run=><details className="research-reference-details" key={run.id}><summary>{t[run.status]} · {new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(run.time))}{!run.current?` · ${t.stale}`:''}</summary>
      <code>{run.id}</code>{run.errorCode?<p>{run.errorCode}</p>:null}
      {run.result?<><p>{t.issues}: {run.result.qualityIssues.length}</p><ul>{run.result.qualityIssues.slice(0,20).map((issue,i)=><li key={i}><strong>{etlIssueMessage(issue.code,locale)}</strong><br/>{inspect?<button className="button-link" onClick={()=>inspect(issue.documentId,issue.page)}>{run.result?.documents.find(d=>d.id===issue.documentId)?.name} · {locale==='vi'?'Trang':locale==='de'?'Seite':'Page'} {issue.page}</button>:run.result?.documents.find(d=>d.id===issue.documentId)?.name}<br/><small><code>{issue.field}: {issue.code}</code></small></li>)}</ul>
        <ul>{run.result.totals.map(total=><li key={`${total.field}:${total.currency}`}>{total.field}: {total.total} {total.currency} · {total.observations}</li>)}</ul>
        <div className="research-actions">{(['bronze','silver','gold'] as const).map(layer=><button key={layer} className="button-secondary" disabled={busy||!consent} onClick={()=>void action(async()=>{const response=await fetch(`${root}/${run.id}/${layer}`,{headers:{Authorization:`Bearer ${auth.token}`},cache:'no-store'});if(!response.ok)throw Error();downloadBlob(await response.blob(),`${run.id}-${layer}.parquet`);})}>{t.download} · {layer}</button>)}</div></>:null}
    </details>)}
  </section>;
}
