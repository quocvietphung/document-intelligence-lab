"use client";
import {useEffect,useState} from 'react';
import {assessmentSchema,describeAdapter,integrationsText,overviewSchema,useCaseCatalogSchema,type Assessment,type Overview} from '@/lib/integrations';
import {usabilityText} from '@/lib/workspace-usability';
import {ConnectorBadge} from './ConnectorBadge';
import {useConnectorApi} from './connector-api';

/** Deterministic project assessment from an exported CSV. A language model may explain it, never compute it. */
export function ProjectAssessmentPanel({caseId,locale}:{caseId:string;locale:string}){
  const {auth,request,run,busy,error}=useConnectorApi(locale);
  const t=integrationsText(locale),u=usabilityText(locale);
  const casePath=`/api/cases/${encodeURIComponent(caseId)}/platform`;
  const [csv,setCsv]=useState(''),[sample,setSample]=useState<string>(),[assessment,setAssessment]=useState<Assessment>(),[businessData,setBusinessData]=useState<Overview['businessData']>([]);
  useEffect(()=>{
    if(!auth.token)return;
    const timer=window.setTimeout(()=>void run('load',async()=>{
      const [status,cases]=await Promise.all([request('/api/connectors'),request('/api/connectors/use-cases')]);
      setBusinessData(overviewSchema.parse(status).businessData);
      setSample(useCaseCatalogSchema.parse(cases).useCases.find(useCase=>useCase.id==='project-assessment')?.businessDataSample);
    }),0);
    return()=>window.clearTimeout(timer);
  },[auth.token,request,run]);
  return <section className="surface integrations-workbench project-assessment" data-page-tour="domain-assessment" aria-labelledby="assessment-title">
    <header className="section-toolbar"><div><h2 id="assessment-title" className="section-heading">{t.assessment}</h2><p className="mt-2 max-w-2xl text-xs leading-relaxed tone-secondary">{u.assessmentIntro}</p></div></header>
    <div className="px-6 py-4">
      {error?<p className="notice-error" role="alert">{error}</p>:null}
      <ul className="integration-future">{businessData.filter(d=>d.label!=='future').map(d=>{const text=describeAdapter(d,locale);return <li key={d.id}><strong>{t.businessData}: {text.name}</strong> <ConnectorBadge provider={d} locale={locale}/>{text.note?<small> — {text.note}</small>:null}</li>;})}</ul>
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
        <p className="text-xs tone-secondary">{assessment.notice}</p></div>:null}
    </div>
  </section>;
}
