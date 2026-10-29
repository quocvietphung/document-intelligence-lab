'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent,type MouseEvent} from 'react';
import {useAuth} from '@/components/auth/KeycloakProvider';
import {analyticsSchema,analyticsText,findingText,type DocumentAnalytics,type AnalyticsFinding} from '@/lib/document-analytics';
import {ModalSurface} from './ModalSurface';

export function DocumentAnalyticsPanel({caseId,caseVersion,locale,inspect,compact=false,navigate}:{caseId:string;caseVersion?:number;locale:string;inspect?:(id:string,page?:number)=>void;compact?:boolean;navigate?:(page:'pipeline'|'documents')=>void}){
  const auth=useAuth(),t=analyticsText(locale),root=`/api/cases/${encodeURIComponent(caseId)}/platform/analytics`;
  const [data,setData]=useState<DocumentAnalytics>(),[error,setError]=useState(false),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false);
  const [review,setReview]=useState<{runId:string;finding:AnalyticsFinding}>(),[note,setNote]=useState(''),[state,setState]=useState<'CONFIRMED'|'DISMISSED'>('CONFIRMED');
  const sequence=useRef(0),inFlight=useRef(false);
  const load=useCallback(async(signal?:AbortSignal)=>{const seq=++sequence.current;
    try{if(!auth.token)throw Error();const r=await fetch(root,{headers:{Authorization:`Bearer ${auth.token}`},cache:'no-store',signal});if(!r.ok)throw Error();const next=analyticsSchema.parse(await r.json());
      if(next.caseId!==caseId||(caseVersion!==undefined&&next.caseVersion!==caseVersion))throw Error();if(!signal?.aborted&&seq===sequence.current){setData(next);setError(false);}
    }catch{if(!signal?.aborted&&seq===sequence.current)setError(true);}
  },[root,auth.token,caseId,caseVersion]);
  useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>void load(controller.signal),0);return()=>{clearTimeout(timer);controller.abort();};},[load]);
  const pending=data?.experiments.some(r=>r.status==='QUEUED');
  useEffect(()=>{if(!pending||compact)return;const controller=new AbortController();const timer=setInterval(()=>void load(controller.signal),2500);return()=>{clearInterval(timer);controller.abort();};},[pending,compact,load]);
  async function action(path:string,body:unknown){if(inFlight.current)return;inFlight.current=true;setBusy(true);setError(false);
    try{const r=await fetch(root+path,{method:'POST',headers:{Authorization:`Bearer ${auth.token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error();setReview(undefined);setNote('');await load();}
    catch{setError(true);}finally{inFlight.current=false;setBusy(false);}}
  const result=data?.report?.result.analytics,canWrite=auth.roles.some(r=>r==='ADVISOR'||r==='ADMIN'),canReview=auth.roles.some(r=>r==='REVIEWER'||r==='ADMIN');
  const names=new Map(data?.report?.result.documents.map(d=>[d.id,d.name])??[]);
  function openPage(event:MouseEvent<HTMLAnchorElement>,page:'pipeline'|'documents'){
    if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();const url=new URL(window.location.href);if(page==='pipeline')url.searchParams.set('pipeline','assets');else url.searchParams.delete('pipeline');window.history.replaceState(null,'',url);if(navigate)navigate(page);else window.location.hash=page;
  }
  function findings(runId:string,items:AnalyticsFinding[],current=true){return items.length?<div className="lab-alerts" role="list">{items.slice(0,40).map(f=>{const reviewed=data?.reviews.find(r=>r.run_id===runId&&r.finding_id===f.id);return <article role="listitem" key={f.id}><div><strong>{findingText(f.code,locale)}</strong><p>{names.get(f.documentId)??f.documentId} · {t.page} {f.page}</p><small>{f.field} · {f.category==='statistical'?t.experiment:t.details}</small>
      {inspect?<button className="button-link" onClick={()=>inspect(f.documentId,f.page)}>{t.open}</button>:null}
      {reviewed?<p>{reviewed.state==='CONFIRMED'?t.confirmed:t.dismissed} · {reviewed.note}</p>:null}
      {canReview&&current?<button className="button-secondary" disabled={busy} onClick={()=>{setReview({runId,finding:f});setNote('');}}>{t.review}</button>:null}</div></article>;})}</div>:<p className="lab-caption">{t.noFindings}</p>;}
  function save(event:FormEvent){event.preventDefault();if(!review||!data||!note.trim())return;void action('/reviews',{requestId:crypto.randomUUID(),caseVersion:data.caseVersion,runId:review.runId,findingId:review.finding.id,state,note:note.trim()});}
  return <section className="surface lab-section document-analytics-panel" aria-label={t.title}>
    <div className="lab-section-heading"><div><h2>{t.title}</h2><p className="lab-caption">{t.hint}</p></div>{!compact?<button className="button-secondary" disabled={busy} onClick={()=>void load()}>{t.refresh}</button>:null}</div>
    {error?<p role="alert" className="notice-error">{t.error}</p>:null}
    {!result?<p className="lab-caption">{t.empty}</p>:<div className="document-analytics-metrics">{([[t.documents,result.documents],[t.fields,result.fields],[t.lines,result.invoiceLines],[t.findings,result.findings.length]] as const).map(([label,value])=><article key={label}><h3>{label}</h3><strong>{value}</strong></article>)}</div>}
    {compact?<a className="button-link" href={`?case=${encodeURIComponent(caseId)}&pipeline=assets#pipeline`} onClick={event=>openPage(event,'pipeline')}>{t.openAnalytics}</a>:<>
      <details className="research-reference-details"><summary>{t.pdf}</summary><p>{t.pdfHint}</p><a className="button-link" href={`?case=${encodeURIComponent(caseId)}#documents`} onClick={event=>openPage(event,'documents')}>{t.open}</a></details>
      {result&&data?.report?<details className="research-reference-details" open={result.findings.length>0}><summary>{t.details} · {result.findings.length}</summary>{findings(data.report.id,result.findings)}<p>{t.reviewed}: {result.reviewedDocuments}</p></details>:null}
      <details className="research-reference-details"><summary>{t.experiment}</summary><p>{t.experimentHint}</p><p>{data?.workerReady?'scikit-learn · Isolation Forest · CPU':t.off}</p>
        <label className="research-consent"><input type="checkbox" checked={consent} disabled={busy||pending} onChange={e=>setConsent(e.target.checked)}/>{t.consent}</label>
        <button className="button-primary" disabled={!canWrite||!data?.workerReady||!data.report||!consent||pending||busy} onClick={()=>void action('',{requestId:crypto.randomUUID(),caseVersion:data!.caseVersion,etlRunId:data!.report!.id,consent:true})}>{pending?t.busy:t.run}</button>
        <p className="lab-caption">{t.metrics}</p>{!data?.experiments.length?<p>{t.notRun}</p>:null}
        {data?.experiments.map(run=><details className="research-reference-details" key={run.id}><summary>{!run.current?t.stale:run.status==='QUEUED'?t.busy:run.status==='FAILED'?t.failed:run.result?.status==='INSUFFICIENT_BASELINE'?t.insufficient:t.complete}</summary>
          {run.result?<><p>{run.result.library} · {run.result.elapsedMs} ms · {t.tracking}: {run.result.tracking}</p>{run.result.trackingRunId?<code>{run.result.trackingRunId}</code>:null}
            {run.result.cohorts.length?run.result.cohorts.map(c=><article key={`${c.documentType}:${c.field}:${c.currency}`}><h4>{c.documentType} · {c.field} · {c.currency}</h4><p>{c.status==='INSUFFICIENT_BASELINE'?`${t.insufficient}: ${c.eligibleDocuments} / ${c.minimumDocuments}`:`${t.training}: ${c.trainingDocuments} · ${t.holdout}: ${c.testDocuments} · ${t.flagged}: ${c.flagged} · ${t.baseline}: ${c.baselineFlagged}`}</p></article>):<p>{t.insufficient}</p>}
            {run.result.findings.length?findings(run.id,run.result.findings,run.current):null}</>:run.errorCode?<code>{run.errorCode}</code>:null}
        </details>)}
      </details><p className="lab-caption">{t.exportHint}</p>{data?.report?<details className="lab-technical"><summary>Parquet · PySpark</summary><code>{data.report.scope}/{data.report.id}</code></details>:null}
      {review?<ModalSurface title={t.review} close={()=>{if(!busy)setReview(undefined);}} label={t.cancel}><form className="lab-review-form" onSubmit={save}><h3>{findingText(review.finding.code,locale)}</h3><label>{t.review}<select value={state} onChange={e=>setState(e.target.value as typeof state)}><option value="CONFIRMED">{t.confirm}</option><option value="DISMISSED">{t.dismiss}</option></select></label><label>{t.note}<textarea value={note} onChange={e=>setNote(e.target.value)} required maxLength={1000} rows={3}/></label><p>{t.reviewLimit}</p><div><button type="button" className="button-secondary" disabled={busy} onClick={()=>setReview(undefined)}>{t.cancel}</button><button className="button-primary" disabled={busy||!note.trim()}>{t.save}</button></div></form></ModalSurface>:null}
    </>}
  </section>;
}
