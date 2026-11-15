"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import type {CreditDocument} from '@/lib/credit-data';
import type {WorkspaceTab} from '@/lib/nova-guide';
import {connectorError,describeAdapter,importable,importResultSchema,integrationsText,maxImportItems,
  overviewSchema,previewSchema,selectable,visibleDestinations,visibleSources,type ImportResult,type Overview,type Preview,type Provider} from '@/lib/integrations';
import {workspacePageName} from '@/lib/workspace-presentation';
import {workspaceUxText} from '@/lib/workspace-ux';
import {fill,profileOptions,usabilityText} from '@/lib/workspace-usability';
import {ConnectorBadge} from './ConnectorBadge';
import {ConnectorRequestError,useConnectorApi} from './connector-api';

type Props={caseId:string;caseVersion:number;locale:string;documents:readonly CreditDocument[];navigate:(tab:WorkspaceTab)=>void;refreshCase:()=>void};

const shortScope=(scope:string)=>scope.replace('https://www.googleapis.com/auth/','');

/**
 * Sources & integrations: which sources exist, their honest status, the permissions they ask for,
 * and the deliberate preview → select → import flow. Outputs and research tools live elsewhere.
 */
export function IntegrationsWorkbench({caseId,caseVersion,locale,navigate,refreshCase}:Props){
  const {auth,request,run,busy,error,canWrite}=useConnectorApi(locale);
  const t=integrationsText(locale),u=usabilityText(locale),ux=workspaceUxText(locale);
  const page=(tab:WorkspaceTab)=>workspacePageName(locale,tab);
  const casePath=`/api/cases/${encodeURIComponent(caseId)}/platform`;
  const [overview,setOverview]=useState<Overview>();
  const [sourceId,setSourceId]=useState('local'),[query,setQuery]=useState(''),[preview,setPreview]=useState<Preview>(),[selected,setSelected]=useState<string[]>([]);
  const [profile,setProfile]=useState('general'),[consent,setConsent]=useState(false),[imported,setImported]=useState<ImportResult>();
  const callbackStarted=useRef(false);

  const load=useCallback(async()=>{setOverview(overviewSchema.parse(await request('/api/connectors')));},[request]);
  useEffect(()=>{
    if(!auth.token)return;
    const timer=window.setTimeout(()=>void run('load',async()=>{
      const params=new URLSearchParams(window.location.search),oauth=params.get('googleOAuth');
      if(oauth&&!callbackStarted.current){
        callbackStarted.current=true;params.delete('googleOAuth');const rest=params.toString();
        window.history.replaceState(null,'',`${window.location.pathname}${rest?`?${rest}`:''}${window.location.hash}`);
        // The authorization code stays in an HttpOnly cookie; the server merges it with this authenticated request.
        if(oauth==='1')await request('/api/connectors/google/callback',{});else throw new ConnectorRequestError('SCOPE_NOT_GRANTED');
      }
      await load();
    }),0);
    return()=>window.clearTimeout(timer);
  },[auth.token,load,request,run]);

  const providers=overview?.providers??[];
  const sources=visibleSources(providers);
  function toggle(id:string){setSelected(current=>current.includes(id)?current.filter(value=>value!==id):current.length>=maxImportItems?current:[...current,id]);}
  function status(p:Provider){
    if(p.enabled)return {text:t[`conn_${p.connection}`],hint:''};
    return {text:u.notConfigured,hint:p.id==='gmail'||p.id==='google-drive'?u.setupGoogle:u.setupGeneric};
  }

  return <section className="surface integrations-workbench" aria-labelledby="integrations-title">
    <header className="section-toolbar"><div><h2 id="integrations-title" className="section-heading">{t.title}</h2><p className="mt-2 max-w-2xl text-xs leading-relaxed tone-secondary">{t.intro}</p></div>
      <button type="button" className="button-secondary" disabled={!!busy} onClick={()=>void run('load',load)}>{t.refresh}</button></header>
    {error?<p className="notice-error mx-6" role="alert">{error}</p>:null}
    {!overview&&!error?<p className="lab-loading" role="status">{t.loading}</p>:null}
    {overview?<>
    <div className="px-6 py-4" data-page-tour="integrations-providers">
      <h3 className="section-heading">{t.sources}</h3>
      <ul className="integration-grid">{sources.map(p=>{const text=describeAdapter(p,locale),state=status(p);return <li key={p.id} className="integration-card">
        <div className="integration-card-head"><strong>{text.name}</strong><ConnectorBadge provider={p} locale={locale}/></div>
        <p className={`integration-status ${p.enabled?'':'integration-status-off'}`}>{state.text}</p>
        {state.hint?<p className="integration-setup">{state.hint}</p>:null}
        {text.note?<p className="text-xs tone-secondary">{text.note}</p>:null}
        <dl className="integration-facts">
          <dt>{t.permissions}</dt><dd>{text.permissions.join(' · ')||'—'}</dd>
          {p.sync.lastSuccessAt||p.sync.found?<><dt>{t.lastSync}</dt><dd>{p.sync.lastSuccessAt?new Date(p.sync.lastSuccessAt).toLocaleString(locale):t.never} · {t.found} / {t.imported}: {p.sync.found??0} / {p.sync.imported??0}</dd></>:null}
        </dl>
        {p.sync.lastError?<p className="notice-error integration-sync-error" role="status">{t.lastError}: {connectorError(locale,p.sync.lastError)}</p>:null}
        {p.scopes.length||p.grantedScopes?.length||p.sync.lastError?<details className="integration-technical"><summary>{ux.technical}</summary><dl className="integration-facts">
          {p.scopes.length?<><dt>{t.scopes}</dt><dd><code>{p.scopes.map(shortScope).join(', ')}</code></dd></>:null}
          {p.grantedScopes?.length?<><dt>{t.granted}</dt><dd><code>{p.grantedScopes.map(shortScope).join(', ')}</code></dd></>:null}
          {p.sync.lastError?<><dt>{t.lastError}</dt><dd><code>{p.sync.lastError}</code>{p.sync.lastErrorAt?` · ${new Date(p.sync.lastErrorAt).toLocaleString(locale)}`:''}</dd></>:null}
        </dl></details>:null}
      </li>;})}</ul>
    </div>

    <div className="px-6 py-4 integration-flow" data-page-tour="integrations-import">
      <h3 className="section-heading">{t.flow}</h3>
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
        <label>{t.profile}<select value={profile} onChange={e=>setProfile(e.target.value)}>{profileOptions(locale).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="integration-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{t.consent}</label>
        <button type="button" className="button-primary" disabled={!!busy||!consent||!canWrite} onClick={()=>void run('import',async()=>{
          setImported(importResultSchema.parse(await request(`${casePath}/sources/${encodeURIComponent(sourceId)}/import`,{requestId:crypto.randomUUID(),caseVersion,externalIds:selected,profile,consent:true})));
          setSelected([]);setConsent(false);refreshCase();})}>{t.importSelected}</button>
      </div>:null}
      {imported?<div className="integration-result" role="status"><ul>{imported.items.map(item=><li key={item.externalId}><strong>{item.name||item.externalId}</strong>: {t[`state_${item.state}`]}{item.code?` · ${connectorError(locale,item.code)}`:''}</li>)}</ul>
        <div className="integration-actions"><button type="button" className="button-secondary" onClick={()=>navigate('pipeline')}>{fill(u.openPage,{page:page('pipeline')})}</button><button type="button" className="button-secondary" onClick={()=>navigate('documents')}>{fill(u.openPage,{page:page('documents')})}</button></div></div>:null}
    </div>

    <div className="px-6 py-4 integration-outputs">
      <h3 className="section-heading">{t.destinations}</h3>
      <ul className="integration-future">{visibleDestinations(overview.destinations??[]).map(d=>{const text=describeAdapter(d,locale);return <li key={d.id}><strong>{text.name}</strong> <ConnectorBadge provider={d} locale={locale}/></li>;})}</ul>
      <p className="text-xs tone-secondary">{fill(u.outputsHint,{page:page('documents')})}</p>
      <p className="text-xs tone-secondary">{fill(u.movedHint,{datasets:page('evaluation'),domain:page('banking')})}</p>
    </div>

    </>:null}
  </section>;
}
