"use client";
import type {ReactNode} from 'react';
import {FileSearch,MessageSquareText,ScanSearch,ShieldCheck} from "lucide-react";
import {workspaceUxText} from "@/lib/workspace-ux";
import type {WorkspaceTab} from "@/lib/nova-guide";
import {aiText,chatEngine,documentAI,type AICapabilities} from "@/lib/ai-capabilities";
import {AITag} from "./AITransparency";
import {AIDashboardStats,WorkspaceAICatalog} from './WorkspaceAICatalog';
import type {CreditDocument} from '@/lib/credit-data';
import type {TrustSection} from '@/lib/nova-trust';
import {DocumentAnalyticsPanel} from './DocumentAnalyticsPanel';

export function WorkspaceAIOverview({locale, demo, documentMode, capabilities, navigate, openNova,documents,openTrust,children,caseId}: {
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
}) {
  const t = workspaceUxText(locale);
  const ai=aiText(locale),chat=chatEngine(capabilities,locale,demo),rag=capabilities?.retrieval,doc=capabilities?.documents;
  const identity=documentAI({analysisProvider:doc?.configured?doc.provider:undefined,modelId:doc?.modelId,status:'review'},locale);
  const docKind=demo?"demo":doc?identity.kind:documentMode===undefined?"unknown":documentMode==="local"?"rules":"ai";
  const provider = demo?t.demo:doc?(!doc.configured?ai.unavailable:identity.engine)
    :documentMode===undefined?t.unknown:documentMode==="local"?t.local:documentMode==="docling"?"Docling · Local AI":t.azure;
  return <><section data-page-tour="overview-ai" className="workspace-ai-overview" aria-labelledby="workspace-ai-title">
    <header><div><h2 id="workspace-ai-title">{ai.title}</h2><p>{ai.subtitle}</p></div><span className="ai-human-seal"><ShieldCheck size={17}/>{ai.human}</span></header>
    <div className="workspace-ai-services">
      <button className="workspace-service" onClick={()=>navigate('documents')} aria-label={t.documentAction}><FileSearch size={21}/><span><strong>{t.documents}</strong><small>{provider}</small><code>{capabilities?.documents.modelId||ai.notReported}</code></span><AITag kind={docKind} locale={locale}/></button>
      <button className="workspace-service" onClick={()=>navigate('studio')} aria-label={t.retrievalAction}><ScanSearch size={21}/><span><strong>{t.retrieval}</strong><small>{demo?ai.demo:rag?.embeddingModel||ai.unknown}</small><code>{demo?'browser fixtures':rag?`${rag.vectorStore} · BM25`:ai.notReported}</code></span><AITag kind={demo?'demo':!rag?'unknown':rag.semantic?'ai':'rules'} locale={locale}/></button>
      <button className="workspace-service" onClick={openNova} aria-label={t.novaAction}><MessageSquareText size={21}/><span><strong>{t.nova}</strong><small>{chat.engine}</small><code>{chat.model}</code></span><AITag kind={chat.kind} locale={locale}/></button>
    </div>
    <p className="ai-configuration-note"><ShieldCheck size={13}/>{ai.notLive}</p>
  </section><AIDashboardStats locale={locale} documents={documents} capabilities={capabilities} demo={demo}/>{children}{caseId&&!demo?<DocumentAnalyticsPanel key={caseId} caseId={caseId} locale={locale} navigate={navigate} compact/>:null}<WorkspaceAICatalog caseId={caseId} locale={locale} demo={demo} capabilities={capabilities} navigate={navigate} openNova={openNova} openTrust={openTrust}/></>;
}
