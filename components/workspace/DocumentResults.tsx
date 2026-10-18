"use client";
import {ArrowUpRight,CheckCircle2,Clock3,FileSearch,RefreshCw,Sparkles} from "lucide-react";
import type {CreditDocument} from "@/lib/credit-data";
import {documentUi,documentJobLabel,type DocumentJob} from "@/lib/document-results";
import {AIDocumentBadge} from "./AITransparency";
import {researchExtractionLabels,researchSampleLabels} from '@/lib/research-samples';

export function DocumentRecognitionDetails({doc,locale}:{doc:CreditDocument;locale:string}){
  const t=documentUi(locale),score=typeof doc.confidence==="number"&&Number.isFinite(doc.confidence)?`${doc.confidence}%`:t.unknown;
  return <details className="document-recognition"><summary>{t.ocr}</summary><strong>{score}</strong><p>{t.ocrHint}</p><small>{doc.analysisProvider||"—"} · {doc.modelId||"—"}</small></details>;
}
export function DocumentResultCard({doc,locale,open,ask,historical=false}:{doc:CreditDocument;locale:string;open:(doc:CreditDocument)=>void;ask?:(question:string)=>void;historical?:boolean}){
  const t=documentUi(locale),reference=["datev-reference-values","synthetic-fixture","fixture"].includes(doc.analysisProvider||"");
  const research=researchExtractionLabels(locale),wording=doc.type==='insurance-wording';
  const counts=[doc.pages?.length?`${doc.pages.length} ${research.pages}`:null,!wording||doc.fields?.length?`${doc.fields?.length||0} ${t.fields}`:null,!wording||doc.tables?.length?`${doc.tables?.length||0} ${t.tables}`:null].filter(Boolean).join(' · ');
  const fields=[{label:"netIncome",title:t.net},{label:"payoutAmount",title:t.payout}].map(item=>({...item,value:doc.fields?.find(field=>field.label===item.label)?.value})).filter(item=>item.value);
  return <article className={`document-result-card${historical?" document-result-historical":""}`} id={`document-result-${doc.id}`}>
    <div className="document-result-heading"><span className="document-result-icon"><FileSearch size={22}/></span><div><h4>{doc.name}</h4><span className={`document-result-state ${doc.status==="verified"?"document-state-reviewed":""}`}><CheckCircle2 size={14}/>{reference?t.reference:doc.status==="verified"?t.verified:t.ready}</span></div></div>
    {historical?<p className="lab-caption">{t.history}</p>:null}<AIDocumentBadge doc={doc} locale={locale} compact/>
    {fields.length?<dl className="document-result-values">{fields.map(field=><div key={field.label}><dt>{field.title}</dt><dd>{field.value}</dd></div>)}</dl>:null}
    <p className="document-result-counts">{counts}</p>
    {wording?<p className="lab-caption">{research.wording}</p>:null}
    <div className="document-result-actions"><button className="button-primary" onClick={()=>open(doc)}><FileSearch size={16}/>{t.view}</button>{ask&&!reference?<button className="button-secondary" onClick={()=>ask(`${t.resultQuestion} ${doc.name} [${doc.id}:p1]`)}><Sparkles size={15}/>{t.ask}</button>:null}</div>
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
export function DocumentResults({documents,jobs,locale,loading,error,refresh,open,ask,choose,technical,payroll=true}:{documents:readonly CreditDocument[];jobs:readonly DocumentJob[];locale:string;loading:boolean;error:boolean;refresh:()=>void;open:(doc:CreditDocument)=>void;ask:(question:string)=>void;choose:()=>void;technical:()=>void;payroll?:boolean}){
  const t={...documentUi(locale),...(!payroll?{empty:researchSampleLabels(locale).hint,choose:researchSampleLabels(locale).title}:{})},files=documents.filter(doc=>doc.status!=="missing"),missing=documents.filter(doc=>doc.status==="missing");
  const latest=new Map<string,CreditDocument>(),history:CreditDocument[]=[];
  for(const doc of files){if(latest.has(doc.name))history.push(doc);else latest.set(doc.name,doc);}
  return <section id="document-analysis-results" className="document-analysis-results" data-page-tour="documents-list" aria-labelledby="document-results-title" tabIndex={-1}>
    <header><div><span className="eyebrow">{t.steps}</span><h3 id="document-results-title">{t.results} <span>{latest.size}</span></h3><p>{t.resultsHint}</p></div><button className="button-secondary" onClick={refresh} disabled={loading}><RefreshCw size={15}/>{t.refresh}</button></header>
    {error?<p className="notice-error" role="alert">{t.statusError}</p>:null}
    {loading?<p className="lab-caption" role="status">{t.loading}</p>:null}
    {jobs.length?<div className="document-processing-list">{jobs.map(job=><DocumentProcessingCard key={job.id} job={job} locale={locale} open={open} technical={technical}/>)}</div>:null}
    {latest.size?<div className="document-result-grid">{[...latest.values()].map(doc=><DocumentResultCard key={doc.id} doc={doc} locale={locale} open={open} ask={ask}/>)}</div>:<div className="document-results-empty"><FileSearch size={25}/><p>{t.empty}</p><button className="button-primary" onClick={choose}>{t.choose}</button></div>}
    {history.length?<details className="document-result-history"><summary>{t.historyTitle} · {history.length}</summary><p>{t.history}</p><div className="document-result-grid">{history.map(doc=><DocumentResultCard key={doc.id} doc={doc} locale={locale} open={open} ask={ask} historical/>)}</div></details>:null}
    {missing.length?<div className="document-results-missing"><strong>{t.missing}</strong><ul>{missing.map(doc=><li key={doc.id}>{doc.name}</li>)}</ul></div>:null}
  </section>;
}
