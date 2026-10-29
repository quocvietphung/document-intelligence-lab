'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@/components/auth/KeycloakProvider';
import {classificationSchema,classificationCsv,type ClassificationData} from '@/lib/document-classification';
import {classificationText,classificationMethodNotes,documentClassName} from '@/lib/document-classification-language';
import {downloadBlob,downloadJson} from '@/lib/browser-download';
import {ModalSurface} from './ModalSurface';
import {PdfPreview} from './PdfPreview';

export function DocumentClassificationPanel({caseId,caseVersion,locale}:{caseId:string;caseVersion:number;locale:string}){
  const auth=useAuth(),t=classificationText(locale),root=`/api/cases/${encodeURIComponent(caseId)}/platform/classification`;
  const [data,setData]=useState<ClassificationData>(),[error,setError]=useState(false),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false);
  const [sample,setSample]=useState<string>(),[split,setSplit]=useState<'test'|'validation'|'challenge'>('test');
  const sequence=useRef(0),inFlight=useRef(false);
  const load=useCallback(async(signal?:AbortSignal)=>{const seq=++sequence.current;
    try{if(!auth.token)throw Error();const r=await fetch(root,{headers:{Authorization:`Bearer ${auth.token}`},cache:'no-store',signal});if(!r.ok)throw Error();const next=classificationSchema.parse(await r.json());
      if(next.caseId!==caseId||next.caseVersion!==caseVersion)throw Error();if(!signal?.aborted&&sequence.current===seq){setData(next);setError(false);}}
    catch{if(!signal?.aborted&&sequence.current===seq){setData(undefined);setError(true);}}
  },[root,auth.token,caseId,caseVersion]);
  useEffect(()=>{const c=new AbortController();const timer=setTimeout(()=>void load(c.signal),0);return()=>{clearTimeout(timer);c.abort();};},[load]);
  const pending=data?.runs.some(r=>r.status==='QUEUED');
  useEffect(()=>{if(!pending)return;const c=new AbortController();const timer=setInterval(()=>void load(c.signal),2500);return()=>{clearInterval(timer);c.abort();};},[pending,load]);
  async function run(){if(inFlight.current||!data)return;inFlight.current=true;setBusy(true);setError(false);
    try{const response=await fetch(root,{method:'POST',headers:{Authorization:`Bearer ${auth.token}`,'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),caseVersion,datasetFingerprint:data.datasetFingerprint,consent})});if(!response.ok)throw Error();await load();}catch{setError(true);}finally{inFlight.current=false;setBusy(false);}}
  async function exportInput(){setError(false);try{const response=await fetch(root+'/input',{headers:{Authorization:`Bearer ${auth.token}`},cache:'no-store'});if(!response.ok)throw Error();downloadJson(await response.json(),'classification-input.json');}catch{setError(true);}}
  async function downloadPdf(id:string){setError(false);try{const response=await fetch(`${root}/documents/${id}`,{headers:{Authorization:`Bearer ${auth.token}`},cache:'no-store'});if(!response.ok)throw Error();downloadBlob(await response.blob(),id+'.pdf');}catch{setError(true);}}
  const latest=data?.runs.find(run=>run.current&&run.status==='COMPLETE'&&run.result),report=latest?.result;
  const metric=report?.metrics[split==='challenge'?'test':split],percent=(value:number|null)=>value===null?t.none:new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:1}).format(value);
  const canRun=auth.roles.some(r=>r==='ADVISOR'||r==='ADMIN');
  return <section className="surface lab-section classification-panel" aria-label={t.title}>
    <div className="lab-section-heading"><div><h2>{t.title}</h2><p className="lab-caption">{t.intro}</p></div><button className="button-secondary" disabled={busy} onClick={()=>void load()}>{t.refresh}</button></div>
    <p className="lab-caption">{t.scope}</p>{error?<p className="notice-error" role="alert">{t.error}</p>:null}
    <details className="research-reference-details" key={latest?.id??'new'} open={!report?true:undefined}><summary>{t.setup}</summary>
    <details className="research-reference-details"><summary>{t.pdfs}</summary><div className="classification-pdf-list">{data?.dataset.samples.map(row=><button className="button-link" key={row.id} onClick={()=>setSample(row.id)}>{row.id} · {documentClassName(row.label,locale)} · {t[row.split]}</button>)}</div></details>
    <label className="research-consent"><input type="checkbox" checked={consent} disabled={busy||pending} onChange={e=>setConsent(e.target.checked)}/>{t.consent}</label>
    <div className="research-actions"><button className="button-primary" disabled={!canRun||!data?.workerReady||!consent||busy||pending} onClick={()=>void run()}>{pending?t.busy:t.run}</button><button className="button-secondary" disabled={!data} onClick={()=>void exportInput()}>{t.input}</button></div>
    {data&&!data.workerReady?<p className="lab-caption">{t.off}</p>:null}
    </details>
    {data?.runs[0]?.status==='FAILED'?<p className="notice-error" role="alert">{t.failed}</p>:null}
    {!report?<p className="lab-caption">{t.empty}</p>:<>
      <div className="classification-result-heading"><h3>{t.result}</h3><span>{report.library} · {report.elapsedMs} ms · {t.tracking}: {report.tracking}</span></div>
      <div className="research-tabs" role="group" aria-label={t.result}>{(['test','validation','challenge'] as const).map(value=><button key={value} aria-pressed={split===value} className={split===value?'selected':''} onClick={()=>setSplit(value)}>{t[value]}<span>{report.splits[value]}</span></button>)}</div>
      {split==='challenge'?<p className="notice-lab">{t.challengeHint} {report.challenge.reviewRouted} / {report.challenge.reviewExpected} · {report.challenge.missedReview.join(', ')||'—'}</p>:metric?<>
        <div className="classification-table"><table><caption>{t[split]} · {metric.model.samples} {t.support}</caption><thead><tr><th scope="col"/ ><th scope="col">{t.rule}</th><th scope="col">{t.model}</th></tr></thead><tbody><tr><th scope="row">{t.accuracy}</th><td>{percent(metric.rule.accuracy)}</td><td>{percent(metric.model.accuracy)}</td></tr><tr><th scope="row">{t.macro}</th><td>{percent(metric.rule.macroF1)}</td><td>{percent(metric.model.macroF1)}</td></tr></tbody></table></div>
        <div className="document-analytics-metrics">{[[t.review,metric.routing.reviewRequired],[t.coverage,percent(metric.routing.coverage)],[t.acceptedAccuracy,percent(metric.routing.acceptedAccuracy)]] .map(([label,value])=><article key={label}><h3>{label}</h3><strong>{value}</strong></article>)}</div>
        <p className="lab-caption">{t.gate}</p>
        <div className="classification-table"><table><caption>{t.precision} / {t.recall} / {t.f1}</caption><thead><tr><th scope="col"/ ><th scope="col">{t.support}</th><th scope="col">{t.rule} F1</th><th scope="col">{t.model} P</th><th scope="col">{t.model} R</th><th scope="col">{t.model} F1</th></tr></thead><tbody>{metric.model.perClass.map((row,index)=><tr key={row.label}><th scope="row">{documentClassName(row.label,locale)}</th><td>{row.support}</td><td>{percent(metric.rule.perClass[index].f1)}</td><td>{percent(row.precision)}</td><td>{percent(row.recall)}</td><td>{percent(row.f1)}</td></tr>)}</tbody></table></div>
        <details className="research-reference-details"><summary>{t.matrix}</summary><p>{t.matrixHint}</p><div className="classification-matrices">{(['rule','model'] as const).map(method=><div className="classification-table" key={method}><table><caption>{t[method]}</caption><thead><tr><th scope="col"/>{report.labels.map(label=><th scope="col" key={label}>{documentClassName(label,locale)}</th>)}</tr></thead><tbody>{metric[method].confusionMatrix.map((row,index)=><tr key={index}><th scope="row">{documentClassName(report.labels[index],locale)}</th>{row.map((value,column)=><td key={column}>{value}</td>)}</tr>)}</tbody></table></div>)}</div></details>
      </>:null}
      <details className="research-reference-details"><summary>{t.predictions}</summary><div className="classification-predictions">{report.rows.filter(row=>row.split===split).map(row=><article key={row.id}><h4>{row.id} · {documentClassName(row.label,locale)}</h4><p>{t.rule}: {documentClassName(row.ruleLabel,locale)} · {t.model}: {documentClassName(row.modelLabel,locale)}</p><p>{t.score}: {row.score.toFixed(3)} · {t.margin}: {row.margin.toFixed(3)}</p><span className="lab-badge">{row.needsReview?t.review:t.accepted}</span>{row.reviewReasons.length?<p>{row.reviewReasons.map(reason=>t[reason]).join(' · ')}</p>:null}<button className="button-secondary" onClick={()=>setSample(row.id)}>{t.open} · {row.id} · 1</button></article>)}</div></details>
      <details className="research-reference-details"><summary>{t.limits}</summary><ul>{classificationMethodNotes(locale,report.limitations).map(text=><li key={text}>{text}</li>)}</ul><code>{report.method} · {report.datasetFingerprint}</code></details>
      <div className="research-actions"><button className="button-secondary" onClick={()=>downloadJson(report,'classification-report.json')}>{t.json}</button><button className="button-secondary" onClick={()=>downloadBlob(new Blob([classificationCsv(report)],{type:'text/csv;charset=utf-8'}),'classification-predictions.csv')}>{t.csv}</button></div>
    </>}
    {sample?<ModalSurface wide title={`${t.open} · ${sample}`} label={t.close} close={()=>setSample(undefined)}><p className="lab-caption">{t.scope}</p><PdfPreview url={`${root}/documents/${sample}`} token={auth.token} locale={locale}/><button className="button-secondary" onClick={()=>void downloadPdf(sample)}>{t.download}</button></ModalSurface>:null}
  </section>;
}
