"use client";

import {useState} from 'react';
import {ArrowUpRight,CheckCircle2,Clock3,Download,FileSearch,History,RefreshCw,Search,ShieldCheck,Sparkles,XCircle} from 'lucide-react';
import {canRetryDocumentJob,documentJobErrorKey,pipelineStage,type PlatformData} from '@/lib/platform';
import {platformText} from '@/lib/platform-language';
import {filterPipelineJobs,pipelineCopy,pipelineManifest,pipelineStages,pipelineSteps,pipelineSummary,type PipelineFilter,type PipelineJob} from '@/lib/document-pipeline';
import {ModalSurface} from './ModalSurface';
import {downloadJson} from '@/lib/browser-download';

export function DocumentPipeline({data,locale,busy,canWrite,inspect,retry,cancel}:{data:PlatformData;locale:string;busy:boolean;canWrite:boolean;inspect:(id:string)=>void;retry:(job:PipelineJob)=>void;cancel:(job:PipelineJob)=>Promise<void>}){
  const t=pipelineCopy(locale),status=platformText(locale);
  const [query,setQuery]=useState(''),[filter,setFilter]=useState<PipelineFilter>('all'),[history,setHistory]=useState(false),[selected,setSelected]=useState<string>(),[cancelId,setCancelId]=useState<string>();
  const summary=pipelineSummary(data.jobs),jobs=filterPipelineJobs(data.jobs,filter,query,history);
  const detail=data.jobs.find(job=>job.id===selected),cancelling=data.jobs.find(job=>job.id===cancelId);
  const date=(value?:string|null)=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'medium'}).format(new Date(value)):'—';
  const canRetry=(job:PipelineJob)=>canRetryDocumentJob(job)&&!data.jobs.some(other=>other.id!==job.id&&other.sha256===job.sha256&&!['FAILED','EXPIRED','CANCELLED'].includes(other.status));
  const state=(job:PipelineJob)=>job.status==='CANCELLED'?t.cancelled:job.status==='COMPLETE'?job.reviewStatus==='verified'?t.verified:t.review:status(job.status);
  function download(job:PipelineJob){
    downloadJson(pipelineManifest(data.caseId,job), `processing-${job.id}.json`);
  }
  return <section className="pipeline-control" data-page-tour="pipeline-jobs" aria-labelledby="pipeline-control-title">
    <div className="pipeline-control-heading"><div><span className="eyebrow">{data.caseId}</span><h2 id="pipeline-control-title">{t.title}</h2><p>{t.hint}</p></div><span className={`lab-badge lab-badge-${data.documentPipeline.worker?'good':'warn'}`}><Clock3 size={14}/>{t[data.documentPipeline.worker?'running':'paused']}</span></div>
    <ol className="pipeline-overview-steps" aria-label={t.timeline}>{pipelineStages.map((stage,index)=><li key={stage}><span>{String(index+1).padStart(2,'0')}</span><strong>{t[stage]}</strong>{stage==='EXTRACT'?<small><Sparkles size={12}/>AI</small>:null}</li>)}</ol>
    <div className="pipeline-summary">{(['active','review','failed','verified'] as const).map(key=><button key={key} className={filter===key?'selected':''} aria-pressed={filter===key} onClick={()=>setFilter(filter===key?'all':key)}><span>{t[key]}</span><strong>{summary[key]}</strong></button>)}</div>
    <p className="lab-caption">{t.scope}</p>
    <div className="pipeline-filters"><label><span>{t.search}</span><div><Search size={17}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.search}/></div></label><label><span>{t.all}</span><select aria-label={t.all} value={filter} onChange={e=>setFilter(e.target.value as PipelineFilter)}>{(['all','active','review','verified','failed','cancelled','expired'] as const).map(key=><option key={key} value={key}>{t[key]}</option>)}</select></label></div>
    <div className="pipeline-list-caption"><label><input type="checkbox" checked={history} onChange={e=>setHistory(e.target.checked)}/><History size={15}/>{t.history}</label><span role="status">{jobs.length} / {history?data.jobs.length:summary.latest.length} {t.shown}</span></div>
    <div className="pipeline-job-list">{jobs.map(job=><article className={`pipeline-job pipeline-job-${job.status.toLowerCase()}`} key={job.id}>
      <div className="pipeline-job-heading"><span className="pipeline-file-icon"><FileSearch size={23}/></span><div><h3>{job.name}</h3><small>{date(job.createdAt)} · {t.attempt} {job.attempt}</small></div><span className={`lab-badge lab-badge-${job.status==='FAILED'?'warn':job.status==='COMPLETE'?'good':'neutral'}`}>{state(job)}</span></div>
      <div className="pipeline-job-meta"><span>{t[pipelineStage(job) as keyof typeof t]||status(pipelineStage(job))}</span>{job.scan_result?<span><ShieldCheck size={13}/>{status(job.scan_result)}</span>:null}{job.extraction?<span>{t.pages}: {job.extraction.pages} · {t.tables}: {job.extraction.tables}</span>:null}</div>
      {job.error_code?<p className="notice-error">{status(documentJobErrorKey(job.error_code))}</p>:null}
      {job.nextAttemptAt&&job.status==='RETRY'?<p className="lab-caption">{t.next}: {date(job.nextAttemptAt)}</p>:null}
      <div className="pipeline-job-actions"><button className="button-secondary" onClick={()=>setSelected(job.id)}><History size={15}/>{t.details}</button>{job.document_id&&job.extraction?.originalAvailable!==false?<button className="button-primary" onClick={()=>inspect(job.document_id!)}>{t.result}<ArrowUpRight size={14}/></button>:null}{canWrite&&canRetry(job)?<button className="button-secondary" disabled={busy} onClick={()=>retry(job)}><RefreshCw size={15}/>{t.retry}</button>:null}{canWrite&&job.canCancel?<button className="button-link" disabled={busy} onClick={()=>setCancelId(job.id)}><XCircle size={15}/>{t.cancel}</button>:null}</div>
    </article>)}</div>
    {!jobs.length?<div className="lab-empty"><FileSearch size={28}/><p>{t.empty}</p></div>:null}
    <p className="pipeline-safety"><ShieldCheck size={15}/>{t.private} · {t[data.persistent?'persistent':'volatile']}</p>
    {detail?<ModalSurface wide title={detail.name} label={t.close} close={()=>setSelected(undefined)}>
      <div className="pipeline-detail-heading"><span className="lab-badge">{state(detail)}</span><code>{detail.id}</code></div>
      <ol className="pipeline-detail-steps">{pipelineSteps(detail).map(step=><li key={step.stage} className={`pipeline-step-${step.state}`}><CheckCircle2 size={17}/><span>{t[step.stage]}</span></li>)}</ol>
      <div className="pipeline-detail-grid"><section><h3>{t.source}</h3><dl><dt>{t.hash}</dt><dd><code className="pipeline-hash">{detail.sha256}</code></dd><dt>{t.submitted}</dt><dd>{date(detail.createdAt)}</dd><dt>{t.finished}</dt><dd>{date(detail.finishedAt)}</dd><dt>{t.attempt}</dt><dd>{detail.attempt} / 3</dd>{detail.retryOf?<><dt>{t.retryOf}</dt><dd><code>{detail.retryOf}</code></dd></>:null}</dl></section>
        <section><h3>{t.extraction}</h3>{detail.extraction?<><dl>{(['pages','fields','tables'] as const).map(key=><div key={key}><dt>{t[key]}</dt><dd>{detail.extraction![key]}</dd></div>)}<dt>{t.provider}</dt><dd>{detail.extraction.provider} · {detail.extraction.modelId}</dd><dt>{t.characters}</dt><dd>{detail.extraction.textCharacters.toLocaleString(locale)}</dd></dl><p>{t.reviewHint}</p></>:<p>—</p>}<p>{t.ragHint}</p></section></div>
      <section className="pipeline-events"><h3>{t.timeline}</h3>{detail.events?.length?<ol>{detail.events.map(event=><li key={event.id}><time dateTime={event.time}>{date(event.time)}</time><div><strong>{t[event.stage as keyof typeof t]||status(event.stage)}</strong><span>{status(event.status)} · {t.attempt} {event.attempt}</span>{event.errorCode?<code>{event.errorCode}</code>:null}</div></li>)}</ol>:<p>{t.legacy}</p>}</section>
      <div className="pipeline-manifest"><div><strong>{t.manifest}</strong><p>{t.manifestHint}</p></div><button className="button-secondary" onClick={()=>download(detail)}><Download size={16}/>{t.manifest}</button></div>
    </ModalSurface>:null}
    {cancelling?<ModalSurface title={t.cancelTitle} label={t.close} close={()=>setCancelId(undefined)}><h3>{cancelling.name}</h3><p className="pipeline-cancel-hint">{t.cancelHint}</p><div className="pipeline-job-actions"><button className="button-secondary" onClick={()=>setCancelId(undefined)}>{t.back}</button><button className="button-primary" disabled={busy} onClick={()=>{setCancelId(undefined);void cancel(cancelling);}}>{t.confirmCancel}</button></div></ModalSurface>:null}
  </section>;
}
