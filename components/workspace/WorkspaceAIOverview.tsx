"use client";
import {useEffect,useState,type ReactNode} from 'react';
import {Gauge,MessageSquareText,ScanSearch,ShieldCheck,Upload} from "lucide-react";
import {useOptionalAuth} from '@/components/auth/KeycloakProvider';
import {workspaceUxText} from "@/lib/workspace-ux";
import type {WorkspaceTab} from "@/lib/nova-guide";
import {aiText,chatEngine,documentAI,type AICapabilities} from "@/lib/ai-capabilities";
import {WorkspaceAICatalog} from './WorkspaceAICatalog';
import type {CreditDocument} from '@/lib/credit-data';
import type {TrustSection} from '@/lib/nova-trust';
import {platformSchema} from '@/lib/platform';
import {documentJobLabel,type DocumentJob} from '@/lib/document-results';
import {workspacePageName,workspacePresentation} from '@/lib/workspace-presentation';
import {overviewTasks,recentDocuments,usabilityText} from '@/lib/workspace-usability';

/** Reads the dossier's processing jobs once, so failed files can lead the task list. */
function useCaseJobs(caseId:string|undefined,demo:boolean){
  const token=useOptionalAuth()?.token;const [jobs,setJobs]=useState<DocumentJob[]>([]);
  useEffect(()=>{
    if(!caseId||demo||!token)return;
    const controller=new AbortController();
    const timer=window.setTimeout(()=>void fetch(`/api/cases/${encodeURIComponent(caseId)}/platform`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal})
      .then(response=>response.ok?response.json():Promise.reject(new Error('status')))
      .then(value=>{const data=platformSchema.parse(value);if(data.caseId===caseId&&!controller.signal.aborted)setJobs(data.jobs);})
      .catch(()=>{/* the task list still shows review work from the dossier itself */}),0);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[caseId,demo,token]);
  return jobs;
}

/**
 * Task page, in priority order: work that needs a person, recent documents, the three main entry points,
 * then the complete AI catalog (collapsed until opened, searched or deep-linked).
 */
export function WorkspaceAIOverview({locale, demo, documentMode, capabilities, navigate, openNova,documents=[],openTrust,children,caseId,inspect,openIntake,issueCount=0}: {
  locale: string;
  demo: boolean;
  documentMode?: string;
  capabilities?: AICapabilities;
  navigate: (tab: WorkspaceTab) => void;
  openNova: () => void;
  documents?:readonly CreditDocument[];
  openTrust?:(section:TrustSection)=>void;
  children?:ReactNode;
  caseId?:string;
  inspect?:(doc:CreditDocument)=>void;
  openIntake?:()=>void;
  issueCount?:number;
}) {
  const t = workspaceUxText(locale),u=usabilityText(locale),presentation=workspacePresentation(locale);
  const ai=aiText(locale),chat=chatEngine(capabilities,locale,demo),rag=capabilities?.retrieval,doc=capabilities?.documents;
  const identity=documentAI({analysisProvider:doc?.configured?doc.provider:undefined,modelId:doc?.modelId,status:'review'},locale);
  const provider = demo?t.demo:doc?(!doc.configured?ai.unavailable:identity.engine)
    :documentMode===undefined?t.unknown:documentMode==="local"?t.local:documentMode==="docling"?"Docling · Local AI":t.azure;
  const jobs=useCaseJobs(caseId,demo),{failed,review}=overviewTasks(documents,jobs),recent=recentDocuments(documents,jobs);
  const add=openIntake||(()=>navigate('pipeline')),open=(item:CreditDocument)=>inspect?inspect(item):navigate('documents');
  const page=(tab:WorkspaceTab)=>workspacePageName(locale,tab);
  return <>
    <section className="surface overview-attention" aria-labelledby="overview-attention-title">
      <header><h2 id="overview-attention-title">{u.attentionTitle} <span>{failed.length+review.length+issueCount}</span></h2></header>
      {failed.length?<div className="overview-group"><h3>{u.failedTitle}</h3><ul>{failed.map(job=><li key={job.id}>
        <span className="status-chip" data-tone="danger">{documentJobLabel(job,locale)}</span><strong>{job.name}</strong>
        <button type="button" className="button-secondary" onClick={add}>{u.openProcessing}</button></li>)}</ul></div>:null}
      {review.length?<div className="overview-group"><h3>{u.reviewTitle}</h3><ul>{review.map(item=><li key={item.id}>
        <span className="status-chip" data-tone="warning">{presentation.awaitingReview}</span><strong>{item.name}</strong>
        <button type="button" className="button-primary" onClick={()=>open(item)}>{u.reviewNow}</button></li>)}</ul></div>:null}
      {children}
      {!failed.length&&!review.length&&!issueCount?<p className="overview-clear">{u.allClear}</p>:null}
    </section>
    <section className="surface overview-recent" aria-labelledby="overview-recent-title">
      <header><h2 id="overview-recent-title">{u.recentTitle}</h2><button type="button" className="button-link" onClick={()=>navigate('documents')}>{u.allDocuments}</button></header>
      {recent.length?<ul>{recent.map(item=>{const verified=item.status==='verified';return <li key={item.id}>
        <strong>{item.name}</strong><span className="status-chip" data-tone={verified?'success':'warning'}>{verified?presentation.verified:presentation.awaitingReview}</span>
        <button type="button" className="button-secondary" onClick={()=>open(item)}>{verified?u.actionView:u.actionReview}</button></li>;})}</ul>
        :<p className="overview-clear">{u.recentEmpty}</p>}
    </section>
    <section data-page-tour="overview-ai" className="overview-start" aria-labelledby="overview-start-title">
      <header><h2 id="overview-start-title">{u.startTitle}</h2><span className="ai-human-seal"><ShieldCheck size={15}/>{ai.human}</span><button type="button" className="button-link" onClick={openNova}><MessageSquareText size={15}/>{t.novaAction}</button></header>
      <div className="overview-start-grid">
        <button type="button" className="overview-start-card" onClick={add}><Upload size={20}/><strong>{presentation.upload}</strong><span>{u.startAddHint}</span><small>{provider}</small></button>
        <button type="button" className="overview-start-card" onClick={()=>navigate('studio')}><ScanSearch size={20}/><strong>{page('studio')}</strong><span>{u.startAskHint}</span><small>{demo?ai.demo:rag?(rag.semantic?t.hybridSearch:t.keywordSearch):ai.unknown}</small></button>
        <button type="button" className="overview-start-card" onClick={()=>navigate('experiments')}><Gauge size={20}/><strong>{page('experiments')}</strong><span>{u.startQualityHint}</span></button>
      </div>
      <details className="ai-technical-details"><summary>{u.technology}</summary><dl>
        <div><dt>{t.documents}</dt><dd>{provider} · <code>{capabilities?.documents.modelId||ai.notReported}</code></dd></div>
        <div><dt>{t.retrieval}</dt><dd><code>{demo?'browser fixtures':rag?`${rag.embeddingModel||ai.unknown} · ${rag.vectorStore} · BM25`:ai.notReported}</code></dd></div>
        <div><dt>{t.nova}</dt><dd>{chat.engine} · <code>{chat.model}</code></dd></div>
      </dl><p className="ai-configuration-note"><ShieldCheck size={13}/>{ai.notLive}</p></details>
    </section>
    <WorkspaceAICatalog caseId={caseId} locale={locale} demo={demo} capabilities={capabilities} navigate={navigate} openNova={openNova} openTrust={openTrust}/>
  </>;
}
