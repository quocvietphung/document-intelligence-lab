"use client";

import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {ArrowUpRight,Check,Database,FileSearch,FlaskConical,GitBranch,Layers3,RefreshCw,Search,ShieldCheck,Sparkles,Upload} from "lucide-react";
import {useAuth} from "@/components/auth/KeycloakProvider";
import {platformSchema,searchSchema,percent,noticeIsVisible,currentEvidenceSearch,type PlatformData,type SearchData,type PlatformView} from "@/lib/platform";
import {platformText} from "@/lib/platform-language";
import {demoPlatform,demoSearch} from "@/lib/public-demo";
import {publicDemoText} from "@/lib/public-demo-language";
import {datevLabels} from "@/lib/datev-reference";
import {ModalSurface} from "./ModalSurface";
import {customerUx,reviewAlertPresentation} from "@/lib/customer-ux";
import {workspaceText} from "@/lib/workspace-language";
import {DocumentCorpus} from "./DocumentCorpus";
import {documentFocusText} from "@/lib/document-focus";
import {DocumentResearchPanel} from './DocumentResearchPanel';
import {researchText} from '@/lib/document-research';
import {DocumentPipeline} from './DocumentPipeline';
import {DocumentBatches} from './DocumentBatches';
import {batchText} from '@/lib/document-batches';
import {activeDocumentJob} from '@/lib/document-results';

function Metric({label,value,detail}:{label:string;value:React.ReactNode;detail?:string}) {
  return <div className="lab-metric"><span>{label}</span><strong>{value}</strong>{detail?<small>{detail}</small>:null}</div>;
}
function Badge({children,tone="neutral"}:{children:React.ReactNode;tone?:"neutral"|"good"|"warn"}){return <span className={`lab-badge lab-badge-${tone}`}>{children}</span>;}

export function PlatformWorkbench({caseId,locale,view,ask,inspect,changed,documents=[],caseVersion=0,domain='banking'}:{caseId:string;locale:string;view:PlatformView;ask:(question:string)=>void;inspect:(documentId:string,page?:number)=>void;changed:()=>Promise<void>;documents?:readonly {id:string;name:string}[];caseVersion?:number;domain?:string}) {
  const auth=useAuth(),t=platformText(locale);
  const ux=customerUx(locale),fieldText=workspaceText(locale);
  const demo=auth.mode==="demo",d=publicDemoText(locale);
  const [snapshot,setData]=useState<PlatformData>();const data=snapshot?.caseId===caseId?snapshot:undefined;const [searchResult,setSearchResult]=useState<{version:number;data:SearchData}>();
  const search=currentEvidenceSearch(searchResult,caseVersion),loadSequence=useRef(0);
  const [query,setQuery]=useState("");const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  const [reviewId,setReviewId]=useState<string>();const [note,setNote]=useState("");const [success,setSuccess]=useState<"queued"|"reviewed"|"cancelled">();
  const [noticeView,setNoticeView]=useState<PlatformView>(view);
  const [retryJob,setRetryJob]=useState<PlatformData["jobs"][number]>();
  const [pipelinePanel,setPipelinePanel]=useState<'processing'|'batches'|'assets'>('processing');
  useEffect(()=>{if(view!=='pipeline')return;const sync=()=>{const panel=new URLSearchParams(window.location.search).get('pipeline');if(panel==='processing'||panel==='batches'||panel==='assets')setPipelinePanel(panel);};const timer=setTimeout(sync,0);window.addEventListener('popstate',sync);return()=>{clearTimeout(timer);window.removeEventListener('popstate',sync);};},[view]);
  const research=researchText(locale);
  const input=useRef<HTMLInputElement>(null),inFlight=useRef(false),finished=useRef(new Set<string>());
  const canUpload=auth.roles.some(r=>r==="ADVISOR"||r==="ADMIN");const canReview=auth.roles.some(r=>r==="REVIEWER"||r==="ADMIN");
  const root=`/api/cases/${caseId}/platform`;
  const load=useCallback(async(signal?:AbortSignal)=>{
    const sequence=++loadSequence.current;
    if(demo){setData(demoPlatform(caseId));setLoading(false);setError("");return;}
    try{const r=await fetch(root,{headers:{Authorization:`Bearer ${auth.token}`},cache:"no-store",signal});if(!r.ok)throw new Error();const next=platformSchema.parse(await r.json());if(next.caseId!==caseId)throw new Error();if(!signal?.aborted&&sequence===loadSequence.current)setData(next);}
    catch{if(!signal?.aborted&&sequence===loadSequence.current){setData(previous=>previous?.caseId===caseId?previous:undefined);setNoticeView(view);setError("error");}}finally{if(!signal?.aborted&&sequence===loadSequence.current)setLoading(false);}
  },[root,auth.token,view,demo,caseId]);
  useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>void load(controller.signal),0);return()=>{clearTimeout(timer);controller.abort();};},[load,caseVersion]);
  const active=data?.jobs.some(activeDocumentJob);
  useEffect(()=>{if(!active)return;const controller=new AbortController();const timer=setInterval(()=>{if(!document.hidden)void load(controller.signal);},3500);return()=>{clearInterval(timer);controller.abort();};},[active,load]);
  useEffect(()=>{if(!data)return;const complete=data.jobs.filter(j=>j.status==="COMPLETE");if(complete.some(j=>!finished.current.has(j.id))){complete.forEach(j=>finished.current.add(j.id));void changed();}},[data,changed]);
  async function action(path:string,body?:BodyInit,form=false){
    const r=await fetch(root+path,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`,...(form?{}:{"Content-Type":"application/json"})},body});
    if(!r.ok)throw new Error(r.status===429?"limit":r.status===409?(path.endsWith('/cancel')?'cancelRace':"duplicate"):r.status===422?"rejected":"error");return r.json();
  }
  async function run(task:()=>Promise<void>){if(inFlight.current)return;inFlight.current=true;setBusy(true);setNoticeView(view);setError("");setSuccess(undefined);try{await task();}catch(e){setError(e instanceof Error?e.message:"error");}finally{setBusy(false);inFlight.current=false;}}
  function retrieve(event?:FormEvent,question=query){event?.preventDefault();if(!question.trim())return;setQuery(question);const version=caseVersion;if(demo){setSearchResult({version,data:demoSearch(question)});return;}void run(async()=>setSearchResult({version,data:searchSchema.parse(await action("/search",JSON.stringify({question:question.trim()})))}));}
  async function queue(file:File){if(!file.size||file.size>3_000_000)throw new Error("rejected");const form=new FormData();form.set("file",file);await action("/jobs",form,true);setSuccess("queued");await load();}
  function sample(){window.location.hash="documents";}
  function retry(){if(!retryJob)return;const id=retryJob.id;setRetryJob(undefined);void run(async()=>{await action(`/jobs/${id}/retry`);setSuccess("queued");await load();});}
  async function cancelJob(job:PlatformData['jobs'][number]){await run(async()=>{await action(`/jobs/${job.id}/cancel`);setSuccess('cancelled');await load();});}
  function review(event:FormEvent){event.preventDefault();if(!reviewId||!note.trim())return;void run(async()=>{await action("/reviews",JSON.stringify({alertId:reviewId,note}));setReviewId(undefined);setNote("");setSuccess("reviewed");await load();});}
  const azure=data?.documentPipeline.provider.mode!=="local";
  const fileHint=t(azure?"formatAzure":"format").replace("{pages}",String(data?.documentPipeline.provider.maxPages||4));
  const date=(value:string)=>new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
  return <div className="lab-workbench">
    
    {view!=='pipeline'||pipelinePanel==='processing'?<div className="lab-page-heading"><div><span className="eyebrow">{t(view)} · {caseId}</span><h1>{t(`${view==="evaluation"?"quality":view}Title`)}</h1><p>{demo&&view==="operations"?d("operationsHint"):t(`${view==="evaluation"?"quality":view}Hint`)}</p></div><button className="button-secondary" onClick={()=>{setError("");void load();}} disabled={busy}><RefreshCw size={16}/>{t("refresh")}</button></div>:null}
    {error&&noticeIsVisible(noticeView,view)?<p className="notice-error" role="alert">{t(error)}</p>:null}{success&&noticeIsVisible(noticeView,view)?<p className="notice-success" role="status">{t(success)}</p>:null}
    {loading?<div className="lab-loading" role="status"><Layers3 size={28}/>{t("loading")}</div>:null}
    {data&&view==="studio"?<>
      <section className="lab-command"><div className="lab-command-icon"><Sparkles size={24}/></div><div><Badge>{t("implementation")}</Badge><h3>{demo?d("engine"):t("engine")}</h3><p>{demo?d("modelNote"):t("modelNote")}</p></div>
        <form onSubmit={retrieve}><label htmlFor="lab-evidence-query" className="sr-only">{t("query")}</label><input data-page-tour="studio-query" id="lab-evidence-query" value={query} onChange={e=>setQuery(e.target.value)} maxLength={2000} placeholder={t("query")}/><button data-page-tour="studio-search" className="button-primary" disabled={busy||!query.trim()}><Search size={17}/>{t(busy?"loading":"search")}</button></form>
        <div data-page-tour="studio-suggestions" className="lab-suggestions">{["sampleQuery","sampleQuery2","sampleQuery3"].map(key=><button key={key} disabled={busy} onClick={()=>retrieve(undefined,t(key))}>{t(key)} <ArrowUpRight size={13}/></button>)}</div>
      </section>
      <div data-page-tour="studio-results">{search?<><div className="lab-metrics"><Metric label={t("chunks")} value={search.search.chunks}/><Metric label={t("retrieval")} value={search.search.backend} detail={search.search.embedding}/><Metric label={t("duration")} value={`${search.durationMs} ms`}/></div>
        <p className="lab-caption">{demo?d("modelNote"):t("scoreHint")}</p>
        <section className="surface lab-section"><div className="lab-section-heading"><h3>{t("plan")}</h3><Badge tone="good">{t(search.plan.specialist)}</Badge></div><div className="lab-route">{search.plan.steps.map((s,i)=><div key={s.agent}><span>{i+1}</span><strong>{t(s.agent)}</strong><small>{s.tools.join(" · ")||s.state}</small></div>)}</div></section>
        <section className="lab-sources"><h3>{t("results")}</h3>{search.search.hits.map((hit,i)=><article className="surface lab-source" key={hit.id}><div className="lab-source-heading"><span className="lab-rank">{String(i+1).padStart(2,"0")}</span><div><h4>{hit.title}</h4><code>[{hit.id}]</code></div>{demo?<Badge>{d("badge")}</Badge>:<Badge>{t("score")}: {hit.score.toFixed(3)}</Badge>}</div><p>{hit.text}</p><div className="lab-source-footer">{demo?null:<span>{t("vector")}: {hit.vector.toFixed(3)} · {t("lexical")}: {hit.lexical.toFixed(3)}</span>}{hit.documentId!=="case"&&hit.documentId!=="policy"?<button className="button-link" onClick={()=>inspect(hit.documentId)}>{t("source")} <ArrowUpRight size={15}/></button>:null}</div></article>)}</section>
        {search.search.quarantined.length?<p className="notice-error">{t("quarantine")}: {search.search.quarantined.join(", ")}</p>:null}
      </>:<section className="surface lab-empty"><FileSearch size={32}/><p>{t("noResults")}</p></section>}</div>
      <button data-page-tour="studio-nova" className="button-primary" disabled={busy||!query.trim()} onClick={()=>ask(query)}><Sparkles size={17}/>{t("ask")}</button>
      <section className="surface lab-section"><h3>{t("agents")}</h3><p className="lab-caption">{demo?d("modelNote"):t("agentHint")}</p><div className="lab-agent-grid">{data.agents.map(a=><article key={a.name}><GitBranch size={20}/><h4>{t(a.name)}</h4>{a.tools.map(tool=><code key={tool}>{tool}</code>)}</article>)}</div></section>
      <AgentRuns data={data} locale={locale}/>
    </>:null}
    {data&&view==='pipeline'?<div className="research-tabs" aria-label={research('pipeline')}>{(['processing','batches','assets'] as const).map(id=><button key={id} className={pipelinePanel===id?'selected':''} aria-pressed={pipelinePanel===id} onClick={()=>setPipelinePanel(id)}>{id==='batches'?batchText(locale).title:research(id)}</button>)}</div>:null}
    {data&&view==='pipeline'&&pipelinePanel==='batches'&&!demo?<DocumentBatches key={caseId} caseId={caseId} locale={locale} azure={azure} provider={data.documentPipeline.provider.activeProvider} canWrite={canUpload&&data.persistent} inspect={inspect} changed={changed}/>:null}
    {data&&view==='pipeline'&&pipelinePanel==='assets'?<DocumentResearchPanel key={`${caseId}:${caseVersion}`} caseId={caseId} caseVersion={caseVersion} locale={locale} view="assets" inspect={inspect}/>:null}
    {data&&view==="pipeline"&&pipelinePanel==='processing'?<>
      <div data-page-tour="pipeline-provider" className="lab-metrics"><Metric label={t("provider")} value={data.documentPipeline.provider.activeProvider} detail={data.documentPipeline.provider.modelId}/><Metric label={t("scanner")} value={data.documentPipeline.scanner}/><Metric label={t("retention")} value={`${data.documentPipeline.retentionDays} ${t("days")}`} detail={data.documentPipeline.storage}/></div>
      <section className="lab-upload"><div className="lab-upload-icon"><Upload size={30}/></div><div><h3>{t("stages")}</h3><p>{fileHint}</p></div><div className="lab-upload-actions"><input ref={input} type="file" accept={azure?".pdf,.png,.jpg,.jpeg":".pdf,.png,.jpg,.jpeg,.txt"} className="hidden" onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void run(()=>queue(file));}}/><button data-page-tour="pipeline-upload" className="button-primary" disabled={busy||!canUpload||!data.persistent} onClick={()=>input.current?.click()}><Upload size={16}/>{t("upload")}</button><button data-page-tour="pipeline-datev" style={domain!=='banking'?{display:'none'}:undefined} className="button-secondary" disabled={busy} onClick={sample}><FlaskConical size={16}/>{datevLabels(locale).title}</button></div></section>
      <DocumentPipeline data={data} locale={locale} busy={busy} canWrite={canUpload&&!demo} inspect={inspect} retry={setRetryJob} cancel={cancelJob}/>
      <p className="lab-caption">{t("retentionHint")}</p>
      {retryJob?<ModalSurface title={t("retryTitle")} label={t("closeRetry")} close={()=>setRetryJob(undefined)}><p className="font-semibold">{retryJob.name}</p><p className="mt-3 text-sm leading-relaxed">{t("retryConfirm")} <strong>{data.documentPipeline.provider.activeProvider}</strong>.</p><p className="mt-3 text-xs leading-relaxed text-slate-500">{t("retryHistory")}</p><div className="mt-5 flex justify-end gap-3"><button className="button-secondary" onClick={()=>setRetryJob(undefined)}>{t("cancelRetry")}</button><button className="button-primary" disabled={busy||!canUpload||demo} onClick={retry}>{t("confirmRetry")}</button></div></ModalSurface>:null}
    </>:null}
    {data&&view==="evaluation"?<DocumentCorpus key={`${caseId}:${caseVersion}`} caseId={caseId} locale={locale} inspect={inspect} ask={ask}/>:null}
    {data&&view==="controls"?<>
      <a data-page-tour="controls-document-sources" className="button-secondary" href={"?case="+encodeURIComponent(caseId)+"#documents"}>{documentFocusText(locale).upload}</a>
      <section data-page-tour="controls-alerts" className="surface lab-section"><h3>{t("alerts")}</h3><p className="lab-caption">{t("roleHint")}</p><div className="lab-alerts">{data.banking.alerts.map(alert=>{const reviewed=data.reviews.find(r=>(r.alertId||r.id)===alert.id),presentation=reviewAlertPresentation(alert,locale,documents);return <article key={alert.id}><div><Badge tone={alert.severity==="HIGH"?"warn":"neutral"}>{presentation.severity}</Badge><h4>{presentation.title===alert.code?fieldText(alert.code):presentation.title}</h4><p>{presentation.detail}</p><details className="lab-technical"><summary>{ux.technical}</summary><code>{alert.code} · {alert.source}</code><p>{alert.detail}</p></details>{reviewed?<p className="lab-review-note"><Check size={14}/>{reviewed.note} · {date(reviewed.time)}</p>:null}</div><button className="button-secondary" disabled={!canReview||busy} onClick={()=>{setReviewId(alert.id);setNote(reviewed?.note||"");}}>{t("acknowledge")}</button></article>;})}</div>
        {reviewId?<form onSubmit={review} className="lab-review-form"><label htmlFor="lab-review-note">{t("note")}</label><textarea id="lab-review-note" value={note} onChange={e=>setNote(e.target.value)} maxLength={500} rows={3} required/><div><button type="button" className="button-secondary" onClick={()=>setReviewId(undefined)} disabled={busy}>{t("cancel")}</button><button className="button-primary" disabled={busy||!note.trim()}>{t("save")}</button></div></form>:null}
      </section>
    </>:null}
    {data&&view==="operations"?<>
      <div data-page-tour="operations-status" className="lab-metrics"><Metric label={t("database")} value={t(data.persistent?"connected":"notConfigured")} detail="PostgreSQL"/><Metric label={t("rateLimits")} value={data.limits}/><Metric label={t("storage")} value={data.documentPipeline.storage}/></div>
      <section data-page-tour="operations-runbooks" className="lab-ops-grid">{[[Database,"migration","flyway"],[ShieldCheck,"security","securityHint"],[Layers3,"backups","backupHint"],[GitBranch,"telemetry","telemetryHint"]].map(([Icon,title,body])=>{const Symbol=Icon as typeof Database;return <article className="surface lab-section" key={String(title)}><Symbol size={25}/><h3>{t(String(title))}</h3><p className="lab-caption">{t(String(body))}</p></article>;})}</section>
      <section className="surface lab-section"><h3>{t("metrics")}</h3><p className="lab-caption">{t("prometheus")}</p><code>/actuator/prometheus</code></section><AgentRuns data={data} locale={locale}/>
      <section className="surface lab-section"><h3>{t("recentActivity")}</h3>{data.reviews.length?data.reviews.map(r=><article key={r.id} className="lab-reconcile"><div><strong>{r.id}</strong><p>{r.note}</p><small>{date(r.time)} · {r.actor}</small></div><Badge tone="good">{r.state}</Badge></article>):<p className="lab-empty">{t("empty")}</p>}</section>
    </>:null}
  </div>;
}

function AgentRuns({data,locale}:{data:PlatformData;locale:string}) {
  const t=platformText(locale);
  return <section data-page-tour="studio-traces" className="surface lab-section"><h3>{t("runs")}</h3><p className="lab-caption">{t("supportHint")}</p>{data.runs.length?<div className="lab-run-list">{data.runs.slice(0,8).map(run=><details key={run.id}><summary><GitBranch size={17}/><strong>{t(run.specialist)}</strong><span>{run.mode}</span><span>{run.durationMs} ms</span><Badge tone={run.quality.requiresReview?"warn":"good"}>{t("support")}: {percent(run.quality.lexicalSupport)}</Badge></summary><div><code>{run.id}</code><p>{t("sourceIds")}: {run.quality.validCitations.join(", ")||"—"}</p>{run.quality.invalidCitations.length?<p className="notice-error">{t("reviewRequired")}: {run.quality.invalidCitations.join(", ")}</p>:null}<ol>{run.steps.map(s=><li key={s.agent}>{t(s.agent)} · {s.tools.join(", ")}</li>)}</ol></div></details>)}</div>:<p className="lab-empty">{t("noRuns")}</p>}</section>;
}
