"use client";

import {useState} from 'react';
import {ArrowUpRight,CheckCircle2,Clock3,Download,FileSearch,History,RefreshCw,ShieldCheck,Sparkles,XCircle} from 'lucide-react';
import {canRetryDocumentJob,documentJobErrorKey,pipelineStage,type PlatformData} from '@/lib/platform';
import {platformText} from '@/lib/platform-language';
import {filterPipelineJobs,pipelineCopy,pipelineManifest,pipelineStages,pipelineSteps,pipelineSummary,sortPipelineJobs,type PipelineFilter,type PipelineJob,type PipelineSort} from '@/lib/document-pipeline';
import {ModalSurface} from './ModalSurface';
import {downloadJson} from '@/lib/browser-download';
import {workspacePresentation} from '@/lib/workspace-presentation';
import {CollectionToolbar} from './CollectionToolbar';

export function DocumentPipeline({data,locale,busy,canWrite,inspect,retry,cancel}:{data:PlatformData;locale:string;busy:boolean;canWrite:boolean;inspect:(id:string)=>void;retry:(job:PipelineJob)=>void;cancel:(job:PipelineJob)=>Promise<void>}){
  const t=pipelineCopy(locale),status=platformText(locale),u=workspacePresentation(locale);
  const [query,setQuery]=useState(''),[filter,setFilter]=useState<PipelineFilter>('all'),[sort,setSort]=useState<PipelineSort>('newest'),[history,setHistory]=useState(false),[selected,setSelected]=useState<string>(),[cancelId,setCancelId]=useState<string>();
  const summary=pipelineSummary(data.jobs),jobs=sortPipelineJobs(filterPipelineJobs(data.jobs,filter,query,history),sort);
  const reset=()=>{setQuery('');setFilter('all');setSort('newest');setHistory(false);};
  const detail=data.jobs.find(job=>job.id===selected),cancelling=data.jobs.find(job=>job.id===cancelId);
  const date=(value?:string|null)=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'medium'}).format(new Date(value)):'—';
  const canRetry=(job:PipelineJob)=>canRetryDocumentJob(job)&&!data.jobs.some(other=>other.id!==job.id&&other.sha256===job.sha256&&!['FAILED','EXPIRED','CANCELLED'].includes(other.status));
  const state=(job:PipelineJob)=>job.status==='CANCELLED'?t.cancelled:job.status==='COMPLETE'?job.reviewStatus==='verified'?t.verified:t.review:status(job.status);
  function download(job:PipelineJob){
    downloadJson(pipelineManifest(data.caseId,job), `processing-${job.id}.json`);
  }
  return <section className="pipeline-control pipeline-control-compact" data-page-tour="pipeline-jobs" aria-labelledby="pipeline-control-title">
    <div className="pipeline-control-heading"><div><h2 id="pipeline-control-title">{t.title}</h2><p>{t.hint}</p></div><span className={`lab-badge lab-badge-${data.documentPipeline.worker?'good':'warn'}`}><Clock3 size={14}/>{t[data.documentPipeline.worker?'running':'paused']}</span></div>
    <div className="pipeline-queue-tabs" role="group" aria-label={u.status}><button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>{t.all}<strong>{summary.latest.length}</strong></button>{(['active','review','failed','verified','cancelled','expired'] as const).map(key=><button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{t[key]}<strong>{key==='cancelled'||key==='expired'?filterPipelineJobs(data.jobs,key,'',false).length:summary[key]}</strong></button>)}</div>
    <CollectionToolbar locale={locale} label={t.title} query={query} searchLabel={t.search} onQuery={setQuery} sort={sort} sorts={[{value:'newest',label:u.newest},{value:'oldest',label:u.oldest},{value:'name',label:u.filename}]} onSort={value=>setSort(value as PipelineSort)} shown={jobs.length} total={history?data.jobs.length:summary.latest.length} active={!!query||filter!=='all'||sort!=='newest'||history} reset={reset}><label className="collection-history"><input type="checkbox" checked={history} onChange={event=>setHistory(event.target.checked)}/><History size={13}/>{t.history}</label></CollectionToolbar>
    <div className="pipeline-table-wrap"><table className="pipeline-queue-table"><caption className="sr-only">{t.title}</caption><thead><tr><th scope="col">{u.document}</th><th scope="col">{u.status}</th><th scope="col">{u.evidence}</th><th scope="col">{u.actions}</th></tr></thead><tbody>{jobs.map(job=><tr key={job.id} className={`pipeline-row-${job.status.toLowerCase()}`}>
      <th scope="row"><div className="queue-file"><FileSearch size={19} aria-hidden="true"/><div><strong>{job.name}</strong><small>{date(job.createdAt)} · {t.attempt} {job.attempt}</small></div></div></th>
      <td data-label={u.status}><span className={`lab-badge lab-badge-${job.status==='FAILED'?'warn':job.status==='COMPLETE'?'good':'neutral'}`}>{state(job)}</span><small className="queue-stage">{t[pipelineStage(job) as keyof typeof t]||status(pipelineStage(job))}</small>{job.error_code?<p className="notice-error">{status(documentJobErrorKey(job.error_code))}</p>:null}{job.nextAttemptAt&&job.status==='RETRY'?<p className="lab-caption">{t.next}: {date(job.nextAttemptAt)}</p>:null}</td>
      <td data-label={u.evidence}><div className="queue-source-checks">{job.scan_result?<span><ShieldCheck size={13}/>{status(job.scan_result)}</span>:<span>—</span>}{job.extraction?<small>{t.pages}: {job.extraction.pages} · {t.tables}: {job.extraction.tables}</small>:null}</div></td>
      <td data-label={u.actions}><div className="queue-row-actions">{job.document_id&&job.extraction?.originalAvailable!==false?<button type="button" className="button-primary" aria-label={`${t.result} · ${job.name}`} onClick={()=>inspect(job.document_id!)}>{t.result}<ArrowUpRight size={14}/></button>:null}<button type="button" className="button-link" aria-label={`${t.details} · ${job.name}`} onClick={()=>setSelected(job.id)}><History size={14}/>{t.details}</button>{canWrite&&canRetry(job)?<button type="button" className="button-secondary" disabled={busy} onClick={()=>retry(job)}><RefreshCw size={14}/>{t.retry}</button>:null}{canWrite&&job.canCancel?<button type="button" className="button-link" disabled={busy} onClick={()=>setCancelId(job.id)}><XCircle size={14}/>{t.cancel}</button>:null}</div></td>
    </tr>)}</tbody></table></div>
    {!jobs.length?<div className="lab-empty"><FileSearch size={28}/><p>{t.empty}</p></div>:null}
    <p className="lab-caption queue-scope">{t.scope}</p>
    <details className="pipeline-stage-help"><summary>{u.stages}</summary><ol className="pipeline-overview-steps" aria-label={u.stages}>{pipelineStages.map((stage,index)=><li key={stage}><span>{String(index+1).padStart(2,'0')}</span><strong>{t[stage]}</strong>{stage==='EXTRACT'?<small><Sparkles size={12}/>AI</small>:null}</li>)}</ol></details>
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
