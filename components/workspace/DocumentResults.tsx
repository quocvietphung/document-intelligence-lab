"use client";
import {ArrowUpRight,CheckCircle2,Clock3,FileSearch,RefreshCw,Sparkles} from "lucide-react";
import {useState} from 'react';
import type {CreditDocument} from "@/lib/credit-data";
import {documentUi,documentJobLabel,filterResultDocuments,resultDocumentGroups,type ResultFilter,type DocumentJob} from "@/lib/document-results";
import {AIDocumentBadge} from "./AITransparency";
import {researchExtractionLabels,researchSampleLabels} from '@/lib/research-samples';
import {workspacePresentation} from '@/lib/workspace-presentation';
import {CollectionToolbar} from './CollectionToolbar';
import {documentTypeLabel,usabilityText} from '@/lib/workspace-usability';

export function DocumentRecognitionDetails({doc,locale}:{doc:CreditDocument;locale:string}){
  const t=documentUi(locale),score=typeof doc.confidence==="number"&&Number.isFinite(doc.confidence)?`${doc.confidence}%`:t.unknown;
  return <details className="document-recognition"><summary>{t.ocr}</summary><strong>{score}</strong><p>{t.ocrHint}</p></details>;
}
export function DocumentResultCard({doc,locale,open,ask,historical=false}:{doc:CreditDocument;locale:string;open:(doc:CreditDocument)=>void;ask?:(question:string)=>void;historical?:boolean}){
  const t=documentUi(locale),reference=["datev-reference-values","synthetic-fixture","fixture"].includes(doc.analysisProvider||"");
  const StateIcon=doc.status==='verified'?CheckCircle2:Clock3;
  const research=researchExtractionLabels(locale),wording=doc.type==='insurance-wording';
  const counts=[doc.pages?.length?`${doc.pages.length} ${research.pages}`:null,!wording||doc.fields?.length?`${doc.fields?.length||0} ${t.fields}`:null,!wording||doc.tables?.length?`${doc.tables?.length||0} ${t.tables}`:null].filter(Boolean).join(' · ');
  const fields=[{label:"netIncome",title:t.net},{label:"payoutAmount",title:t.payout}].map(item=>({...item,value:doc.fields?.find(field=>field.label===item.label)?.value})).filter(item=>item.value);
  return <article className={`document-result-card${historical?" document-result-historical":""}`} id={`document-result-${doc.id}`}>
    <div className="document-result-heading"><span className="document-result-icon"><FileSearch size={22}/></span><div><h4>{doc.name}</h4><span className={`document-result-state ${doc.status==="verified"?"document-state-reviewed":""}`}><StateIcon size={14}/>{reference?t.reference:doc.status==="verified"?t.verified:t.ready}</span></div></div>
    {historical?<p className="lab-caption">{t.history}</p>:null}<AIDocumentBadge doc={doc} locale={locale} compact/>
    {fields.length?<dl className="document-result-values">{fields.map(field=><div key={field.label}><dt>{field.title}</dt><dd>{field.value}</dd></div>)}</dl>:null}
    <p className="document-result-counts">{counts}</p>
    {wording?<p className="lab-caption">{research.wording}</p>:null}
    <div className="document-result-actions"><button className="button-primary" onClick={()=>open(doc)}><FileSearch size={16}/>{t.view}</button>{ask&&!reference?<button className="button-secondary document-result-nova" aria-label={`${t.ask} · ${doc.name}`} title={t.ask} onClick={()=>ask(`${t.resultQuestion} ${doc.name} [${doc.id}:p1]`)}><Sparkles size={15}/>Nova</button>:null}</div>
    {!doc.originalAvailable&&!reference?<p className="lab-caption">{t.sourceMissing}</p>:null}
  </article>;
}
export function DocumentProcessingCard({job,locale,doc,open,technical}:{job:DocumentJob;locale:string;doc?:CreditDocument;open:(doc:CreditDocument)=>void;technical:()=>void}){
  const t=documentUi(locale),failed=job.status==="FAILED"||job.status==="EXPIRED";
  return <article className={`document-processing-card${failed?" document-processing-failed":""}`}>
    <div><Clock3 size={19}/><div><strong>{job.name}</strong><p role="status">{doc?t.ready:documentJobLabel(job,locale)}</p></div></div>
    {failed?<p>{t.failureHint}</p>:null}
    <div className="document-processing-actions">{doc?<button className="button-primary" onClick={()=>open(doc)}>{t.view}</button>:null}<button className="button-link" onClick={technical}>{t.technical}<ArrowUpRight size={14}/></button></div>
  </article>;
}
type RowActions={open:(doc:CreditDocument)=>void;ask?:(question:string)=>void;draft?:(doc:CreditDocument)=>void};
/** Closes the row menu after a choice, so the next action starts from a clean list. */
function choose(event:React.MouseEvent<HTMLElement>,action:()=>void){event.currentTarget.closest('details')?.removeAttribute('open');action();}
function DocumentRow({doc,locale,open,ask,draft,historical=false}:{doc:CreditDocument;locale:string;historical?:boolean}&RowActions){
  const t=documentUi(locale),u=usabilityText(locale),p=workspacePresentation(locale),research=researchExtractionLabels(locale);
  const reference=["datev-reference-values","synthetic-fixture","fixture"].includes(doc.analysisProvider||""),verified=doc.status==='verified',wording=doc.type==='insurance-wording';
  const tone=reference?'neutral':verified?'success':'warning';
  const counts=[doc.pages?.length?`${doc.pages.length} ${research.pages}`:null,!wording||doc.fields?.length?`${doc.fields?.length||0} ${t.fields}`:null].filter(Boolean).join(' · ');
  return <tr id={`document-result-${doc.id}`} className={historical?'document-row-historical':undefined}>
    <th scope="row"><button type="button" className="document-name" onClick={()=>open(doc)}>{doc.name}</button>
      <small>{counts}{!reference&&doc.analysisProvider?<span className="document-ai-mark" title={u.aiAssisted}><Sparkles size={12} aria-hidden="true"/>AI</span>:null}</small>
      {!doc.originalAvailable&&!reference?<small className="document-row-warning">{t.sourceMissing}</small>:null}</th>
    <td>{documentTypeLabel(doc.type,locale)}</td>
    <td><span className="status-chip" data-tone={tone}>{reference?t.reference:verified?p.verified:p.awaitingReview}</span></td>
    <td className="document-row-actions">
      <button type="button" className={verified||reference?'button-secondary':'button-primary'} onClick={()=>open(doc)}><FileSearch size={15}/>{verified||reference?u.actionView:u.actionReview}</button>
      <details className="row-menu" onKeyDown={event=>{if(event.key!=='Escape'||!event.currentTarget.open)return;event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}><summary aria-label={`${u.moreActions} · ${doc.name}`}>{u.moreActions}</summary><div className="row-menu-panel">
        {ask&&!reference?<button type="button" onClick={event=>choose(event,()=>ask(`${t.resultQuestion} ${doc.name} [${doc.id}:p1]`))}><Sparkles size={14}/>{u.askNova}</button>:null}
        {draft&&verified&&doc.fields?.length?<button type="button" onClick={event=>choose(event,()=>draft(doc))}>{u.draftAction}</button>:null}
        <div className="row-menu-info"><strong>{u.technology}</strong><AIDocumentBadge doc={doc} locale={locale} compact/></div>
      </div></details>
    </td>
  </tr>;
}
/** Carbon-style data table: scan many documents by name, type and review status, with one primary action per row. */
function DocumentTable({docs,locale,caption,historical=false,...actions}:{docs:readonly CreditDocument[];locale:string;caption:string;historical?:boolean}&RowActions){
  const u=usabilityText(locale);
  return <div className="document-table-wrap"><table className="document-table"><caption className="sr-only">{caption}</caption>
    <thead><tr><th scope="col">{u.colDocument}</th><th scope="col">{u.colType}</th><th scope="col">{u.colStatus}</th><th scope="col"><span className="sr-only">{u.colActions}</span></th></tr></thead>
    <tbody>{docs.map(doc=><DocumentRow key={doc.id} doc={doc} locale={locale} historical={historical} {...actions}/>)}</tbody></table></div>;
}
export function DocumentResults({documents,jobs,locale,loading,error,refresh,open,ask,choose:chooseSample,technical,payroll=true,draft,report}:{documents:readonly CreditDocument[];jobs:readonly DocumentJob[];locale:string;loading:boolean;error:boolean;refresh:()=>void;open:(doc:CreditDocument)=>void;ask:(question:string)=>void;choose:()=>void;technical:()=>void;payroll?:boolean;draft?:(doc:CreditDocument)=>void;report?:React.ReactNode}){
  const t={...documentUi(locale),...(!payroll?{empty:researchSampleLabels(locale).hint,choose:researchSampleLabels(locale).title}:{})},u=workspacePresentation(locale);
  const [query,setQuery]=useState(''),[filter,setFilter]=useState<ResultFilter>('all');
  const {latest,history,missing}=resultDocumentGroups(documents),visible=filterResultDocuments(latest,query,filter);
  const reset=()=>{setQuery('');setFilter('all');};
  return <section id="document-analysis-results" className="document-analysis-results document-results-compact" data-page-tour="documents-list" aria-labelledby="document-results-title" tabIndex={-1}>
    <header><div><h3 id="document-results-title">{t.results} <span>{latest.length}</span></h3></div><div className="document-results-actions">{report}<button className="button-secondary" onClick={refresh} disabled={loading}><RefreshCw size={15}/>{t.refresh}</button></div></header>
    {error?<p className="notice-error" role="alert">{t.statusError}</p>:null}
    {loading?<p className="lab-caption" role="status">{t.loading}</p>:null}
    {jobs.length?<div className="document-processing-list">{jobs.map(job=><DocumentProcessingCard key={job.id} job={job} locale={locale} open={open} technical={technical}/>)}</div>:null}
    {latest.length?<><CollectionToolbar locale={locale} label={t.results} query={query} searchLabel={u.resultSearch} onQuery={setQuery} filter={filter} filters={[{value:'all',label:u.allResults},{value:'review',label:u.awaitingReview},{value:'verified',label:u.verified}]} onFilter={value=>setFilter(value as ResultFilter)} shown={visible.length} total={latest.length} active={!!query||filter!=='all'} reset={reset}/>{visible.length?<DocumentTable docs={visible} locale={locale} caption={t.results} open={open} ask={ask} draft={draft}/>:<div className="document-results-empty"><FileSearch size={25}/><p>{u.noMatches}</p></div>}</>:<div className="document-results-empty"><FileSearch size={25}/><p>{t.empty}</p><button className="button-primary" onClick={chooseSample}>{t.choose}</button></div>}
    {history.length?<details className="document-result-history"><summary>{t.historyTitle} · {history.length}</summary><p>{t.history}</p><DocumentTable docs={history} locale={locale} caption={t.historyTitle} historical open={open} ask={ask}/></details>:null}
    {missing.length?<div className="document-results-missing"><strong>{t.missing}</strong><ul>{missing.map(doc=><li key={doc.id}>{doc.name}</li>)}</ul></div>:null}
  </section>;
}
