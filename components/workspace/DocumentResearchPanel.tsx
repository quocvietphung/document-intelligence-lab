"use client";

import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowUpRight,CheckCircle2,Download,FileCheck2,FlaskConical,Plus,RefreshCw,Trash2} from 'lucide-react';
import {useAuth} from '@/components/auth/KeycloakProvider';
import {datasetIsCurrent,runsForReference,documentResearchSchema,referenceExportLines,researchMetricValue,researchRowNeedsReview,researchText,type DocumentResearchData,type ReferenceField,type ReferenceQuestion} from '@/lib/document-research';
import {downloadBlob,downloadJson} from '@/lib/browser-download';
import {ResearchConnections} from './ResearchConnections';
import {LocalDataPipelinePanel} from './LocalDataPipelinePanel';
import {DocumentAnalyticsPanel} from './DocumentAnalyticsPanel';
import {RagPdfSources} from './RagPdfSources';
import {DocumentClassificationPanel} from './DocumentClassificationPanel';

type Props={caseId:string;caseVersion:number;locale:string;view:'experiments'|'assets';inspect:(id:string,page?:number)=>void};
export function DocumentResearchPanel({caseId,caseVersion,locale,view,inspect}:Props) {
  const auth=useAuth(),t=researchText(locale),root=`/api/cases/${caseId}/platform/research`;
  const [analyticsVersion,setAnalyticsVersion]=useState(0);
  const etlComplete=useCallback(()=>setAnalyticsVersion(version=>version+1),[]);
  const [data,setData]=useState<DocumentResearchData>(),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [panel,setPanel]=useState<'datasets'|'results'>('datasets'),[name,setName]=useState(''),[fields,setFields]=useState<ReferenceField[]>([]),[questions,setQuestions]=useState<ReferenceQuestion[]>([]);
  const [selectedDoc,setSelectedDoc]=useState(''),[selectedPage,setSelectedPage]=useState(1),[field,setField]=useState(''),[expected,setExpected]=useState(''),[question,setQuestion]=useState('');
  const [relevant,setRelevant]=useState<{documentId:string;page:number}[]>([]),[answerable,setAnswerable]=useState(true),[split,setSplit]=useState<'tune'|'holdout'|'unassigned'>('unassigned');
  const [checked,setChecked]=useState(false),[exportConsent,setExportConsent]=useState(false),[datasetId,setDatasetId]=useState(''),[saved,setSaved]=useState(false);
  const sequence=useRef(0),inFlight=useRef(false);
  const writable=auth.mode!=='demo'&&auth.authenticated&&auth.roles.some(r=>['ADVISOR','REVIEWER','ADMIN'].includes(r));
  const failure=(status:number)=>status===409?'conflict':status===401||status===403?'unauthorized':status===429?'limit':'error';
  const load=useCallback(async(signal?:AbortSignal)=>{
    const request=++sequence.current;
    try {
      if(!auth.token)throw new Error('unauthorized');
      const response=await fetch(root,{headers:{Authorization:`Bearer ${auth.token}`},cache:'no-store',signal});
      if(!response.ok)throw new Error(failure(response.status));
      const next=documentResearchSchema.parse(await response.json());
      if(next.caseId!==caseId||next.caseVersion!==caseVersion)throw new Error('conflict');
      if(!signal?.aborted&&request===sequence.current){setData(next);setError('');}
    }catch(e){if(!signal?.aborted&&request===sequence.current){setData(undefined);setError(e instanceof Error&&['conflict','unauthorized','limit'].includes(e.message)?e.message:'error');}}
    finally{if(!signal?.aborted&&request===sequence.current)setLoading(false);}
  },[root,auth.token,caseId,caseVersion]);
  useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>void load(controller.signal),0);return()=>{clearTimeout(timer);controller.abort();};},[load]);
  const pending=data?.jobs.some(j=>j.status==='QUEUED'||j.status==='RUNNING');
  useEffect(()=>{if(!pending)return;const controller=new AbortController();const timer=setInterval(()=>void load(controller.signal),2500);return()=>{clearInterval(timer);controller.abort();};},[pending,load]);
  const doc=data?.documents.find(d=>d.id===(selectedDoc||data.documents[0]?.id));
  const page=doc?.pages.includes(selectedPage)?selectedPage:doc?.pages[0]||1;
  const selected=data?.datasets.find(d=>d.id===(datasetId||data.datasets[0]?.id));
  const visibleRuns=runsForReference(data?.runs||[],selected?.id);
  async function action(path:string,body:unknown) {
    const response=await fetch(root+path,{method:'POST',headers:{Authorization:`Bearer ${auth.token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!response.ok)throw new Error(failure(response.status));return response.json();
  }
  async function execute(task:()=>Promise<void>) {
    if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setSaved(false);
    try{await task();}catch(e){setError(e instanceof Error&&['conflict','unauthorized','limit'].includes(e.message)?e.message:'error');}finally{inFlight.current=false;setBusy(false);}
  }
  function addField(event:FormEvent) {
    event.preventDefault();if(!doc||!field.trim()||!expected.trim()||fields.length>=100)return;
    if(fields.some(f=>f.documentId===doc.id&&f.page===page&&f.field.toLowerCase()===field.trim().toLowerCase()))return;
    setFields(v=>[...v,{documentId:doc.id,page,field:field.trim(),expected:expected.trim()}]);setField('');setExpected('');setChecked(false);
  }
  function addQuestion(event:FormEvent) {
    event.preventDefault();if(!doc||!question.trim()||questions.length>=100||questions.some(q=>q.question.trim().toLowerCase()===question.trim().toLowerCase()))return;
    const targets=answerable?(relevant.length?relevant:[{documentId:doc.id,page}]):[];
    setQuestions(v=>[...v,{documentId:targets[0]?.documentId||'',page:targets[0]?.page||0,question:question.trim(),relevant:targets,answerable,split}]);setQuestion('');setRelevant([]);setChecked(false);
  }
  function save() {void execute(async()=>{
    const result=await action('/datasets',{caseVersion,name:name.trim(),fields,questions,sourceChecked:checked});
    setDatasetId(result.id);setFields([]);setQuestions([]);setChecked(false);setName('');setSaved(true);await load();
  });}
  function run(suite:'EXTRACTION'|'RETRIEVAL'|'CHUNKING'|'PROMPTING') {if(!selected)return;void execute(async()=>{await action('/runs',{caseVersion,datasetId:selected.id,suite});setPanel('results');await load();});}
  function download(jsonl=false) {void execute(async()=>{
    const bundle=await action('/export',{caseVersion});
    const filename=`document-research-${caseId}.${jsonl?'jsonl':'json'}`;
    if(jsonl) downloadBlob(new Blob([referenceExportLines(bundle)],{type:'application/x-ndjson'}),filename);
    else downloadJson(bundle,filename);
    await load();
  });}
  const date=(value:string)=>new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  return <section className="source-research-workbench">
    <header className="workspace-view-toolbar"><div><h2>{t(view==='experiments'?'title':'assetsTitle')}</h2><p>{t(view==='experiments'?'hint':'assetsHint')}</p></div><button className="button-secondary" disabled={busy||loading} onClick={()=>{setError('');void load();}}><RefreshCw size={16}/>{locale==='vi'?'Tải lại':locale==='de'?'Aktualisieren':'Refresh'}</button></header>
    {loading?<p role="status">{t('loading')}</p>:null}{error?<p className="notice-error" role="alert">{t(error)}</p>:null}{saved?<p className="notice-success" role="status">{t('saved')}</p>:null}
    {data? <>
      {view==='experiments'?data.jobs.filter(j=>j.status!=='COMPLETE').slice(0,5).map(job=><p className={job.status==='FAILED'?'notice-error':'notice-lab'} role="status" key={job.id}>{t(job.status)} · {t(job.suite)}{job.errorCode?` · ${t(job.errorCode)}`:''}</p>):null}
      {!data.documents.length?<div className="surface lab-empty"><FileCheck2 size={30}/><p>{t('noDocuments')}</p><a className="button-primary" href={`?case=${encodeURIComponent(caseId)}#documents`}>{t('documents')}<ArrowUpRight size={16}/></a></div>:null}
      {view==='experiments'? <>
        <DocumentClassificationPanel key={`classification:${caseId}:${caseVersion}`} caseId={caseId} caseVersion={caseVersion} locale={locale}/>
        <RagPdfSources locale={locale} documents={data.documents} inspect={inspect}/>
        <div className="research-tabs" aria-label={t('experiments')}>{(['datasets','results'] as const).map(id=><button key={id} data-page-tour={id==='datasets'?'experiments-labels':'experiments-results'} className={panel===id?'selected':''} aria-pressed={panel===id} onClick={()=>setPanel(id)}>{t(id)}<span>{id==='datasets'?data.datasets.length:visibleRuns.length}</span></button>)}</div>
        {panel==='datasets'&&data.documents.length? <section className="surface lab-section research-reference">
          <div className="lab-section-heading"><h2>{t('newDataset')}</h2><span className="lab-badge"><FileCheck2 size={13}/>{t('labelFlow')}</span></div>
          <label className="research-name">{t('name')}<input maxLength={100} value={name} placeholder={t('nameHint')} onChange={e=>setName(e.target.value)} disabled={busy}/></label>
          <div className="research-source-picker"><label>{t('document')}<select value={doc?.id||''} onChange={e=>{setSelectedDoc(e.target.value);setSelectedPage(1);}} disabled={busy}>{data.documents.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>{t('page')}<select value={page} onChange={e=>setSelectedPage(Number(e.target.value))} disabled={busy}>{doc?.pages.map(p=><option key={p}>{p}</option>)}</select></label><button type="button" className="button-secondary" disabled={!doc} onClick={()=>doc&&inspect(doc.id,page)}><FileCheck2 size={16}/>{t('open')}</button></div>
          <div className="research-label-forms">
            <form onSubmit={addField}><h3>{t('addField')}</h3><p>{t('fieldHint')}</p><label>{t('field')}<input list="research-field-keys" maxLength={120} value={field} onChange={e=>setField(e.target.value)} required disabled={busy}/></label><datalist id="research-field-keys">{doc?.fields.map(key=><option key={key} value={key}/>)}</datalist><label>{t('expected')}<input value={expected} maxLength={1000} onChange={e=>setExpected(e.target.value)} required disabled={busy}/></label><button className="button-secondary" disabled={busy||!writable||!field.trim()||!expected.trim()||fields.length>=100}><Plus size={16}/>{t('addField')}</button></form>
            <form onSubmit={addQuestion}><h3>{t('addQuestion')}</h3><p>{t('questionHint')}</p><label>{t('question')}<textarea value={question} maxLength={1000} rows={3} onChange={e=>setQuestion(e.target.value)} required disabled={busy}/></label><label className="research-consent"><input type="checkbox" checked={answerable} onChange={e=>{setAnswerable(e.target.checked);setRelevant([]);}} disabled={busy}/>{t('answerable')}</label><label>{t('split')}<select value={split} onChange={e=>setSplit(e.target.value as typeof split)} disabled={busy}>{(['unassigned','tune','holdout'] as const).map(value=><option key={value} value={value}>{t(value)}</option>)}</select></label>{answerable?<><button type="button" className="button-secondary" disabled={busy||!doc||relevant.length>=8} onClick={()=>{if(doc&&!relevant.some(r=>r.documentId===doc.id&&r.page===page))setRelevant(v=>[...v,{documentId:doc.id,page}]);}}>{t('addRelevant')}</button><ul>{relevant.map((r,i)=><li key={`${r.documentId}:${r.page}`}>{data.documents.find(d=>d.id===r.documentId)?.name} · {t('page')} {r.page}<button type="button" className="button-link" onClick={()=>setRelevant(v=>v.filter((_,n)=>n!==i))}>{t('remove')}</button></li>)}</ul></>:<p>{t('unanswered')}</p>}<button className="button-secondary" disabled={busy||!writable||!question.trim()||questions.length>=100}><Plus size={16}/>{t('addQuestion')}</button></form>
          </div>
          <ul className="research-label-list">{fields.map((f,i)=><li key={`${f.documentId}:${f.page}:${f.field}`}><span><strong>{f.field}</strong> → {f.expected}<small>{data.documents.find(d=>d.id===f.documentId)?.name} · {t('page')} {f.page}</small></span><button className="icon-button" disabled={busy} aria-label={`${t('remove')}: ${f.field}`} onClick={()=>{setFields(v=>v.filter((_,n)=>n!==i));setChecked(false);}}><Trash2 size={16}/></button></li>)}{questions.map((q,i)=><li key={q.question}><span>{q.question}<small>{q.answerable===false?t('unanswered'):`${data.documents.find(d=>d.id===q.documentId)?.name} · ${t('page')} ${q.page}`}</small></span><button className="icon-button" disabled={busy} aria-label={`${t('remove')}: ${q.question}`} onClick={()=>{setQuestions(v=>v.filter((_,n)=>n!==i));setChecked(false);}}><Trash2 size={16}/></button></li>)}</ul>
          <label className="research-consent"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} disabled={busy}/>{t('checked')}</label><button className="button-primary" disabled={busy||!writable||!checked||!name.trim()||!fields.length&&!questions.length} onClick={save}><CheckCircle2 size={16}/>{t('save')}</button>
        </section>:null}
        <section data-page-tour="experiments-run" className="surface lab-section"><h2>{t('datasets')}</h2>{data.datasets.length?<><label className="research-name">{t('version')}<select value={selected?.id||''} onChange={e=>setDatasetId(e.target.value)} disabled={busy}>{data.datasets.map(d=><option key={d.id} value={d.id}>{d.name} · {date(d.time)}</option>)}</select></label>{selected&&!datasetIsCurrent(selected,data.sourceHash)?<p className="notice-lab">{t('stale')}</p>:null}<div className="research-actions"><button className="button-primary" disabled={busy||!writable||!selected?.fields.length||!datasetIsCurrent(selected,data.sourceHash)} onClick={()=>run('EXTRACTION')}><FlaskConical size={16}/>{t('extraction')}</button><button className="button-secondary" disabled={busy||!writable||!selected?.questions.length||!datasetIsCurrent(selected,data.sourceHash)} onClick={()=>run('RETRIEVAL')}>{t('retrieval')}</button></div>{selected?<details className="research-reference-details"><summary>{selected.fields.length} {t('field')} · {selected.questions.length} {t('question')}</summary><ul>{selected.fields.map(f=><li key={`${f.documentId}:${f.page}:${f.field}`}><button className="button-link" onClick={()=>inspect(f.documentId,f.page)}>{f.field} → {f.expected} · {t('page')} {f.page}</button></li>)}{selected.questions.map(q=><li key={q.question}><button className="button-link" disabled={q.answerable===false} onClick={()=>inspect(q.documentId,q.page)}>{q.question} · {q.answerable===false?t('unanswered'):`${t('page')} ${q.page}`} · {t(q.split||'unassigned')}</button></li>)}</ul></details>:null}</>:<p className="lab-caption">{t('empty')}</p>}<p className="research-method-note">{t('notJudge')}</p></section>
        <section className="surface lab-section">
          <h2>{t('CHUNKING')} / {t('PROMPTING')}</h2>
          <p className="lab-caption">{locale==='vi'?'Ví dụ: kaggle-invoice-51109301.pdf — gắn nhãn invoiceNumber = 51109301, trang 1. Hoặc dùng câu hỏi về POLICY COVERAGE PERIOD trên PDF Shelter, trang trích đoạn 1. Tự đối chiếu PDF trước; không sao chép dự đoán làm nhãn chuẩn.':locale==='de'?'Beispiel: kaggle-invoice-51109301.pdf — invoiceNumber = 51109301, Seite 1 prüfen. Alternativ eine Frage zu POLICY COVERAGE PERIOD in Shelter, Auszugsseite 1. Sollwerte unabhängig im PDF prüfen, nicht aus Vorhersagen kopieren.':'PDF exercise: kaggle-invoice-51109301.pdf — independently check invoiceNumber = 51109301 on page 1. For chunking, label a question about POLICY COVERAGE PERIOD on Shelter excerpt page 1. Do not copy predictions as ground truth.'}</p>
          <div className="research-actions">
            <button className="button-secondary" disabled={busy||pending||!writable||!selected?.questions.length||!datasetIsCurrent(selected,data.sourceHash)} onClick={()=>run('CHUNKING')}>{t('CHUNKING')}</button>
            <button className="button-secondary" disabled={busy||pending||!writable||!selected?.fields.length||!datasetIsCurrent(selected,data.sourceHash)} onClick={()=>run('PROMPTING')}>{t('PROMPTING')}</button>
          </div>
        </section>
        <div>{panel==='results'?(visibleRuns.length?visibleRuns.map(result=><article className="surface lab-section research-result" key={result.id}>
          <div className="lab-section-heading"><div><span className="eyebrow">{t(result.suite)}</span><h2>{result.datasetName}</h2><small>{date(result.time)} · {result.durationMs} ms · {result.methodVersion} · {t('localCalls')}: {result.localModelCalls??0}</small></div><span className="lab-badge">v{result.caseVersion}</span></div>
          {!datasetIsCurrent(result,data.sourceHash)?<p className="notice-lab">{t('stale')}</p>:null}
          {result.variants.some(v=>(v.metrics.unanswerableQuestions??0)>0)?<p className="lab-caption">{t('unanswered')} · {t('ANSWERABILITY_NOT_EVALUATED')}</p>:null}
          {result.variants.map(v=><div className="source-research-variant" key={v.method}>
            <h3>{t(v.method)} · {v.samples} {t('samples')}</h3>
            {v.chunks!==undefined?<p className="lab-caption">{t('chunks')}: {v.chunks} · {t('averageCharacters')}: {v.averageCharacters}</p>:null}
            {v.durationMs!==undefined?<p className="lab-caption">{v.durationMs} ms</p>:null}
            <div className="research-metrics">{Object.entries(v.metrics).map(([key,value])=><div key={key}><span>{t(key)}</span><strong>{researchMetricValue(key,value)}</strong></div>)}</div>
            {v.groups?.filter(g=>g.split!=='unassigned').map(group=><details key={group.split}><summary>{t(group.split)}</summary><div className="research-metrics">{Object.entries(group.metrics).map(([key,value])=><div key={key}><span>{t(key)}</span><strong>{researchMetricValue(key,value)}</strong></div>)}</div></details>)}
            <details><summary>{v.rows.filter(researchRowNeedsReview).length} {t('failed')} / {v.rows.filter(r=>r.evaluated!==false).length}</summary><div className="research-result-rows">{v.rows.map((r,i)=><div key={i}>
              <span className={`lab-badge lab-badge-${r.evaluated!==false&&!researchRowNeedsReview(r)?'good':'warn'}`}>{t(r.evaluated===false?'unanswered':researchRowNeedsReview(r)?'failed':'passed')}</span><strong>{r.field||r.question}</strong>
              {r.expected!==undefined?<p>{t('expected')}: {r.expected}<br/>{t('actual')}: {r.actual||'—'}</p>:<p>{t('rank')}: {r.rank||'—'}</p>}
              {r.reason?<p>{t(r.reason)}</p>:null}{r.recallAt5!==undefined&&r.evaluated!==false?<p>{t('recallAt5')}: {researchMetricValue('recallAt5',r.recallAt5)}</p>:null}{(r.relevant||[{documentId:r.documentId,page:r.page}]).filter(source=>source.documentId&&source.page>0).map(source=><button key={`${source.documentId}:${source.page}`} className="button-link" onClick={()=>inspect(source.documentId,source.page)}>{t('open')} · {data.documents.find(d=>d.id===source.documentId)?.name} · {t('page')} {source.page}<ArrowUpRight size={14}/></button>)}
            </div>)}</div></details>
          </div>)}
        </article>):<p className="surface lab-empty">{t('noRuns')}</p>):null}</div>
        <p className="research-method-note">{t('scope')} {data.retrieval.embeddingModel} · {data.retrieval.languageCoverage}</p>
        <ResearchConnections key={`${caseId}:${caseVersion}`} caseId={caseId} caseVersion={caseVersion} locale={locale} section="evaluation" documents={data.documents}/>
      </>: <>
        <LocalDataPipelinePanel key={`${caseId}:${caseVersion}`} caseId={caseId} caseVersion={caseVersion} locale={locale} inspect={inspect} onComplete={etlComplete}/>
        <DocumentAnalyticsPanel key={`analytics:${caseId}:${caseVersion}:${analyticsVersion}`} caseId={caseId} caseVersion={caseVersion} locale={locale} inspect={inspect}/>
        <section className="surface lab-section"><h2>{t('document')}</h2><div className="research-asset-list">{data.documents.map(d=><article key={d.id}><div><strong>{d.name}</strong><small>{d.provider} · {d.model} · {d.pages.length} {t('page')} · {d.tables} {t('tables')}</small></div><button className="button-secondary" onClick={()=>inspect(d.id)}>{t('open')}</button></article>)}</div><details className="research-reference-details"><summary>{t('sourceHash')}</summary><code>{data.sourceHash}</code></details></section>
        <section data-page-tour="pipeline-export" className="surface lab-section"><h2>{t('export')}</h2><p className="lab-caption">{t('exportNote')}</p><label className="research-consent"><input type="checkbox" checked={exportConsent} onChange={e=>setExportConsent(e.target.checked)} disabled={busy}/>{t('exportConsent')}</label><div className="research-actions"><button className="button-primary" disabled={busy||!writable||!data.documents.length||!exportConsent} onClick={()=>download()}><Download size={16}/>{t('export')}</button><button className="button-secondary" disabled={busy||!writable||!exportConsent||!data.datasets.some(d=>datasetIsCurrent(d,data.sourceHash)&&d.questions.length)} onClick={()=>download(true)}><Download size={16}/>{t('jsonl')}</button></div><h3 className="mt-6">{t('history')}</h3>{data.exports.length?<ul className="research-export-history">{data.exports.slice(0,8).map(e=><li key={e.id}>{date(e.time)} · {e.documents} PDF · {e.destination}</li>)}</ul>:<p className="lab-caption">{t('noExports')}</p>}</section>
        <ResearchConnections key={`${caseId}:${caseVersion}`} caseId={caseId} caseVersion={caseVersion} locale={locale} section="sources"/>
      </>}
    </>:null}
  </section>;
}
