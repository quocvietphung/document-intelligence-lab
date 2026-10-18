"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowUpRight,Download,FileStack,RefreshCw,ShieldCheck,Upload} from 'lucide-react';
import {useAuth} from '@/components/auth/KeycloakProvider';
import {batchItemState,batchListSchema,batchSchema,batchText,extractionProfiles,validateBatchFiles,type DocumentBatch,type ExtractionProfile} from '@/lib/document-batches';
import {workspaceText} from '@/lib/workspace-language';
import {ModalSurface} from './ModalSurface';
import {downloadJson} from '@/lib/browser-download';
import {activeDocumentJob} from '@/lib/document-results';

export function DocumentBatches({caseId,locale,azure,provider,canWrite,inspect,changed}:{caseId:string;locale:string;azure:boolean;provider:string;canWrite:boolean;inspect:(id:string)=>void;changed:()=>Promise<void>}){
  const auth=useAuth(),t=batchText(locale),fields=workspaceText(locale),root=`/api/cases/${encodeURIComponent(caseId)}/platform/batches`;
  const [batches,setBatches]=useState<DocumentBatch[]>([]),[files,setFiles]=useState<File[]>([]),[name,setName]=useState(t.defaultName),[source,setSource]=useState(t.defaultSource),[profile,setProfile]=useState<ExtractionProfile>('general');
  const [error,setError]=useState<keyof typeof t>(),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[saved,setSaved]=useState(false),[loading,setLoading]=useState(true);
  const input=useRef<HTMLInputElement>(null),requestId=useRef<string|undefined>(undefined),inFlight=useRef(false),seen=useRef(new Set<string>()),loadSequence=useRef(0);
  const load=useCallback(async(signal?:AbortSignal)=>{
    if(!auth.token)return;
    const sequence=++loadSequence.current;
    const current=()=>!signal?.aborted&&sequence===loadSequence.current;
    try{const r=await fetch(root,{headers:{Authorization:`Bearer ${auth.token}`},cache:'no-store',signal});if(!r.ok)throw Error();const result=batchListSchema.parse(await r.json());if(current()){setBatches(result.batches);setError(previous=>previous==='error'?undefined:previous);}}
    catch{if(current())setError('error');}finally{if(current())setLoading(false);}
  },[root,auth.token]);
  useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>void load(controller.signal),0);return()=>{clearTimeout(timer);controller.abort();};},[load]);
  const active=batches.some(b=>b.state==='SUBMITTING'||b.items.some(activeDocumentJob));
  useEffect(()=>{if(!active)return;const controller=new AbortController();const timer=setInterval(()=>{if(!document.hidden)void load(controller.signal);},4000);return()=>{clearInterval(timer);controller.abort();};},[active,load]);
  useEffect(()=>{const complete=batches.flatMap(b=>b.items).filter(i=>i.status==='COMPLETE'&&i.documentId);if(complete.some(i=>!seen.current.has(i.jobId!))){complete.forEach(i=>seen.current.add(i.jobId!));void changed();}},[batches,changed]);
  const profileHint=profile==='general'?t.generalHint:profile==='invoice'?t.invoiceHint:profile==='payroll'?t.payrollHint:t.insuranceHint;
  function resetRequest(){requestId.current=undefined;setSaved(false);setError(undefined);}
  function review(event:FormEvent){event.preventDefault();const issue=validateBatchFiles(files,azure);if(issue){setError(issue);return;}setError(undefined);setConfirm(true);}
  async function submit(){
    if(inFlight.current||!auth.token)return;inFlight.current=true;setBusy(true);setError(undefined);
    requestId.current??=crypto.randomUUID();const form=new FormData();files.forEach(file=>form.append('files',file));form.set('requestId',requestId.current);form.set('name',name.trim());form.set('source',source.trim());form.set('profile',profile);
    try{const r=await fetch(root,{method:'POST',headers:{Authorization:`Bearer ${auth.token}`},body:form});if(!r.ok)throw Error(r.status===429?'limit':'error');const result=batchSchema.parse(await r.json());setBatches(old=>[result,...old.filter(b=>b.id!==result.id)]);setConfirm(false);setSaved(true);setFiles([]);requestId.current=undefined;await load();}
    catch(e){setError(e instanceof Error&&e.message==='limit'?'limit':'error');}finally{setBusy(false);inFlight.current=false;}
  }
  function download(batch:DocumentBatch){
    const {id,name,source,profile,time,state,items,manifestHash}=batch;
    downloadJson({schemaVersion:'document-intake-v1',id,name,source,profile,time,state,items,manifestHash,adfConnected:false,includesExtractedText:false},`${id}.json`);
  }
  return <section className="batch-workspace" aria-labelledby="batch-title">
    <header className="pipeline-control-heading"><div><span className="eyebrow"><FileStack size={15}/> {caseId}</span><h2 id="batch-title">{t.title}</h2><p>{t.hint}</p></div><span className="lab-badge">Java · PostgreSQL</span></header>
    <form onSubmit={review} className="surface batch-intake"><fieldset disabled={busy||!canWrite}>
      <div className="batch-form-grid"><label>{t.name}<input required maxLength={100} value={name} onChange={e=>{resetRequest();setName(e.target.value);}}/></label><label>{t.source}<input required maxLength={160} value={source} onChange={e=>{resetRequest();setSource(e.target.value);}}/></label><label>{t.profile}<select value={profile} onChange={e=>{resetRequest();setProfile(e.target.value as ExtractionProfile);}}>{extractionProfiles.map(p=><option key={p} value={p}>{t[p]}</option>)}</select></label></div>
      <div className="batch-profile-hint"><strong>{t[profile]} · {t.profileVersion}</strong><p>{profileHint}</p><small>{t.profileHint}</small></div>
      <input ref={input} type="file" multiple accept={azure?'.pdf,.png,.jpg,.jpeg':'.pdf,.png,.jpg,.jpeg,.txt'} className="hidden" onChange={e=>{resetRequest();const next=Array.from(e.target.files||[]);e.target.value='';setFiles(next);const issue=validateBatchFiles(next,azure);if(issue)setError(issue);}}/>
      <div className="batch-actions"><button type="button" className="button-secondary" onClick={()=>input.current?.click()}><Upload size={16}/>{t.choose}</button><button className="button-primary" disabled={!files.length||!name.trim()||!source.trim()||!!validateBatchFiles(files,azure)}>{t.submit}<ArrowUpRight size={16}/></button></div>
      {files.length?<ul className="batch-selected" aria-label={t.selected}>{files.map((file,i)=><li key={`${file.name}:${i}`}><span>{file.name}</span><small>{(file.size/1000).toFixed(0)} KB</small></li>)}</ul>:null}
      <p className="lab-caption">{t.provider}: {provider} · {t.scan}</p>
    </fieldset></form>
    {error?<p className="notice-error" role="alert">{t[error]}</p>:null}{saved?<p className="notice-success" role="status">{t.recorded}</p>:null}
    <div className="batch-history-heading"><div><h3>{t.history}</h3><p className="lab-caption">{t.scope}</p></div><button className="button-secondary" disabled={busy} onClick={()=>{setError(undefined);void load();}}><RefreshCw size={16}/>{t.refresh}</button></div>
    {loading?<p role="status">{t.loading}</p>:!batches.length?<div className="lab-empty"><FileStack size={28}/><p>{t.empty}</p></div>:null}
    <div className="batch-history">{batches.map(batch=><article className="surface batch-receipt" key={batch.id}><header><div><h3>{batch.name}</h3><p>{batch.source} · {t[batch.profile]}</p><small>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(batch.time))}</small></div><button className="button-secondary" onClick={()=>download(batch)}><Download size={15}/>{t.download}</button></header>
      <p className="lab-caption">{batch.state==='INTERRUPTED'?t.interrupted:batch.state==='SUBMITTING'?t.waiting:t.submitted}</p>
      <ul>{batch.items.map((item,i)=><li key={`${item.sha256}:${i}`}><div><strong>{item.name}</strong><span className={`lab-badge lab-badge-${item.state==='REJECTED'||item.status==='FAILED'?'warn':item.status==='COMPLETE'?'good':'neutral'}`}>{batchItemState(item,locale)}</span><details><summary>{t.hash}</summary><code>{item.sha256}</code>{item.errorCode?<code>{item.errorCode}</code>:null}</details>{item.profileMismatch?<p className="notice-error">{t.mismatch}</p>:null}{item.missingFields?.length?<p className="lab-caption">{t.missing}: {item.missingFields.map(f=>fields(f)).join(', ')}</p>:null}</div>{item.documentId&&item.status==='COMPLETE'?<button className="button-primary" onClick={()=>inspect(item.documentId!)}>{t.result}<ArrowUpRight size={15}/></button>:null}</li>)}</ul>
    </article>)}</div>
    <p className="pipeline-safety"><ShieldCheck size={16}/>{t.cloud} {t.noInference}</p>
    <p className="lab-caption">{t.private}</p>
    {confirm?<ModalSurface title={t.confirm} label={t.cancel} close={()=>{if(!busy)setConfirm(false);}}><p>{t.consent}</p><p className="lab-caption">{t.provider}: {provider} · {t[profile]}</p><ul className="batch-selected">{files.map((file,i)=><li key={i}>{file.name}</li>)}</ul>{error?<p className="notice-error" role="alert">{t[error]}</p>:null}<div className="batch-actions"><button className="button-secondary" disabled={busy} onClick={()=>setConfirm(false)}>{t.cancel}</button><button className="button-primary" disabled={busy} onClick={()=>void submit()}>{busy?t.loading:t.confirm}</button></div></ModalSurface>:null}
  </section>;
}
