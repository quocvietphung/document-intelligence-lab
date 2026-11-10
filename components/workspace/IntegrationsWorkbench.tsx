"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useAuth} from '@/components/auth/KeycloakProvider';
import {downloadJson} from '@/lib/browser-download';
import type {CreditDocument} from '@/lib/credit-data';
import type {WorkspaceTab} from '@/lib/nova-guide';
import {assessmentSchema,checkResultSchema,connectorError,describeAdapter,draftPreviewSchema,draftResultSchema,importable,importResultSchema,integrationsText,labelText,maxImportItems,modeText,
  overviewSchema,previewSchema,selectable,useCaseCatalogSchema,type Assessment,type CheckResult,type DraftPreview,type ImportResult,type Overview,type Preview,type Provider,type UseCaseCatalog} from '@/lib/integrations';

type Props={caseId:string;caseVersion:number;locale:string;documents:readonly CreditDocument[];navigate:(tab:WorkspaceTab)=>void;refreshCase:()=>void};
type Language='en'|'de'|'vi';
class RequestError extends Error{constructor(readonly code:string|undefined){super(code||'REQUEST_FAILED');}}

function Badge({provider,locale}:{provider:Pick<Provider,'label'|'live'|'requiresConnection'>;locale:string}){
  const t=integrationsText(locale);
  return <span className="integration-badges"><span className={`integration-label integration-label-${provider.label}`}>{labelText(t,provider.label)}</span><small>{modeText(t,provider)}</small></span>;
}

export function IntegrationsWorkbench({caseId,caseVersion,locale,documents,navigate,refreshCase}:Props){
  const auth=useAuth(),t=integrationsText(locale),language:Language=locale==='vi'?'vi':locale==='de'?'de':'en';
  const casePath=`/api/cases/${encodeURIComponent(caseId)}/platform`;
  const [overview,setOverview]=useState<Overview>(),[catalog,setCatalog]=useState<UseCaseCatalog>(),[error,setError]=useState(''),[busy,setBusy]=useState('');
  const [sourceId,setSourceId]=useState('local'),[query,setQuery]=useState(''),[preview,setPreview]=useState<Preview>(),[selected,setSelected]=useState<string[]>([]);
  const [profile,setProfile]=useState('general'),[consent,setConsent]=useState(false),[imported,setImported]=useState<ImportResult>();
  const [checks,setChecks]=useState<Record<string,CheckResult>>({}),[csv,setCsv]=useState(''),[assessment,setAssessment]=useState<Assessment>();
  const [draftDoc,setDraftDoc]=useState(''),[draftFields,setDraftFields]=useState<string[]>([]),[recipients,setRecipients]=useState(''),[subject,setSubject]=useState(''),[note,setNote]=useState('');
  const [excerpts,setExcerpts]=useState(false),[draft,setDraft]=useState<DraftPreview>(),[approved,setApproved]=useState(false),[draftDone,setDraftDone]=useState(false);
  const callbackStarted=useRef(false);
  const canWrite=auth.authenticated&&auth.mode!=='demo'&&auth.roles.some(r=>r==='ADVISOR'||r==='ADMIN');

  const request=useCallback(async(path:string,body?:unknown)=>{
    if(!auth.token)throw new RequestError('SESSION_EXPIRED');
    const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${auth.token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},
      body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(60_000)});
    const value:unknown=await response.json().catch(()=>({}));
    if(!response.ok)throw new RequestError(typeof value==='object'&&value&&'error' in value&&typeof value.error==='string'?value.error:undefined);
    return value;
  },[auth.token]);
  const run=useCallback(async(key:string,action:()=>Promise<void>)=>{
    setBusy(key);setError('');
    try{await action();}catch(failure){setError(connectorError(locale,failure instanceof RequestError?failure.code:undefined));}finally{setBusy('');}
  },[locale]);
  const load=useCallback(async()=>{
    const [status,cases]=await Promise.all([request('/api/connectors'),request('/api/connectors/use-cases')]);
    setOverview(overviewSchema.parse(status));setCatalog(useCaseCatalogSchema.parse(cases));
  },[request]);

  useEffect(()=>{
    if(!auth.token)return;
    const timer=window.setTimeout(()=>void run('load',async()=>{
      const params=new URLSearchParams(window.location.search),oauth=params.get('googleOAuth');
      if(oauth&&!callbackStarted.current){
        callbackStarted.current=true;params.delete('googleOAuth');const rest=params.toString();
        window.history.replaceState(null,'',`${window.location.pathname}${rest?`?${rest}`:''}${window.location.hash}`);
        // The authorization code stays in an HttpOnly cookie; the server merges it with this authenticated request.
        if(oauth==='1')await request('/api/connectors/google/callback',{});else throw new RequestError('SCOPE_NOT_GRANTED');
      }
      await load();
    }),0);
    return()=>window.clearTimeout(timer);
  },[auth.token,load,request,run]);

  const providers=overview?.providers??[];
  const sources=providers.filter(p=>p.label!=='future');
  const future=providers.filter(p=>p.label==='future');
  const google=providers.find(p=>p.id==='gmail');
  const reviewed=useMemo(()=>documents.filter(d=>d.status==='verified'&&(d.fields?.length??0)>0),[documents]);
  const draftDocument=reviewed.find(d=>d.id===draftDoc);
  const sample=catalog?.useCases.find(u=>u.id==='project-assessment')?.businessDataSample;

  async function connect(features:string[]){
    await run('connect',async()=>{
      const value=await request('/api/connectors/google/authorize',{features}) as {authorizationUrl?:unknown};
      const url=typeof value.authorizationUrl==='string'?value.authorizationUrl:'';
      if(!url.startsWith('https://accounts.google.com/'))throw new RequestError('OAUTH_STATE_INVALID');
      window.location.assign(url);
    });
  }
  function toggle(id:string){setSelected(current=>current.includes(id)?current.filter(value=>value!==id):current.length>=maxImportItems?current:[...current,id]);}

  return <section className="surface integrations-workbench" aria-labelledby="integrations-title">
    <header className="section-toolbar"><div><h2 id="integrations-title" className="section-heading">{t.title}</h2><p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-600">{t.intro}</p></div>
      <button type="button" className="button-secondary" disabled={!!busy} onClick={()=>void run('load',load)}>{t.refresh}</button></header>
    {error?<p className="notice-error mx-6" role="alert">{error}</p>:null}

    <div className="px-6 py-4" data-page-tour="integrations-providers">
      <h3 className="section-heading">{t.sources}</h3>
      <ul className="integration-grid">{sources.map(p=>{const text=describeAdapter(p,locale);return <li key={p.id} className="integration-card">
        <div className="integration-card-head"><strong>{text.name}</strong><Badge provider={p} locale={locale}/></div>
        <dl className="integration-facts">
          <dt>{t.lastSync}</dt><dd>{p.sync.lastSuccessAt?new Date(p.sync.lastSuccessAt).toLocaleString(locale):t.never}</dd>
          <dt>{t.found} / {t.imported}</dt><dd>{p.sync.found??0} / {p.sync.imported??0}</dd>
          <dt>{t.lastError}</dt><dd>{p.sync.lastError?connectorError(locale,p.sync.lastError):'—'}</dd>
          <dt>{t.permissions}</dt><dd>{text.permissions.join(' · ')}</dd>
          {p.scopes.length?<><dt>{t.scopes}</dt><dd><code>{p.scopes.map(s=>s.replace('https://www.googleapis.com/auth/','')).join(', ')}</code></dd></>:null}
          {p.grantedScopes?.length?<><dt>{t.granted}</dt><dd><code>{p.grantedScopes.map(s=>s.replace('https://www.googleapis.com/auth/','')).join(', ')}</code></dd></>:null}
        </dl>
        <p className="integration-status">{p.enabled?t[`conn_${p.connection}`]:t.disabled}</p>
        {text.note?<p className="text-xs text-slate-500">{text.note}</p>:null}
      </li>;})}</ul>
      {google?.enabled&&canWrite?<div className="integration-actions">
        {google.connection==='CONNECTED'?<button type="button" className="button-secondary" disabled={!!busy} onClick={()=>void run('disconnect',async()=>{await request('/api/connectors/google/disconnect',{});await load();})}>{t.disconnect}</button>
          :<button type="button" className="button-primary" disabled={!!busy} onClick={()=>void connect(['gmail','google-drive'])}>{t.connectGoogle}</button>}
        <button type="button" className="button-secondary" disabled={!!busy} onClick={()=>void connect(['gmail','google-drive','gmail-draft'])}>{t.enableDrafts}</button>
      </div>:null}
    </div>

    <div className="px-6 py-4 integration-flow" data-page-tour="integrations-import">
      <h3 className="section-heading">{t.flow}</h3>
      <ol className="integration-steps">{[t.step1,t.step2,t.step3,t.step4,t.step5,t.step6,t.step7].map(step=><li key={step}>{step}</li>)}</ol>
      <div className="integration-row">
        <label>{t.step1}<select value={sourceId} onChange={e=>{setSourceId(e.target.value);setPreview(undefined);setSelected([]);setImported(undefined);}}>
          {sources.filter(importable).map(p=><option key={p.id} value={p.id}>{describeAdapter(p,locale).name}</option>)}</select></label>
        <label className="integration-query">{t.query}<input value={query} maxLength={200} onChange={e=>setQuery(e.target.value)}/></label>
        <button type="button" className="button-secondary" disabled={!!busy||!sources.some(p=>p.id===sourceId&&importable(p))} onClick={()=>void run('preview',async()=>{
          setPreview(previewSchema.parse(await request(`${casePath}/sources/${encodeURIComponent(sourceId)}/preview`,{query,limit:10})));setSelected([]);setImported(undefined);})}>{t.preview}</button>
      </div>
      {preview?preview.items.length?<ul className="integration-items">{preview.items.map(item=><li key={item.externalId}><label>
        <input type="checkbox" checked={selected.includes(item.externalId)} disabled={!selectable(item)||(!selected.includes(item.externalId)&&selected.length>=maxImportItems)} onChange={()=>toggle(item.externalId)}/>
        <span><strong>{item.name}</strong> <small>{item.metadata.subject||item.metadata.useCase||item.metadata.location||''}</small>
          {item.alreadyImported?<em> · {t.alreadyImported}</em>:!item.canDownload?<em> · {t.notDownloadable}</em>:null}</span></label></li>)}</ul>:<p className="text-sm">{t.noItems}</p>:null}
      {preview&&selected.length?<div className="integration-check">
        <label>{t.profile}<select value={profile} onChange={e=>setProfile(e.target.value)}>{['general','invoice','payroll','insurance-wording'].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
        <label className="integration-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{t.consent}</label>
        <button type="button" className="button-primary" disabled={!!busy||!consent||!canWrite} onClick={()=>void run('import',async()=>{
          setImported(importResultSchema.parse(await request(`${casePath}/sources/${encodeURIComponent(sourceId)}/import`,{requestId:crypto.randomUUID(),caseVersion,externalIds:selected,profile,consent:true})));
          setSelected([]);setConsent(false);refreshCase();})}>{t.importSelected}</button>
      </div>:null}
      {imported?<div className="integration-result" role="status"><ul>{imported.items.map(item=><li key={item.externalId}><strong>{item.name||item.externalId}</strong>: {t[`state_${item.state}`]}{item.code?` · ${connectorError(locale,item.code)}`:''}</li>)}</ul>
        <div className="integration-actions"><button type="button" className="button-secondary" onClick={()=>navigate('pipeline')}>{t.openPipeline}</button><button type="button" className="button-secondary" onClick={()=>navigate('documents')}>{t.openDocuments}</button></div></div>:null}
    </div>

    <div className="px-6 py-4" data-page-tour="integrations-use-cases">
      <h3 className="section-heading">{t.useCases}</h3>
      <ul className="integration-use-cases">{catalog?.useCases.map(useCase=>{const result=checks[useCase.id];return <li key={useCase.id} className="integration-card">
        <div className="integration-card-head"><strong>{useCase.title[language]}</strong><span className="integration-label integration-label-simulated">{t.fictional}</span></div>
        <p className="text-xs">{useCase.summary[language]}</p>
        <p className="text-xs"><strong>{t.answerable}:</strong> {useCase.answerable.question[language]} → <q>{useCase.answerable.answer}</q> ({useCase.answerable.evidence.path.split('/').pop()}, p. {useCase.answerable.evidence.page})</p>
        <p className="text-xs"><strong>{t.unanswerable}:</strong> {useCase.unanswerable.question[language]}</p>
        <p className="text-xs text-slate-500">{useCase.boundary[language]}</p>
        <button type="button" className="button-secondary" disabled={!!busy} onClick={()=>void run(`check-${useCase.id}`,async()=>{const value=checkResultSchema.parse(await request(`${casePath}/use-cases/${useCase.id}/check`,{}));setChecks(current=>({...current,[useCase.id]:value}));})}>{t.runCheck}</button>
        {result?<div className={result.passed?'notice-lab':'notice-error'} role="status"><p>{result.passed?t.passed:t.failed}</p><ul>{result.checks.map(c=><li key={c.check}>{c.passed?'✓':'✗'} {c.check}: {c.actual}</li>)}</ul>
          <p>{result.answerable.evidenceFoundOnCitedPage?`✓ ${t.evidenceFound}`:'✗'}</p><p>{result.unanswerable.mustAbstain?`✓ ${t.mustAbstain}`:'✗'}</p></div>:null}
      </li>;})}</ul>
    </div>

    <div className="px-6 py-4">
      <h3 className="section-heading">{t.assessment}</h3>
      <ul className="integration-future">{(overview?.businessData??[]).filter(d=>d.label!=='future').map(d=>{const text=describeAdapter(d,locale);return <li key={d.id}><strong>{t.businessData}: {text.name}</strong> <Badge provider={d} locale={locale}/>{text.note?<small> — {text.note}</small>:null}</li>;})}</ul>
      <label className="integration-csv">{t.csv}<textarea rows={6} value={csv} maxLength={64_000} onChange={e=>setCsv(e.target.value)} spellCheck={false}/></label>
      <div className="integration-actions">{sample?<button type="button" className="button-secondary" onClick={()=>setCsv(sample)}>{t.useExample}</button>:null}
        <button type="button" className="button-primary" disabled={!!busy||!csv.trim()} onClick={()=>void run('assess',async()=>setAssessment(assessmentSchema.parse(await request(`${casePath}/project-assessment`,{csv}))))}>{t.calculate}</button></div>
      {assessment?<div className="integration-result" role="status">
        <table className="audit-table"><tbody>
          <tr><th>{t.planned}</th><td>{assessment.costs.planned} {assessment.currency}</td></tr><tr><th>{t.forecast}</th><td>{assessment.costs.forecast} {assessment.currency}</td></tr>
          <tr><th>{t.variance}</th><td>{assessment.costs.variance} ({assessment.costs.variancePercent} %)</td></tr>
          <tr><th>{t.perSqm}</th><td>{typeof assessment.costPerSqm==='string'?assessment.costPerSqm:`${assessment.costPerSqm.planned} → ${assessment.costPerSqm.forecast}`}</td></tr>
          {assessment.revenueScenarios.map(s=><tr key={s.name}><th>{t.margin} · {s.name}</th><td>{s.margin} ({s.marginPercent} %)</td></tr>)}
          {assessment.schedule.map(m=><tr key={m.name}><th>{t.delay} · {m.name}</th><td>{m.varianceDays}</td></tr>)}
        </tbody></table>
        <p className={assessment.humanReviewRequired?'notice-error':'notice-lab'}>{assessment.humanReviewRequired?t.reviewRequired:t.noReview}: {assessment.reviewFlags.filter(f=>f.triggered).map(f=>f.code).join(', ')||'—'}</p>
        <p className="text-xs text-slate-500">{assessment.notice}</p></div>:null}
    </div>

    <div className="px-6 py-4">
      <h3 className="section-heading">{t.destinations}</h3>
      <ul className="integration-future">{(overview?.destinations??[]).filter(d=>d.label!=='future').map(d=>{const text=describeAdapter(d,locale);return <li key={d.id}><strong>{text.name}</strong> <Badge provider={d} locale={locale}/>{text.note?<small> — {text.note}</small>:null}</li>;})}</ul>
      <button type="button" className="button-secondary" disabled={!!busy} onClick={()=>void run('report',async()=>downloadJson(await request(`${casePath}/destinations/report`,{}),`document-report-${caseId}.json`))}>{t.report}</button>
      {overview?.destinations.some(d=>d.id==='gmail-draft'&&d.enabled)?<div className="integration-draft">
        <h4>{t.draft}</h4><p className="text-xs">{t.draftWarning}</p>
        {reviewed.length?<>
          <label>{t.document}<select value={draftDoc} onChange={e=>{setDraftDoc(e.target.value);setDraftFields([]);setDraft(undefined);}}><option value="">—</option>{reviewed.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          {draftDocument?<fieldset><legend>{t.fields}</legend>{draftDocument.fields?.map(f=><label key={f.label}><input type="checkbox" checked={draftFields.includes(f.label)}
            onChange={()=>{setDraft(undefined);setDraftFields(current=>current.includes(f.label)?current.filter(v=>v!==f.label):[...current,f.label]);}}/>{f.label}: {f.value}</label>)}</fieldset>:null}
          <label>{t.recipients}<input value={recipients} onChange={e=>{setRecipients(e.target.value);setDraft(undefined);}}/></label>
          <label>{t.subject}<input value={subject} maxLength={150} onChange={e=>{setSubject(e.target.value);setDraft(undefined);}}/></label>
          <label>{t.note}<textarea rows={2} value={note} maxLength={1000} onChange={e=>{setNote(e.target.value);setDraft(undefined);}}/></label>
          <label className="integration-consent"><input type="checkbox" checked={excerpts} onChange={e=>{setExcerpts(e.target.checked);setDraft(undefined);}}/>{t.excerpts}</label>
          <button type="button" className="button-secondary" disabled={!!busy||!draftDocument||!draftFields.length||!subject.trim()} onClick={()=>void run('draft',async()=>{setDraftDone(false);setApproved(false);
            setDraft(draftPreviewSchema.parse(await request(`${casePath}/destinations/gmail-draft/preview`,{documentId:draftDoc,fieldLabels:draftFields,recipients:recipients.split(',').map(r=>r.trim()).filter(Boolean),subject,note,includeEvidenceExcerpts:excerpts})));})}>{t.previewDraft}</button>
          {draft?<div className="integration-result"><pre className="integration-draft-preview">{`To: ${draft.recipients.join(', ')||'—'}\nSubject: ${draft.subject}\n\n${draft.body}`}</pre>
            <label className="integration-consent"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/>{t.approve}</label>
            <button type="button" className="button-primary" disabled={!!busy||!approved} onClick={()=>void run('approve',async()=>{draftResultSchema.parse(await request(`${casePath}/destinations/gmail-draft/approve`,{previewId:draft.previewId,contentHash:draft.contentHash,confirmed:true}));setDraftDone(true);setDraft(undefined);})}>{t.createDraft}</button></div>:null}
          {draftDone?<p className="notice-lab" role="status">{t.draftCreated}</p>:null}
        </>:<p className="text-xs">{t.noReviewed}</p>}
      </div>:null}
    </div>

    <div className="px-6 py-4">
      <h3 className="section-heading">{t.future}</h3>
      <ul className="integration-future">{[...future,...(overview?.businessData??[]),...(overview?.destinations??[])].filter(p=>p.label==='future').map(p=>{const text=describeAdapter(p,locale);return <li key={`${p.kind}-${p.id}`}>
        <strong>{text.name}</strong> <Badge provider={p} locale={locale}/>{text.note?<small> — {text.note}</small>:null}</li>;})}</ul>
    </div>
  </section>;
}
