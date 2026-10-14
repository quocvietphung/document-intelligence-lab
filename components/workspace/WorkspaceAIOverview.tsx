"use client";
import {ArrowUpRight, FileSearch, MessageSquareText, ScanSearch,ShieldCheck,Sparkles} from "lucide-react";
import {workspaceUxText} from "@/lib/workspace-ux";
import type {WorkspaceTab} from "@/lib/nova-guide";
import {aiText,chatEngine,type AICapabilities} from "@/lib/ai-capabilities";
import {AITag,AIWorkflowLegend} from "./AITransparency";
import {AIDashboardStats,WorkspaceAICatalog} from './WorkspaceAICatalog';
import type {CreditDocument} from '@/lib/credit-data';
import type {TrustSection} from '@/lib/nova-trust';

export function WorkspaceAIOverview({locale, demo, documentMode, capabilities, navigate, openNova,documents,openTrust}: {
  locale: string;
  demo: boolean;
  documentMode?: string;
  capabilities?: AICapabilities;
  navigate: (tab: WorkspaceTab) => void;
  openNova: () => void;
  documents?:readonly CreditDocument[];
  openTrust?:(section:TrustSection)=>void;
}) {
  const t = workspaceUxText(locale);
  const ai=aiText(locale),chat=chatEngine(capabilities,locale,demo),rag=capabilities?.retrieval,doc=capabilities?.documents;
  const docKind=demo?"demo":doc?doc.provider==="azure-document-intelligence"&&doc.configured?"ai":doc.provider.startsWith("local")?"rules":"unknown":documentMode===undefined?"unknown":documentMode==="local"?"rules":"ai";
  const provider = demo?t.demo:doc?(!doc.configured?ai.unavailable:doc.provider==="azure-document-intelligence"?t.azure:doc.provider.startsWith("local")?t.local:t.unknown)
    :documentMode===undefined?t.unknown:documentMode==="local"?t.local:t.azure;
  return <><section data-page-tour="overview-ai" className="workspace-ai-overview" aria-labelledby="workspace-ai-title">
    <header><div><span className="eyebrow"><Sparkles size={13}/>{ai.journey}</span><h1 id="workspace-ai-title">{ai.title}</h1><p>{ai.subtitle}</p></div><span className="ai-human-seal"><ShieldCheck size={17}/>{ai.human}</span></header>
    <div className="workspace-ai-grid">
      <article className="surface workspace-ai-card">
        <div className="ai-card-top"><span className="ai-card-icon"><FileSearch size={24} aria-hidden="true"/></span><AITag kind={docKind} locale={locale}/></div><h4>{t.documents}</h4><p>{t.documentHint}</p>
        <div className="ai-card-engine"><small>{provider}</small><code>{capabilities?.documents.modelId||ai.notReported}</code></div>
        <button className="button-secondary" onClick={() => navigate("documents")}>{t.documentAction}<ArrowUpRight size={15}/></button>
      </article>
      <article className="surface workspace-ai-card">
        <div className="ai-card-top"><span className="ai-card-icon"><ScanSearch size={24} aria-hidden="true"/></span><AITag kind={demo?"demo":!rag?"unknown":rag.semantic?"ai":"rules"} locale={locale}/></div><h4>{t.retrieval}</h4><p>{t.retrievalHint}</p>
        <div className="ai-card-engine"><small>{demo?ai.demo:rag?.embeddingModel||ai.unknown}</small><code>{demo?"browser fixtures":rag?`${rag.vectorStore} · BM25`:ai.notReported}</code></div>
        <button className="button-secondary" onClick={() => navigate("studio")}>{t.retrievalAction}<ArrowUpRight size={15}/></button>
      </article>
      <article className="surface workspace-ai-card">
        <div className="ai-card-top"><span className="ai-card-icon"><MessageSquareText size={24} aria-hidden="true"/></span><AITag kind={chat.kind} locale={locale}/></div><h4>{t.nova}</h4><p>{t.novaHint}</p>
        <div className="ai-card-engine"><small>{chat.engine}</small><code>{chat.model}</code></div>
        <button className="button-primary" onClick={openNova}>{t.novaAction}<ArrowUpRight size={15}/></button>
      </article>
    </div>
    <AIWorkflowLegend locale={locale}/><p className="ai-configuration-note"><ShieldCheck size={13}/>{ai.notLive}</p>
  </section><AIDashboardStats locale={locale} documents={documents} capabilities={capabilities} demo={demo}/><WorkspaceAICatalog locale={locale} demo={demo} capabilities={capabilities} navigate={navigate} openNova={openNova} openTrust={openTrust}/></>;
}
