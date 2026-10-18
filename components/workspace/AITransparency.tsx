"use client";
import {ArrowUpRight,ChevronDown,Info,ShieldCheck,Sparkles} from "lucide-react";
import {aiText,chatEngine,documentAI,pageAIKind,type AICapabilities,type AIKind} from "@/lib/ai-capabilities";
import type {CreditDocument} from "@/lib/credit-data";
import type {WorkspaceTab} from "@/lib/nova-guide";
import {researchText} from '@/lib/document-research';

export function AITag({kind,locale,label}:{kind:AIKind;locale:string;label?:string}) {
  const t=aiText(locale),Icon=kind==="ai"?Sparkles:kind==="rules"?ShieldCheck:Info;
  return <span className={`ai-tag ai-tag-${kind}`} data-ai-kind={kind}><Icon size={12} aria-hidden="true"/>{label||t[kind]}</span>;
}

export function AIDocumentBadge({doc,locale,compact=false}:{doc:CreditDocument;locale:string;compact?:boolean}) {
  const value=documentAI(doc,locale);
  return <div className={`ai-document-origin ${compact?"ai-origin-compact":""}`}><AITag kind={value.kind} locale={locale} label={value.engine}/><code>{value.model}</code>{!compact?<p>{value.hint}</p>:null}</div>;
}

export function AIChatIdentity({capabilities,locale,demo=false,mode}:{capabilities?:AICapabilities;locale:string;demo?:boolean;mode?:string}) {
  const t=aiText(locale),value=chatEngine(capabilities,locale,demo);
  const response=mode==="app-guide"?t.localGuide:mode?.includes("guard")?t.guard:mode==="synthetic-demo"?t.demo:mode==="azure-entra"?`Azure OpenAI · ${value.model}`:undefined;
  return <div className="ai-chat-identity"><div><AITag kind={value.kind} locale={locale} label={value.engine}/><code>{value.model}</code></div><small>{response?`${t.actualReply}: ${response}`:value.kind==="ai"?t.configured:value.kind==="unknown"?t.unknown:t.demoHint}</small></div>;
}

export function AIPageBanner({page,locale,capabilities,demo=false,ask}:{page:WorkspaceTab;locale:string;capabilities?:AICapabilities;demo?:boolean;ask:(question:string)=>void}) {
  const t=aiText(locale),doc=capabilities?.documents,rag=capabilities?.retrieval;
  let kind=pageAIKind(page),engine:string,model:string,hint:string,title:string;
  if(page==="documents"||page==="pipeline"){
    const identity=documentAI({analysisProvider:doc?.configured?doc.provider:undefined,modelId:doc?.modelId,status:'review'},locale);
    kind=demo?"demo":identity.kind;engine=demo?t.demo:identity.engine;
    model=doc?.modelId||t.notReported;hint=demo?t.demoHint:identity.hint;title=t[page==="documents"?"source":"pipeline"];
  }else if(page==="studio"){
    kind=demo?"demo":!rag?"unknown":rag.semantic?"ai":"rules";engine=demo?t.demo:rag?.embeddingModel||t.unknown;
    model=demo?"browser fixtures":rag?`${rag.vectorStore} · BM25 · feature ranking`:t.notReported;hint=demo?t.demoHint:t.searchHint;title=t.search;
  }else if(page==='experiments'){
    const research=researchText(locale);kind='rules';engine='Java · source-bound evaluation';model='source-evaluation-v1';title=research('experiments');hint=research('notJudge');
  }else{
    engine=page==="controls"?"Java · deterministic rules":page==="evaluation"||page==="banking"?"PDF · source evidence":"Java · configuration / audit";
    model=t.human;hint=page==="evaluation"?t.qualityHint:page==="controls"?t.rulesHint:t.reviewHint;
    title=t[page==="controls"?"controls":page==="evaluation"?"quality":page==="banking"?"banking":page==="operations"?"operations":"audit"];
  }
  return <details className={`ai-page-disclosure ai-banner-${kind}`} aria-label={t.engines}>
    <summary><AITag kind={kind} locale={locale}/><span className="ai-context-text"><span>{title}</span><strong>{engine}</strong></span><span className="ai-context-toggle">{t.how}<ChevronDown size={14}/></span></summary>
    <div className="ai-context-details"><p>{hint}</p><code>{model}</code><p>{t.notLive}</p>{page==="studio"&&rag?.semantic?<p>{t.languageHint}</p>:null}<p>{t.reviewHint}</p><button className="button-secondary" onClick={()=>ask(`${t.pageRequest} ${title}. ${hint}`)}><Sparkles size={15}/>{t.ask}<ArrowUpRight size={14}/></button></div>
  </details>;
}
