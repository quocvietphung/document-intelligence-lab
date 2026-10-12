"use client";

import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {ArrowUpRight,Check,CheckCircle2,Clock3,Database,Download,FileSearch,FlaskConical,GitBranch,Layers3,RefreshCw,Search,ShieldCheck,Sparkles,Upload} from "lucide-react";
import {useAuth} from "@/components/auth/KeycloakProvider";
import {platformSchema,searchSchema,evaluationSchema,percent,pipelineStage,noticeIsVisible,type PlatformData,type SearchData,type EvaluationData,type PlatformView} from "@/lib/platform";
import {platformText} from "@/lib/platform-language";
import {bankMoney} from "@/lib/banking";
import {demoPlatform,demoSearch,demoXml} from "@/lib/public-demo";
import {publicDemoText} from "@/lib/public-demo-language";
import {datevLabels} from "@/lib/datev-reference";

function Metric({label,value,detail}:{label:string;value:React.ReactNode;detail?:string}) {
  return <div className="lab-metric"><span>{label}</span><strong>{value}</strong>{detail?<small>{detail}</small>:null}</div>;
}
function Badge({children,tone="neutral"}:{children:React.ReactNode;tone?:"neutral"|"good"|"warn"}){return <span className={`lab-badge lab-badge-${tone}`}>{children}</span>;}

export function PlatformWorkbench({caseId,locale,view,ask,inspect,changed}:{caseId:string;locale:string;view:PlatformView;ask:(question:string)=>void;inspect:(documentId:string)=>void;changed:()=>Promise<void>}) {
  const auth=useAuth(),t=platformText(locale);
  const demo=auth.mode==="demo",d=publicDemoText(locale);
  const [data,setData]=useState<PlatformData>();const [search,setSearch]=useState<SearchData>();const [evaluation,setEvaluation]=useState<EvaluationData>();
  const [query,setQuery]=useState("");const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  const [reviewId,setReviewId]=useState<string>();const [note,setNote]=useState("");const [success,setSuccess]=useState<"queued"|"reviewed">();
  const [noticeView,setNoticeView]=useState<PlatformView>(view);
  const input=useRef<HTMLInputElement>(null),inFlight=useRef(false),finished=useRef(new Set<string>());
  const canUpload=auth.roles.some(r=>r==="ADVISOR"||r==="ADMIN");const canReview=auth.roles.some(r=>r==="REVIEWER"||r==="ADMIN");
  const root=`/api/cases/${caseId}/platform`;
  const load=useCallback(async(signal?:AbortSignal)=>{
    if(demo){setData(demoPlatform(caseId));setLoading(false);setError("");return;}
    try{const r=await fetch(root,{headers:{Authorization:`Bearer ${auth.token}`},cache:"no-store",signal});if(!r.ok)throw new Error();const next=platformSchema.parse(await r.json());setData(next);}
    catch{if(!signal?.aborted){setNoticeView(view);setError("error");}}finally{if(!signal?.aborted)setLoading(false);}
  },[root,auth.token,view,demo,caseId]);
  useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>void load(controller.signal),0);return()=>{clearTimeout(timer);controller.abort();};},[load]);
  const active=data?.jobs.some(j=>["QUEUED","PROCESSING","RETRY"].includes(j.status));
  useEffect(()=>{if(!active)return;const timer=setInterval(()=>void load(),3500);return()=>clearInterval(timer);},[active,load]);
  useEffect(()=>{if(!data)return;const complete=data.jobs.filter(j=>j.status==="COMPLETE");if(complete.some(j=>!finished.current.has(j.id))){complete.forEach(j=>finished.current.add(j.id));void changed();}},[data,changed]);
  async function action(path:string,body?:BodyInit,form=false){
    const r=await fetch(root+path,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`,...(form?{}:{"Content-Type":"application/json"})},body});
    if(!r.ok)throw new Error(r.status===429?"limit":r.status===409?"duplicate":r.status===422?"rejected":"error");return r.json();
  }
  async function run(task:()=>Promise<void>){if(inFlight.current)return;inFlight.current=true;setBusy(true);setNoticeView(view);setError("");setSuccess(undefined);try{await task();}catch(e){setError(e instanceof Error?e.message:"error");}finally{setBusy(false);inFlight.current=false;}}
  function retrieve(event?:FormEvent,question=query){event?.preventDefault();if(!question.trim())return;setQuery(question);if(demo){setSearch(demoSearch(question));return;}void run(async()=>setSearch(searchSchema.parse(await action("/search",JSON.stringify({question:question.trim()})))));}
  async function queue(file:File){if(!file.size||file.size>3_000_000)throw new Error("rejected");const form=new FormData();form.set("file",file);await action("/jobs",form,true);setSuccess("queued");await load();}
  function sample(){window.location.hash="documents";}
  function evaluate(){if(demo)return;void run(async()=>{const report=evaluationSchema.parse(await action("/evaluate"));setEvaluation(report);await load();});}
  function review(event:FormEvent){event.preventDefault();if(!reviewId||!note.trim())return;void run(async()=>{await action("/reviews",JSON.stringify({alertId:reviewId,note}));setReviewId(undefined);setNote("");setSuccess("reviewed");await load();});}
  function downloadXml(){void run(async()=>{let blob:Blob;if(demo){blob=new Blob([demoXml],{type:"application/xml"});}else{const r=await fetch(root+"/sample-xml",{headers:{Authorization:`Bearer ${auth.token}`}});if(!r.ok)throw new Error("error");blob=await r.blob();}const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="iso20022-non-submittable-demo.xml";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});}
  const report=evaluation||data?.evaluations[0];
  const azure=data?.documentPipeline.provider.mode!=="local";
  const fileHint=t(azure?"formatAzure":"format").replace("{pages}",String(data?.documentPipeline.provider.maxPages||4));
  const date=(value:string)=>new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
  return <div className="lab-workbench">
    
    <div className="lab-page-heading"><div><span className="eyebrow">{t(view)} · {caseId}</span><h1>{t(`${view==="evaluation"?"quality":view}Title`)}</h1><p>{demo&&view==="operations"?d("operationsHint"):t(`${view==="evaluation"?"quality":view}Hint`)}</p></div><button className="button-secondary" onClick={()=>{setError("");void load();}} disabled={busy}><RefreshCw size={16}/>{t("refresh")}</button></div>
    {error&&noticeIsVisible(noticeView,view)?<p className="notice-error" role="alert">{t(error)}</p>:null}{success&&noticeIsVisible(noticeView,view)?<p className="notice-success" role="status">{t(success)}</p>:null}
    {loading?<div className="lab-loading" role="status"><Layers3 size={28}/>{t("loading")}</div>:null}
    {data&&view==="studio"?<>
      <section className="lab-command"><div className="lab-command-icon"><Sparkles size={24}/></div><div><Badge>{t("implementation")}</Badge><h3>{demo?d("engine"):t("engine")}</h3><p>{demo?d("modelNote"):t("modelNote")}</p></div>
        <form onSubmit={retrieve}><label htmlFor="lab-evidence-query" className="sr-only">{t("query")}</label><input id="lab-evidence-query" value={query} onChange={e=>setQuery(e.target.value)} maxLength={2000} placeholder={t("query")}/><button className="button-primary" disabled={busy||!query.trim()}><Search size={17}/>{t(busy?"loading":"search")}</button></form>
        <div className="lab-suggestions">{["sampleQuery","sampleQuery2","sampleQuery3"].map(key=><button key={key} disabled={busy} onClick={()=>retrieve(undefined,t(key))}>{t(key)} <ArrowUpRight size={13}/></button>)}</div>
      </section>
      {search?<><div className="lab-metrics"><Metric label={t("chunks")} value={search.search.chunks}/><Metric label={t("retrieval")} value={search.search.backend} detail={search.search.embedding}/><Metric label={t("duration")} value={`${search.durationMs} ms`}/></div>
        <p className="lab-caption">{demo?d("modelNote"):t("scoreHint")}</p>
        <section className="surface lab-section"><div className="lab-section-heading"><h3>{t("plan")}</h3><Badge tone="good">{t(search.plan.specialist)}</Badge></div><div className="lab-route">{search.plan.steps.map((s,i)=><div key={s.agent}><span>{i+1}</span><strong>{t(s.agent)}</strong><small>{s.tools.join(" · ")||s.state}</small></div>)}</div></section>
        <section className="lab-sources"><h3>{t("results")}</h3>{search.search.hits.map((hit,i)=><article className="surface lab-source" key={hit.id}><div className="lab-source-heading"><span className="lab-rank">{String(i+1).padStart(2,"0")}</span><div><h4>{hit.title}</h4><code>[{hit.id}]</code></div>{demo?<Badge>{d("badge")}</Badge>:<Badge>{t("score")}: {hit.score.toFixed(3)}</Badge>}</div><p>{hit.text}</p><div className="lab-source-footer">{demo?null:<span>{t("vector")}: {hit.vector.toFixed(3)} · {t("lexical")}: {hit.lexical.toFixed(3)}</span>}{hit.documentId!=="case"&&hit.documentId!=="policy"?<button className="button-link" onClick={()=>inspect(hit.documentId)}>{t("source")} <ArrowUpRight size={15}/></button>:null}</div></article>)}</section>
        {search.search.quarantined.length?<p className="notice-error">{t("quarantine")}: {search.search.quarantined.join(", ")}</p>:null}
        <button className="button-primary" disabled={busy} onClick={()=>ask(query)}><Sparkles size={17}/>{t("ask")}</button>
      </>:<section className="surface lab-empty"><FileSearch size={32}/><p>{t("noResults")}</p></section>}
      <section className="surface lab-section"><h3>{t("agents")}</h3><p className="lab-caption">{demo?d("modelNote"):t("agentHint")}</p><div className="lab-agent-grid">{data.agents.map(a=><article key={a.name}><GitBranch size={20}/><h4>{t(a.name)}</h4>{a.tools.map(tool=><code key={tool}>{tool}</code>)}</article>)}</div></section>
      <AgentRuns data={data} locale={locale}/>
    </>:null}
    {data&&view==="pipeline"?<>
      <div className="lab-metrics"><Metric label={t("provider")} value={data.documentPipeline.provider.activeProvider} detail={data.documentPipeline.provider.modelId}/><Metric label={t("scanner")} value={data.documentPipeline.scanner}/><Metric label={t("retention")} value={`${data.documentPipeline.retentionDays} ${t("days")}`} detail={data.documentPipeline.storage}/></div>
      <section className="lab-upload"><div className="lab-upload-icon"><Upload size={30}/></div><div><h3>{t("stages")}</h3><p>{fileHint}</p></div><div className="lab-upload-actions"><input ref={input} type="file" accept={azure?".pdf,.png,.jpg,.jpeg":".pdf,.png,.jpg,.jpeg,.txt"} className="hidden" onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void run(()=>queue(file));}}/><button className="button-primary" disabled={busy||!canUpload||!data.persistent} onClick={()=>input.current?.click()}><Upload size={16}/>{t("upload")}</button><button className="button-secondary" disabled={busy||!canUpload||!data.persistent} onClick={sample}><FlaskConical size={16}/>{datevLabels(locale).title}</button></div></section>
      <section className="surface lab-section"><div className="lab-section-heading"><h3>{t("queue")}</h3><Badge tone={active?"warn":"good"}>{active?<Clock3 size={13}/>:<CheckCircle2 size={13}/>} {demo?d("worker"):t("worker")}</Badge></div>
        {data.jobs.length?<div className="lab-job-list">{data.jobs.map(job=><article key={job.id} className="lab-job"><div className="lab-job-icon"><FileSearch size={23}/></div><div className="lab-job-main"><strong>{job.name}</strong><small>{date(job.createdAt)} · {t("attempt")} {job.attempt}</small><div className="lab-job-stage"><Badge tone={job.status==="COMPLETE"?"good":job.status==="FAILED"?"warn":"neutral"}>{t(job.status)}</Badge><span>{t(pipelineStage(job))}</span>{job.scan_result?<span>{t(job.scan_result)}</span>:null}</div>{job.error_code?<p className="lab-job-error">{job.error_code}</p>:null}<small>{t("expires")}: {date(job.expiresAt)}</small></div>{job.document_id?<button className="button-secondary" onClick={()=>inspect(job.document_id!)}>{t("evidence")}</button>:null}</article>)}</div>:<div className="lab-empty"><Upload size={30}/><p>{t("empty")}</p></div>}
      </section><p className="lab-caption">{t("retentionHint")}</p>
    </>:null}
    {data&&view==="evaluation"?<>
      <section className="lab-quality-banner"><FlaskConical size={30}/><div><h3>{t("dataset")}: synthetic-text-v2</h3><p>{demo?d("quality"):t("qualityNote")}</p></div><button className="button-primary" disabled={busy||demo} onClick={evaluate}>{busy?<RefreshCw size={17}/>:<FlaskConical size={17}/>} {t(busy?"loading":"evaluate")}</button></section>
      {report?<><div className="lab-metrics"><Metric label={t("references")} value={report.references}/><Metric label={t("precision")} value={percent(report.precision)}/><Metric label={t("recall")} value={percent(report.recall)}/><Metric label={t("f1")} value={percent(report.f1)}/></div><div className="lab-metrics"><Metric label={t("classification")} value={percent(report.classification)}/><Metric label={t("recall5")} value={percent(report.recallAt5)}/><Metric label={t("injectionTests")} value={report.injectionQuarantined}/></div>
        <section className="surface lab-section"><h3>{t("fields")}</h3><div className="lab-table-wrap"><table className="audit-table"><thead><tr><th>{t("fields")}</th><th>{t("precision")}</th><th>{t("recall")}</th><th>{t("f1")}</th><th>TP / FP / FN</th></tr></thead><tbody>{report.fields.map(f=><tr key={f.field}><td><code>{f.field}</code></td><td>{percent(f.precision)}</td><td>{percent(f.recall)}</td><td><div className="lab-score-bar"><i style={{width:`${f.f1}%`}}/></div>{percent(f.f1)}</td><td>{f.truePositive} / {f.falsePositive} / {f.falseNegative}</td></tr>)}</tbody></table></div><p className="lab-caption">{t("lastRun")}: {date(report.createdAt)} · {report.id}</p></section>
        <section className="surface lab-section"><h3>{t("failures")}</h3><div className="lab-failure-grid">{report.rows.filter(row=>row.misses.length||!row.typeCorrect||row.quarantined).map(row=><article key={row.id}><div className="lab-section-heading"><strong>{row.id} · {row.scenario}</strong><Badge tone="warn">{row.quarantined?t("quarantine"):row.misses.join(", ")}</Badge></div><p>{t("expected")}: <code>{JSON.stringify(row.expected)}</code></p><p>{t("actual")}: <code>{JSON.stringify(row.actual)}</code></p></article>)}</div></section>
        <section className="surface lab-section"><h3>{t("confusion")}</h3><div className="lab-confusion">{Object.entries(report.confusion).map(([key,value])=><span key={key}>{key} <strong>{value}</strong></span>)}</div></section>
      </>:<section className="surface lab-empty"><FlaskConical size={32}/><p>{demo?d("quality"):t("qualityEmpty")}</p>{demo?<a className="button-secondary" href="https://github.com/quocvietphung/credit-intelligence-lab/blob/master/docs/PLATFORM_VERIFICATION.md" target="_blank" rel="noopener noreferrer">{d("dataset")}</a>:null}</section>}
    </>:null}
    {data&&view==="controls"?<>
      <div className="lab-metrics"><Metric label={t("debits")} value={bankMoney(data.banking.debitCents,locale)}/><Metric label={t("credits")} value={bankMoney(data.banking.creditCents,locale)}/><Metric label={t("balanced")} value={data.banking.balanced?<CheckCircle2 size={30}/>:"—"}/></div>
      <section className="surface lab-section"><h3>{t("alerts")}</h3><p className="lab-caption">{t("roleHint")}</p><div className="lab-alerts">{data.banking.alerts.map(alert=>{const reviewed=data.reviews.find(r=>(r.alertId||r.id)===alert.id);return <article key={alert.id}><div><Badge tone={alert.severity==="HIGH"?"warn":"neutral"}>{alert.severity}</Badge><h4>{alert.code.replaceAll("_"," ")}</h4><p>{alert.detail}</p><code>{alert.source}</code>{reviewed?<p className="lab-review-note"><Check size={14}/>{reviewed.note} · {date(reviewed.time)}</p>:null}</div><button className="button-secondary" disabled={!canReview||busy} onClick={()=>{setReviewId(alert.id);setNote(reviewed?.note||"");}}>{t("acknowledge")}</button></article>;})}</div>
        {reviewId?<form onSubmit={review} className="lab-review-form"><label htmlFor="lab-review-note">{t("note")}</label><textarea id="lab-review-note" value={note} onChange={e=>setNote(e.target.value)} maxLength={500} rows={3} required/><div><button type="button" className="button-secondary" onClick={()=>setReviewId(undefined)} disabled={busy}>{t("cancel")}</button><button className="button-primary" disabled={busy||!note.trim()}>{t("save")}</button></div></form>:null}
      </section>
      <section className="surface lab-section"><h3>{t("reconcile")}</h3><p className="lab-caption">{t("comparisonHint")}</p>{data.banking.reconciliation.length?data.banking.reconciliation.map((r,i)=><article key={`${r.documentId}-${i}`} className="lab-reconcile"><div><code>{r.documentId}</code><strong>{r.field}: {r.value}</strong><Badge tone={r.state==="AMOUNT_ONLY_MATCH"?"good":"warn"}>{t(r.state==="AMOUNT_ONLY_MATCH"?"amountOnly":"noMatch")}</Badge><small>{r.transactionIds.join(", ")}</small></div><button className="button-link" onClick={()=>inspect(r.documentId)}>{t("evidence")} →</button></article>):<p className="lab-empty">{t("reconcileEmpty")}</p>}</section>
      <section className="surface lab-section"><h3>{t("ledger")}</h3><div className="lab-table-wrap"><table className="audit-table"><thead><tr><th>{t("reference")}</th><th>{t("debit")}</th><th>{t("credit")}</th><th>{t("amount")}</th></tr></thead><tbody>{data.banking.ledger.map(row=><tr key={row.id}><td><strong>{row.id}</strong><small className="block">{row.reference}</small></td><td>{row.debit}</td><td>{row.credit}</td><td>{bankMoney(row.amountCents,locale)}</td></tr>)}</tbody></table></div></section>
      <section className="surface lab-section"><div className="lab-section-heading"><h3>{t("mockAdapter")}</h3><button className="button-secondary" disabled={busy} onClick={downloadXml}><Download size={16}/>{t("downloadXml")}</button></div><p className="lab-caption">{t("xmlHint")}</p><p className="lab-caption">{t("categoryHint")}</p><div className="lab-categories">{data.banking.categories.map(c=><button key={c.id} onClick={()=>ask(`${t("category")}: ${c.id} ${c.counterparty}. ${t("categoryHint")}`)}><span>{c.counterparty}</span><Badge>{c.category}</Badge></button>)}</div></section>
    </>:null}
    {data&&view==="operations"?<>
      <div className="lab-metrics"><Metric label={t("database")} value={t(data.persistent?"connected":"notConfigured")} detail="PostgreSQL"/><Metric label={t("rateLimits")} value={data.limits}/><Metric label={t("storage")} value={data.documentPipeline.storage}/></div>
      <section className="lab-ops-grid">{[[Database,"migration","flyway"],[ShieldCheck,"security","securityHint"],[Layers3,"backups","backupHint"],[GitBranch,"telemetry","telemetryHint"]].map(([Icon,title,body])=>{const Symbol=Icon as typeof Database;return <article className="surface lab-section" key={String(title)}><Symbol size={25}/><h3>{t(String(title))}</h3><p className="lab-caption">{t(String(body))}</p></article>;})}</section>
      <section className="surface lab-section"><h3>{t("metrics")}</h3><p className="lab-caption">{t("prometheus")}</p><code>/actuator/prometheus</code></section><AgentRuns data={data} locale={locale}/>
      <section className="surface lab-section"><h3>{t("recentActivity")}</h3>{data.reviews.length?data.reviews.map(r=><article key={r.id} className="lab-reconcile"><div><strong>{r.id}</strong><p>{r.note}</p><small>{date(r.time)} · {r.actor}</small></div><Badge tone="good">{r.state}</Badge></article>):<p className="lab-empty">{t("empty")}</p>}</section>
    </>:null}
  </div>;
}

function AgentRuns({data,locale}:{data:PlatformData;locale:string}) {
  const t=platformText(locale);
  return <section className="surface lab-section"><h3>{t("runs")}</h3><p className="lab-caption">{t("supportHint")}</p>{data.runs.length?<div className="lab-run-list">{data.runs.slice(0,8).map(run=><details key={run.id}><summary><GitBranch size={17}/><strong>{t(run.specialist)}</strong><span>{run.mode}</span><span>{run.durationMs} ms</span><Badge tone={run.quality.requiresReview?"warn":"good"}>{t("support")}: {percent(run.quality.lexicalSupport)}</Badge></summary><div><code>{run.id}</code><p>{t("sourceIds")}: {run.quality.validCitations.join(", ")||"—"}</p>{run.quality.invalidCitations.length?<p className="notice-error">{t("reviewRequired")}: {run.quality.invalidCitations.join(", ")}</p>:null}<ol>{run.steps.map(s=><li key={s.agent}>{t(s.agent)} · {s.tools.join(", ")}</li>)}</ol></div></details>)}</div>:<p className="lab-empty">{t("noRuns")}</p>}</section>;
}
