"use client";
import {useEffect,useState} from 'react';
import {checkResultSchema,integrationsText,useCaseCatalogSchema,type CheckResult,type UseCaseCatalog} from '@/lib/integrations';
import type {WorkspaceTab} from '@/lib/nova-guide';
import {workspacePageName} from '@/lib/workspace-presentation';
import {fill,usabilityText} from '@/lib/workspace-usability';
import {useConnectorApi} from './connector-api';

/** The eight fictional use cases with deterministic checks. Lives with the research datasets. */
export function UseCaseLibrary({caseId,locale,navigate}:{caseId:string;locale:string;navigate:(tab:WorkspaceTab)=>void}){
  const {auth,request,run,busy,error}=useConnectorApi(locale);
  const t=integrationsText(locale),u=usabilityText(locale),language=locale==='vi'?'vi':locale==='de'?'de':'en';
  const casePath=`/api/cases/${encodeURIComponent(caseId)}/platform`;
  const [catalog,setCatalog]=useState<UseCaseCatalog>(),[checks,setChecks]=useState<Record<string,CheckResult>>({});
  useEffect(()=>{
    if(!auth.token)return;
    const timer=window.setTimeout(()=>void run('load',async()=>setCatalog(useCaseCatalogSchema.parse(await request('/api/connectors/use-cases')))),0);
    return()=>window.clearTimeout(timer);
  },[auth.token,request,run]);
  return <section className="surface integrations-workbench use-case-library" data-page-tour="datasets-use-cases" aria-labelledby="use-case-title">
    <header className="section-toolbar"><div><h2 id="use-case-title" className="section-heading">{u.useCasesTitle} {catalog?<span>{catalog.useCases.length}</span>:null}</h2>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed tone-secondary">{fill(u.useCasesIntro,{page:workspacePageName(locale,'integrations')})}</p></div>
      <button type="button" className="button-secondary" onClick={()=>navigate('integrations')}>{u.importSamples}</button></header>
    {error?<p className="notice-error mx-6" role="alert">{error}</p>:null}
    {!catalog&&!error?<p className="lab-loading" role="status">{t.loading}</p>:null}
    {catalog?<ul className="integration-use-cases px-6 py-4">{catalog.useCases.map(useCase=>{const result=checks[useCase.id];return <li key={useCase.id} className="integration-card">
      <div className="integration-card-head"><strong>{useCase.title[language]}</strong><span className="integration-label integration-label-simulated">{t.fictional}</span></div>
      <p className="text-xs">{useCase.summary[language]}</p>
      <p className="text-xs"><strong>{t.answerable}:</strong> {useCase.answerable.question[language]} → <q>{useCase.answerable.answer}</q> ({useCase.answerable.evidence.path.split('/').pop()}, p. {useCase.answerable.evidence.page})</p>
      <p className="text-xs"><strong>{t.unanswerable}:</strong> {useCase.unanswerable.question[language]}</p>
      <p className="text-xs tone-secondary">{useCase.boundary[language]}</p>
      <button type="button" className="button-secondary" disabled={!!busy} onClick={()=>void run(`check-${useCase.id}`,async()=>{const value=checkResultSchema.parse(await request(`${casePath}/use-cases/${useCase.id}/check`,{}));setChecks(current=>({...current,[useCase.id]:value}));})}>{t.runCheck}</button>
      {result?<div className={result.passed?'notice-lab':'notice-error'} role="status"><p>{result.passed?t.passed:t.failed}</p><ul>{result.checks.map(c=><li key={c.check}>{c.passed?'✓':'✗'} {c.check}: {c.actual}</li>)}</ul>
        <p>{result.answerable.evidenceFoundOnCitedPage?`✓ ${t.evidenceFound}`:'✗'}</p><p>{result.unanswerable.mustAbstain?`✓ ${t.mustAbstain}`:'✗'}</p></div>:null}
    </li>;})}</ul>:null}
  </section>;
}
