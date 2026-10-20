"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@/components/auth/KeycloakProvider';
import {connectionsSchema,sourceListSchema,visionResultSchema,integrationText,type Connections,type SourceList} from '@/lib/research-integrations';
import {downloadJson} from '@/lib/browser-download';
import {trustSnapshotSchema} from '@/lib/nova-trust';
import {servicePdfExample} from '@/lib/ai-pdf-examples';
import {AIPdfExample} from './AIPdfExample';

type Props={caseId:string;caseVersion:number;locale:string;section:'sources'|'evaluation'|'monitoring';documents?:readonly {id:string;name:string}[]};
export function ResearchConnections({caseId,caseVersion,locale,section,documents=[]}:Props){
  const auth=useAuth(),t=integrationText(locale),root=`/api/cases/${encodeURIComponent(caseId)}/platform/integrations`;
  const [snapshot,setSnapshot]=useState<Connections>(),[sources,setSources]=useState<SourceList>(),[error,setError]=useState(false),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false),[saved,setSaved]=useState(false);
  const [answers,setAnswers]=useState<{id:string;question:string}[]>([]),[answerId,setAnswerId]=useState(''),[documentId,setDocumentId]=useState(''),[page,setPage]=useState(1),[question,setQuestion]=useState(''),[visionAnswer,setVisionAnswer]=useState('');
  const [profile,setProfile]=useState('general'),inFlight=useRef(false),sequence=useRef(0),active=useRef(true);
  const [visionConsent,setVisionConsent]=useState(false);
  const [answersLoaded,setAnswersLoaded]=useState(false);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  const data=snapshot?.caseId===caseId?snapshot:undefined;
  const configured=(id:string)=>data?.integrations.some(i=>i.id===id&&i.configured)??false;
  const canWrite=auth.authenticated&&auth.mode!=='demo'&&auth.roles.some(r=>r==='ADVISOR'||r==='ADMIN');
  const load=useCallback(async(signal?:AbortSignal)=>{
    const id=++sequence.current;
    try{if(!auth.token)return;const response=await fetch(root,{headers:{Authorization:`Bearer ${auth.token}`},cache:'no-store',signal});if(!response.ok)throw Error();const value=connectionsSchema.parse(await response.json());if(value.caseId!==caseId)throw Error();if(active.current&&!signal?.aborted&&id===sequence.current){setSnapshot(value);setError(false);}}
    catch{if(active.current&&!signal?.aborted&&id===sequence.current)setError(true);}
  },[auth.token,root,caseId]);
  useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>void load(controller.signal),0);return()=>{clearTimeout(timer);controller.abort();};},[load]);
  async function request(path:string,body:unknown={}){
    if(!auth.token)throw Error();
    const response=await fetch(root+path,{method:'POST',headers:{Authorization:`Bearer ${auth.token}`,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw Error();return response.json() as Promise<unknown>;
  }
  async function action(task:()=>Promise<void>){if(inFlight.current)return;inFlight.current=true;setBusy(true);setError(false);setSaved(false);try{await task();}catch{if(active.current)setError(true);}finally{inFlight.current=false;if(active.current)setBusy(false);}}
  const shown=section==='sources'?['blob','adf']:section==='evaluation'?['foundry','nova-local','bge','reranker','paddle','vision']:['monitoring'];
  return <section className="surface lab-section research-connections" aria-label={t.title}>
    <div className="lab-section-heading"><h2>{t[section]}</h2><button type="button" className="button-secondary" disabled={busy} onClick={()=>void load()}>{t.refresh}</button></div>
    <p className="lab-caption">{t.hint}</p>{error?<p role="alert" className="notice-error">{t.error}</p>:null}{saved?<p role="status" className="notice-lab">{t.saved}</p>:null}
    <div className="lab-ops-grid">{data?.integrations.filter(i=>shown.includes(i.id)).map(i=><article key={i.id}><strong>{i.provider}</strong><p className="lab-caption">{i.verification==='SAVED_RESPONSE'?(locale==='vi'?'Đã có phản hồi đã lưu · không phải kiểm định chất lượng':locale==='de'?'Gespeicherte Antwort vorhanden · kein Qualitätsnachweis':'Saved response available · not a quality certification'):i.configured?t.configured:t.off}</p><AIPdfExample example={servicePdfExample(i.id,locale)} locale={locale}/></article>)}</div>
    {section==='sources'?<>
      <button type="button" className="button-secondary" disabled={busy||!configured('blob')} onClick={()=>void action(async()=>{const list=sourceListSchema.parse(await request('/sources'));if(active.current)setSources(list);})}>{busy?t.busy:t.scan}</button>
      {sources?<><label>{t.profile}<select value={profile} onChange={e=>setProfile(e.target.value)} disabled={busy}>{(['general','invoice','payroll','insurance-wording'] as const).map(id=><option key={id} value={id}>{t[id]}</option>)}</select></label><label className="research-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={busy}/>{t.consent}</label>
        {sources.items.length?sources.items.map(source=><article className="lab-reconcile" key={source.name}><span><strong>{source.filename}</strong><small>{source.bytes} bytes</small></span><button type="button" className="button-primary" disabled={busy||!canWrite||!consent} onClick={()=>void action(async()=>{await request('/import',{requestId:crypto.randomUUID(),caseVersion,name:source.name,etag:source.etag,profile,consent});if(active.current){setSaved(true);setConsent(false);}})}>{t.import}</button></article>):<p>{t.empty}</p>}
        <p className="lab-caption">{t.adfHint}</p><button type="button" className="button-secondary" onClick={()=>downloadJson({schemaVersion:'adf-intake-request-v1',requestId:crypto.randomUUID(),caseId,sourcePrefix:sources.prefix},`adf-request-${caseId}.json`)}>{t.adf}</button></>:null}
    </>:null}
    {section==='evaluation'?<>
      <p className="lab-caption">{t.cli}</p><button type="button" className="button-secondary" disabled={busy} onClick={()=>void action(async()=>{const response=await fetch(`/api/cases/${encodeURIComponent(caseId)}/trust`,{headers:{Authorization:`Bearer ${auth.token}`},cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();const result=trustSnapshotSchema.parse(await response.json());if(result.caseId!==caseId)throw Error();if(active.current){setAnswers(result.answers.filter(a=>a.sources.some(s=>s.originalAvailable&&s.kind==='DOCUMENT')).map(a=>({id:a.id,question:a.question})));setAnswerId('');setConsent(false);setAnswersLoaded(true);}})}>{t.loadAnswers}</button>
      {answersLoaded&&!answers.length?<p className="lab-caption">{locale==='vi'?'Chưa có câu trả lời đã lưu gắn với tài liệu gốc. Hỏi Nova về một tài liệu đã phân tích trước.':locale==='de'?'Noch keine gespeicherte Antwort mit Originalquellen. Zuerst Nova zu einem analysierten Dokument befragen.':'No saved answers with original-document sources yet. First ask Nova about an analyzed document.'}</p>:null}
      {answers.length?<><label>{t.answer}<select value={answerId||answers[0]?.id} onChange={e=>setAnswerId(e.target.value)} disabled={busy}>{answers.map(a=><option key={a.id} value={a.id}>{a.question.slice(0,100)}</option>)}</select></label><label className="research-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={busy}/>{t.exportConsent}</label><button type="button" className="button-secondary" disabled={busy||!consent} onClick={()=>void action(async()=>{const result=await request('/evaluation-export',{answerId:answerId||answers[0].id,caseVersion,consent});downloadJson(result,`evaluation-${caseId}.json`);})}>{t.export}</button></>:null}
      <details className="research-reference-details"><summary>{t.vision}</summary><form onSubmit={event=>{event.preventDefault();void action(async()=>{const result=await request('/vision',{documentId:documentId||documents[0]?.id,page,question,caseVersion,consent:visionConsent});const value=visionResultSchema.parse(result);if(active.current)setVisionAnswer(value.answer);});}}>
        <label>{t.document}<select value={documentId||documents[0]?.id||''} onChange={e=>{setDocumentId(e.target.value);setVisionAnswer('');setVisionConsent(false);}} disabled={busy}>{documents.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>{t.page}<input type="number" min={1} max={4} value={page} onChange={e=>{setPage(Number(e.target.value));setVisionAnswer('');setVisionConsent(false);}} disabled={busy}/></label><label>{t.question}<textarea maxLength={2000} required value={question} onChange={e=>setQuestion(e.target.value)} disabled={busy}/></label><label className="research-consent"><input type="checkbox" checked={visionConsent} onChange={e=>setVisionConsent(e.target.checked)} disabled={busy}/>{t.visionConsent}</label><button className="button-primary" disabled={busy||!canWrite||!configured('vision')||!documents.length||!question.trim()||!visionConsent}>{t.ask}</button>
      </form>{visionAnswer?<><p className="notice-lab">{t.notApproved}</p><p className="whitespace-pre-wrap">{visionAnswer}</p></>:null}</details>
    </>:null}
    <details className="research-reference-details"><summary>{t.operator}</summary><p>{t.cli}</p><code>docs/AI_INTEGRATIONS.md</code><p>Docling · PaddleOCR · BGE · Ollama · Azure</p></details>
  </section>;
}
