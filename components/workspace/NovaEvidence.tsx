"use client";
import {useEffect,useRef,useState} from 'react';
import {FileSearch,Flag,ClipboardCheck,RefreshCw} from 'lucide-react';
import {z} from 'zod';
import {useAuth} from '@/components/auth/KeycloakProvider';
import {answerIsStale,requestTrust,type TrustAnswer,type DraftOptions} from '@/lib/nova-trust';
import {trustText} from '@/lib/nova-trust-language';
import {ModalSurface} from './ModalSurface';
import type {EvidenceContext} from '@/lib/evidence-inspection';

function useRequestLifetime(caseId:string,token?:string){
  const lifetime=useRef<AbortController|null>(null);
  useEffect(()=>{const controller=new AbortController();lifetime.current=controller;return()=>controller.abort();},[caseId,token]);
  return lifetime;
}

export function NovaEvidence({answer,locale,caseVersion,openSource}:{answer:TrustAnswer;locale:string;caseVersion:number;openSource:(id:string,context?:EvidenceContext)=>void}) {
  const t=trustText(locale);
  return <div className="nova-evidence">
    {answerIsStale(answer,caseVersion)?<p className="trust-warning">{t.staleAnswer}</p>:null}
    <details><summary><FileSearch size={14}/>{t.evidence} · {answer.claims.length}</summary>
      <p className="trust-muted">{t.evidenceHint}</p>
      {answer.claims.map((claim,index)=><section className="nova-claim" key={index}>
        <span className={claim.state==='SOURCE_LINKED'?'trust-source-label':'trust-warning-label'}>{claim.state==='SOURCE_LINKED'?t.linked:t.needsReview}</span>
        <p>{claim.text}</p>
        {!claim.citations.length?<small>{t.claimSourceMissing}</small>:null}
        {claim.unsupportedMoney?.length?<small className="trust-warning">{locale==='vi'?'Số tiền/tiền tệ chưa khớp trích đoạn nguồn':locale==='de'?'Betrag/Währung im zitierten Auszug nicht bestätigt':'Amount/currency not matched in the cited excerpt'}: {claim.unsupportedMoney.join(', ')}</small>:null}
        {claim.invalidCitations.map(id=><small className="trust-warning" key={id}>{t.unknownSource}: [{id}]</small>)}
        {claim.citations.map(id=>{const source=answer.sources.find(s=>s.id===id);return source?<details key={id} className="nova-claim-source"><summary>{source.title}</summary>
          <p className="trust-muted">{source.kind==='REFERENCE'||source.kind==='FIXTURE'?t.reference:source.humanReviewed?t.verifiedSource:t.unreviewedSource}</p>
          <blockquote>{source.excerpt}</blockquote>
          {source.documentId&&source.originalAvailable?<button type="button" className="button-link" onClick={()=>openSource(source.id,{sourceId:source.id,ocrText:source.excerpt,answerText:claim.text})}><FileSearch size={14}/>{t.viewSource} · {t.page} {source.page||1}</button>:null}
        </details>:null;})}
      </section>)}
    </details>
  </div>;
}

export function NovaAnswerActions({answer,caseId,caseVersion,locale,onDraft,openSource}:{answer:TrustAnswer;caseId:string;caseVersion:number;locale:string;onDraft:(question:string,options:DraftOptions)=>void;openSource:(id:string,context?:EvidenceContext)=>void}) {
  const auth=useAuth(),t=trustText(locale);
  const lifetime=useRequestLifetime(caseId,auth.token);
  const [report,setReport]=useState(false),[task,setTask]=useState(false),[reason,setReason]=useState('UNSUPPORTED_SOURCE'),[note,setNote]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[feedbackId,setFeedbackId]=useState<string>();
  const [requestKey,setRequestKey]=useState(()=>crypto.randomUUID());
  async function save(){if(busy)return;setBusy(true);setError('');const signal=lifetime.current?.signal;try{
    const value=z.object({id:z.uuid()}).parse(await requestTrust(auth.token,caseId,'/feedback',{answerId:answer.id,reason,note,requestId:requestKey,caseVersion},signal));if(!signal?.aborted)setFeedbackId(value.id);
  }catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:'failed');}finally{if(!signal?.aborted)setBusy(false);}}
  async function revise(){if(!feedbackId||busy)return;setBusy(true);setError('');const signal=lifetime.current?.signal;try{
    const value=z.object({question:z.string().max(2000),revisionOf:z.string(),feedbackId:z.uuid(),automaticSend:z.literal(false)}).parse(await requestTrust(auth.token,caseId,'/correction',{answerId:answer.id,feedbackId,locale,caseVersion},signal));if(signal?.aborted)return;
    setReport(false);onDraft(value.question,{revisionOf:value.revisionOf,feedbackId:value.feedbackId,caseVersion});
  }catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:'failed');}finally{if(!signal?.aborted)setBusy(false);}}
  return <>
    <NovaEvidence answer={answer} locale={locale} caseVersion={caseVersion} openSource={openSource}/>
    <div className="nova-answer-actions trust-answer-actions">
      <button type="button" onClick={()=>{setReport(true);setError('');}}><Flag size={14}/>{t.report}</button>
      <button type="button" onClick={()=>setTask(true)}><ClipboardCheck size={14}/>{t.createTask}</button>
    </div>
    {report?<ModalSurface title={t.report} label={t.close} close={()=>{if(!busy)setReport(false);}}>
      <p className="trust-muted">{t.noteHint}</p><blockquote className="trust-answer-preview">{answer.answer.slice(0,700)}</blockquote>
      {feedbackId?<><p className="notice-success" role="status">{t.feedbackSaved}</p><button className="button-primary" type="button" disabled={busy} onClick={()=>void revise()}><RefreshCw size={16}/>{t.prepareCorrection}</button><p className="trust-muted">{t.draftHint}</p></>:<form className="trust-form" onSubmit={event=>{event.preventDefault();void save();}}>
        <label>{t.reason}<select disabled={busy} value={reason} onChange={e=>{setReason(e.target.value);setRequestKey(crypto.randomUUID());}}>{(['WRONG_AMOUNT','WRONG_PERSON','UNSUPPORTED_SOURCE','OTHER'] as const).map(key=><option key={key} value={key}>{t[key]}</option>)}</select></label>
        <label>{t.note}<textarea disabled={busy} maxLength={500} value={note} onChange={e=>{setNote(e.target.value);setRequestKey(crypto.randomUUID());}}/></label>
        <button className="button-primary" disabled={busy}>{busy?t.loading:t.confirm}</button>
      </form>}
      {error?<p className="notice-error" role="alert">{t[error as keyof typeof t]||t.failed}</p>:null}
    </ModalSurface>:null}
    {task?<ReviewerTaskForm caseId={caseId} caseVersion={caseVersion} answerId={answer.id} locale={locale} close={()=>setTask(false)}/>:null}
  </>;
}

export function ReviewerTaskForm({caseId,caseVersion,answerId='',locale,close,onSaved}:{caseId:string;caseVersion:number;answerId?:string;locale:string;close:()=>void;onSaved?:()=>void}) {
  const auth=useAuth(),t=trustText(locale);
  const lifetime=useRequestLifetime(caseId,auth.token);
  const [title,setTitle]=useState(t.createTask),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [requestKey,setRequestKey]=useState(()=>crypto.randomUUID());
  async function save(){if(!title.trim()||!note.trim()||busy)return;setBusy(true);setError('');const signal=lifetime.current?.signal;try{
    await requestTrust(auth.token,caseId,'/tasks',{answerId,title,note,requestId:requestKey,caseVersion},signal);if(!signal?.aborted){onSaved?.();close();}
  }catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:'failed');}finally{if(!signal?.aborted)setBusy(false);}}
  return <ModalSurface title={t.newTask} label={t.close} close={()=>{if(!busy)close();}}><form className="trust-form" onSubmit={e=>{e.preventDefault();void save();}}>
    <p className="notice-lab">{t.taskConfirm}</p>
    <label>{t.taskTitle}<input required disabled={busy} maxLength={160} value={title} onChange={e=>{setTitle(e.target.value);setRequestKey(crypto.randomUUID());}}/></label>
    <label>{t.taskNote}<textarea required disabled={busy} maxLength={500} value={note} onChange={e=>{setNote(e.target.value);setRequestKey(crypto.randomUUID());}}/></label>
    {error?<p className="notice-error" role="alert">{t[error as keyof typeof t]||t.failed}</p>:null}
    <div className="trust-action-row"><button className="button-secondary" type="button" disabled={busy} onClick={close}>{t.cancel}</button><button className="button-primary" disabled={busy}>{busy?t.loading:t.confirm}</button></div>
  </form></ModalSurface>;
}
