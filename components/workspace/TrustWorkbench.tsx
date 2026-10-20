"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import {ShieldCheck,RefreshCw,Sparkles,ClipboardCheck,FileSearch,MessageSquareText} from 'lucide-react';
import {useAuth} from '@/components/auth/KeycloakProvider';
import {trustSnapshotSchema,requestTrust,trustSections,answerIsStale,type TrustSnapshot,type TrustSection,type DraftOptions} from '@/lib/nova-trust';
import {trustText} from '@/lib/nova-trust-language';
import {ModalSurface} from './ModalSurface';
import {NovaAnswerActions,ReviewerTaskForm} from './NovaEvidence';
import {NovaCopyAnswer} from './NovaConversation';
import {workflowPdfExample} from '@/lib/ai-pdf-examples';
import {AIPdfExample} from './AIPdfExample';

export function TrustWorkbench({caseId,caseVersion,locale,onDraft,openSource,initialSection='privacy'}:{caseId:string;caseVersion:number;locale:string;onDraft:(question:string,options:DraftOptions)=>void;openSource:(id:string)=>void;initialSection?:TrustSection}) {
  const auth=useAuth(),t=trustText(locale);
  const [section,setSection]=useState<TrustSection>(initialSection),[data,setData]=useState<TrustSnapshot>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[newTask,setNewTask]=useState(false);
  const lifetime=useRef<AbortController|null>(null),[revision,setRevision]=useState(0);
  const [taskAction,setTaskAction]=useState<{id:string;action:'CLAIM'|'RETURN'|'RESOLVE'|'REOPEN';version:number}>();
  const [feature,setFeature]=useState<TrustSnapshot['features'][number]>(),[note,setNote]=useState('');
  const canReview=auth.roles.some(r=>r==='REVIEWER'||r==='ADMIN'),canAdmin=auth.roles.includes('ADMIN');
  useEffect(()=>{
    const controller=new AbortController();lifetime.current=controller;
    const timer=setTimeout(()=>{setBusy(true);setError('');setData(undefined);void requestTrust(auth.token,caseId,'',undefined,controller.signal).then(value=>{
      const snapshot=trustSnapshotSchema.parse(value);if(snapshot.caseId!==caseId)throw new Error('unavailable');if(!controller.signal.aborted)setData(snapshot);
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'failed');}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});},0);
    return()=>{clearTimeout(timer);controller.abort();};
  },[auth.token,caseId,caseVersion,revision]);
  const reload=useCallback(()=>setRevision(value=>value+1),[]);
  async function mutate(path:string,body:unknown){if(busy)return;setBusy(true);setError('');const signal=lifetime.current?.signal;
    try{const result=await requestTrust(auth.token,caseId,path,body,signal);if(signal?.aborted)return;return result;}
    catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:'failed');throw e;}
    finally{if(!signal?.aborted)setBusy(false);}
  }
  async function taskPrompt(taskId:DraftOptions['taskId']){try{
    const result=z.object({question:z.string().max(2000),automaticSend:z.literal(false)}).parse(await mutate('/prompt',{taskId,locale,caseVersion}));
    onDraft(result.question,{taskId,caseVersion});
  }catch{/* shown inline */}}
  async function saveTaskAction(){if(!taskAction||busy)return;try{await mutate(`/tasks/${encodeURIComponent(taskAction.id)}`,{action:taskAction.action,note,version:taskAction.version,caseVersion});setTaskAction(undefined);setNote('');reload();}catch{/* shown inline */}}
  async function saveFeature(){if(!feature||!note.trim()||busy)return;try{await mutate('/features',{featureId:feature.id,enabled:!feature.enabled,version:feature.controlVersion,caseVersion,note});setFeature(undefined);setNote('');reload();}catch{/* shown inline */}}
  const fmt=(value:string)=>new Date(value).toLocaleString(locale==='vi'?'vi-VN':locale==='de'?'de-DE':'en-GB');
  return <section className="trust-workbench" aria-label={t.title}>
    <header className="trust-heading"><div><span className="eyebrow"><ShieldCheck size={15}/> NOVA TRUST</span><h2>{t.title}</h2><p>{t.intro}</p></div><button className="button-secondary" disabled={busy} onClick={reload}><RefreshCw size={16}/>{t.refresh}</button></header>
    <nav className="trust-tabs" aria-label={t.title}>{trustSections.map(key=><button type="button" key={key} aria-pressed={section===key} onClick={()=>setSection(key)}>{t[key]}</button>)}</nav>
    <p className="trust-boundary">{t.lab}</p>
    {error?<div className="notice-error" role="alert"><p>{t[error as keyof typeof t]||t.failed}</p><button type="button" className="button-link" disabled={busy} onClick={reload}>{t.refresh}</button></div>:null}
    {busy&&!data?<p role="status">{t.loading}</p>:null}
    {data&&section==='privacy'?<div className="trust-grid">
      <article className="trust-card"><ShieldCheck size={22}/><h3>{t.inputs}</h3><p>{t.documentInput}</p><p>{t.chatInput}</p></article>
      <article className="trust-card"><FileSearch size={22}/><h3>{t.storage}</h3><p>{t.savedHistory}</p><p className="trust-muted">{data.privacy.pipeline.storage}</p></article>
      <article className="trust-card"><ClipboardCheck size={22}/><h3>{t.retention}</h3><p>{t.retentionText.replace('{days}',String(data.privacy.pipeline.retentionDays))}</p></article>
      <article className="trust-card"><Sparkles size={22}/><h3>{t.analysisMode}</h3><p>{t.noInference}</p><p>{t.readOnly}</p></article>
    </div>:null}
    {data&&section==='library'?<><p className="notice-lab">{t.draftHint}</p><div className="trust-grid">{data.features.filter(f=>f.id!=='nova').map(f=><article className="trust-card" key={f.id}><Sparkles size={22}/><h3>{t[f.id]}</h3><p>{t.readOnly}</p><AIPdfExample example={workflowPdfExample(f.id,locale)} locale={locale}/><small>{f.enabled&&data.features.find(x=>x.id==='nova')?.enabled?t.enabled:t.disabled}</small><button type="button" className="button-primary" disabled={busy||!f.enabled||!data.features.find(x=>x.id==='nova')?.enabled} onClick={()=>void taskPrompt(f.id as DraftOptions['taskId'])}>{t.draft}</button></article>)}</div></>:null}
    {data&&section==='history'?<><p className="trust-muted">{t.historyHint}</p>{!data.answers.length?<p className="trust-empty">{t.noAnswers}</p>:data.answers.map(answer=><details className="trust-history" key={answer.id}>
      <summary><MessageSquareText size={17}/><span>{answer.question.slice(0,120)}</span><small>{fmt(answer.time)}</small></summary>
      <p className="trust-muted">{answer.mode} · {answer.modelId||'—'} · {t.promptVersion} {answer.promptVersion} · {t.noHumanApproval}</p>
      {answer.revisionOf?<p>{t.revised}: <code>{answer.revisionOf}</code></p>:null}
      {answerIsStale(answer,caseVersion)?<p className="trust-warning">{t.staleAnswer}</p>:null}
      <div className="trust-stored-answer">{answer.answer}</div><NovaCopyAnswer text={answer.answer} locale={locale}/>
      <NovaAnswerActions answer={answer} caseId={caseId} caseVersion={caseVersion} locale={locale} onDraft={onDraft} openSource={openSource}/>
      {data.feedback.some(f=>f.answerId===answer.id)?<details><summary>{t.feedbackHistory}</summary>{data.feedback.filter(f=>f.answerId===answer.id).map(f=><p key={f.id}>{t[f.reason]} · {fmt(f.time)}<br/>{f.note}</p>)}</details>:null}
    </details>)}</>:null}
    {data&&section==='tasks'?<>
      <div className="trust-action-row"><p>{t.taskConfirm}</p><button type="button" className="button-primary" disabled={busy||!data.persistent} onClick={()=>setNewTask(true)}><ClipboardCheck size={16}/>{t.newTask}</button></div>
      {!data.tasks.length?<p className="trust-empty">{t.noTasks}</p>:data.tasks.map(task=><article className="trust-task" key={task.id}>
        <header><h3>{task.title}</h3><span className="trust-source-label">{t[task.state]}</span></header><p>{task.note}</p><small>{fmt(task.time)} · {task.assignedToMe?t.owned:task.assignee?t.assigned:t.unassigned}</small>
        {task.caseVersion!==caseVersion?<p className="trust-warning">{t.taskStale}</p>:null}
        <div className="trust-action-row">{(task.state==='OPEN'||task.state==='RETURNED')?<button type="button" className="button-secondary" disabled={busy||!canReview} onClick={()=>{setTaskAction({id:task.id,action:'CLAIM',version:task.version});setNote('');}}>{t.claim}</button>:null}
          {task.state==='IN_REVIEW'?(['RETURN','RESOLVE'] as const).map(action=><button type="button" className="button-secondary" key={action} disabled={busy||!canReview||(!task.assignedToMe&&!canAdmin)} onClick={()=>{setTaskAction({id:task.id,action,version:task.version});setNote('');}}>{action==='RETURN'?t.return:t.resolve}</button>):null}
          {task.state==='RESOLVED'?<button type="button" className="button-secondary" disabled={busy||!canReview} onClick={()=>{setTaskAction({id:task.id,action:'REOPEN',version:task.version});setNote('');}}>{t.reopen}</button>:null}
        </div>{!canReview?<small>{t.reviewerOnly}</small>:null}
        <details><summary>{t.taskHistory} · {task.history.length}</summary>{task.history.map((step,index)=><p key={index}>{t[step.state as keyof typeof t]||step.state} · {fmt(step.time)}<br/>{step.note}</p>)}</details>
      </article>)}
    </>:null}
    {data&&section==='governance'?<><p className="notice-lab">{t.toggleHint}</p><div className="trust-grid">{data.features.map(f=><article className="trust-card" key={f.id}>
      <h3>{t[f.id]}</h3><span className="trust-source-label">{f.enabled?t.enabled:t.disabled}</span>
      <dl><dt>{t.owner}</dt><dd>{f.owner}</dd><dt>{t.scope}</dt><dd>{caseId}</dd><dt>{t.promptVersion}</dt><dd><code>{f.promptVersion}</code></dd><dt>{t.tests}</dt><dd><code>{f.testSuite}</code></dd></dl>
      <p>Model / deployment: <code>{f.modelId||'—'}</code></p><p>{t.limits}</p><p>{t.readOnly}</p><button type="button" className="button-secondary" disabled={busy||!canAdmin||!data.canManage} onClick={()=>{setFeature(f);setNote('');}}>{t.toggle}</button>
    </article>)}</div><details><summary>{t.featureHistory} · {data.events.length}</summary>{data.events.map((value,index)=>{const event=z.object({id:z.string(),enabled:z.boolean(),note:z.string(),time:z.string()}).safeParse(value);return event.success?<p key={index}>{t[event.data.id as keyof typeof t]||event.data.id} · {event.data.enabled?t.enabled:t.disabled} · {fmt(event.data.time)}<br/>{event.data.note}</p>:null;})}</details></>:null}
    {data&&section==='metrics'?<><p className="trust-muted">{t.window.replace('{count}',String(data.metrics.answerWindow))}</p><div className="trust-grid trust-metrics">
      {[[t.feedbackCount,data.metrics.feedbackWindow],[t.openTasks,data.metrics.openTasks],[t.resolvedTasks,data.metrics.resolvedTasks],[t.unsupported,`${data.metrics.claimsNeedingReview} / ${data.metrics.claimCount}`],[t.p50,data.metrics.answerWindow?`${data.metrics.p50Ms} ms`:'—'],[t.p95,data.metrics.answerWindow?`${data.metrics.p95Ms} ms`:'—'],[locale==='vi'?'Trường được người kiểm duyệt sửa':locale==='de'?'Menschlich geänderte Felder':'Fields changed by reviewers',`${data.metrics.fieldsChanged} / ${data.metrics.fieldsReviewed}`]].map(([label,value])=><article className="trust-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </div><p className="notice-lab">{t.cost}</p><p className="trust-muted">{t.costHint}</p></>:null}
    {newTask?<ReviewerTaskForm caseId={caseId} caseVersion={caseVersion} locale={locale} close={()=>setNewTask(false)} onSaved={reload}/>:null}
    {taskAction?<ModalSurface title={t.tasks} label={t.close} close={()=>{if(!busy)setTaskAction(undefined);}}><form className="trust-form" onSubmit={e=>{e.preventDefault();void saveTaskAction();}}><p>{t.taskConfirm}</p><label>{t.note}<textarea required={taskAction.action!=='CLAIM'} maxLength={500} disabled={busy} value={note} onChange={e=>setNote(e.target.value)}/></label>{error?<p className="notice-error" role="alert">{t[error as keyof typeof t]||t.failed}</p>:null}<button className="button-primary" disabled={busy}>{busy?t.loading:t.confirm}</button></form></ModalSurface>:null}
    {feature?<ModalSurface title={t.toggle} label={t.close} close={()=>{if(!busy)setFeature(undefined);}}><form className="trust-form" onSubmit={e=>{e.preventDefault();void saveFeature();}}><p>{t[feature.id]} → {feature.enabled?t.disabled:t.enabled}</p><p className="notice-lab">{t.toggleHint}</p><label>{t.toggleReason}<textarea required maxLength={300} disabled={busy} value={note} onChange={e=>setNote(e.target.value)}/></label>{error?<p className="notice-error" role="alert">{t[error as keyof typeof t]||t.failed}</p>:null}<button className="button-primary" disabled={busy||!note.trim()}>{busy?t.loading:t.confirm}</button></form></ModalSurface>:null}
  </section>;
}
