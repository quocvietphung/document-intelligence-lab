"use client";
import {useEffect,useState} from 'react';
import {ArrowUpRight,BrainCircuit,ChevronDown,ClipboardCheck,FileSearch,FileText,Layers3,Mail,MessageSquareText,ScanSearch,Search,ShieldCheck,SlidersHorizontal,Sparkles} from 'lucide-react';
import {dashboardEngine,dashboardFeatures,dashboardGroups,filteredDashboardFeatures,type DashboardFilter,type DashboardFeature} from '@/lib/ai-dashboard';
import {catalogGroupOf,featureFromSearch,fill,usabilityText} from '@/lib/workspace-usability';
import {dashboardText} from '@/lib/ai-dashboard-language';
import {aiText,type AICapabilities} from '@/lib/ai-capabilities';
import type {WorkspaceTab} from '@/lib/nova-guide';
import type {TrustSection} from '@/lib/nova-trust';
import {AITag} from './AITransparency';
import {workspacePresentation} from '@/lib/workspace-presentation';
import {workflowPdfExample} from '@/lib/ai-pdf-examples';
import {AIPdfExample} from './AIPdfExample';
import {classificationText} from '@/lib/document-classification-language';

const icons:Record<DashboardFeature['id'],typeof FileSearch>={anomaly:BrainCircuit,timeline:FileText,obligations:ClipboardCheck,'privacy-review':ShieldCheck,document:FileSearch,tables:Layers3,search:ScanSearch,nova:MessageSquareText,summary:FileText,reconcile:SlidersHorizontal,explain:BrainCircuit,'request-documents':Mail,'review-checklist':ClipboardCheck,terminology:FileText,'bilingual-summary':MessageSquareText,validation:ShieldCheck,'dossier-reconciliation':SlidersHorizontal,quality:Sparkles,review:ClipboardCheck,transparency:ShieldCheck,embeddings:Layers3,'field-explanation':BrainCircuit,classification:FileSearch,'field-profiles':SlidersHorizontal,batches:Layers3,lineage:FileSearch,experiments:Sparkles,citations:ClipboardCheck,feedback:MessageSquareText,governance:ShieldCheck,performance:SlidersHorizontal,'app-guide':MessageSquareText,'injection-guard':ShieldCheck};
export function WorkspaceAICatalog({locale,demo,capabilities,navigate,openNova,openTrust,caseId}:{locale:string;demo:boolean;capabilities?:AICapabilities;navigate:(page:WorkspaceTab)=>void;openNova:()=>void;openTrust?:(section:TrustSection)=>void;caseId?:string}){
  const {labels:t,features:copy}=dashboardText(locale),ai=aiText(locale);
  const presentation=workspacePresentation(locale);
  const u=usabilityText(locale);
  const [filter,setFilter]=useState<DashboardFilter>('all'),[query,setQuery]=useState(''),[expanded,setExpanded]=useState(false),[focus,setFocus]=useState<string>();
  // A direct link (?feature=<id>) opens the catalog at the group that holds the feature and scrolls to it.
  useEffect(()=>{const id=featureFromSearch(window.location.search);if(!id)return;const timer=window.setTimeout(()=>{setFocus(id);setExpanded(true);const url=new URL(window.location.href);url.searchParams.delete('feature');window.history.replaceState(window.history.state,'',url);},0);return()=>window.clearTimeout(timer);},[]);
  useEffect(()=>{if(!focus)return;const timer=window.setTimeout(()=>document.querySelector(`[data-ai-feature="${focus}"]`)?.scrollIntoView({block:'center'}),600);return()=>window.clearTimeout(timer);},[focus]);
  const searching=!!query.trim()||filter!=='all',showList=expanded||searching,focusGroup=focus?catalogGroupOf(focus):undefined;
  const visible=filteredDashboardFeatures(filter,query,copy,capabilities,demo);
  const counts={ai:dashboardFeatures.filter(f=>f.category==='ai').length,control:dashboardFeatures.filter(f=>f.category==='control').length};
  const cloud=locale==='vi'?{title:'Tích hợp AI tùy chọn · thiết lập riêng',hint:'Đã có adapter Blob, ADF, đánh giá Azure, giám sát, Nova local và model mã nguồn mở. Cần cấu hình và kiểm thử thực tế từng dịch vụ; không tự bật, tải model hay gửi dữ liệu khi mở trang.',open:'Xem nguồn & cấu hình tích hợp'}:locale==='de'?{title:'Optionale KI-Integrationen · separate Einrichtung',hint:'Adapter für Blob, ADF, Azure-Evaluierung, Monitoring, lokales Nova und offene Modelle sind vorhanden. Einrichtung und Live-Tests bleiben erforderlich. Kein automatischer Modell-Download oder Datentransfer beim Öffnen.',open:'Quellen & Konfiguration ansehen'}:{title:'Optional AI integrations · operator setup',hint:'Adapters cover Blob, ADF, Azure evaluation, monitoring, local Nova and open models. Each needs explicit configuration and live verification. Opening this page does not activate providers, download weights or send documents.',open:'Inspect sources & integration setup'};
  function openPage(page:WorkspaceTab,panel?:'processing'|'batches'|'assets'){const url=new URL(window.location.href);if(panel)url.searchParams.set('pipeline',panel);else url.searchParams.delete('pipeline');window.history.replaceState(null,'',url);navigate(page);}
  function action(feature:DashboardFeature){if('page' in feature.target)openPage(feature.target.page,'panel' in feature.target?feature.target.panel:undefined);else if('nova' in feature.target)openNova();else if(openTrust)openTrust(feature.target.trust);else navigate('controls');}
  function row(feature:DashboardFeature){const Icon=icons[feature.id],engine=dashboardEngine(feature,capabilities,demo),target=feature.target;
    const destination=feature.engine==='human'?t.human:feature.engine==='guide'?ai.localGuide:feature.engine==='rules'?`Java · ${ai.rules}`:engine.provider==='unknown'?t.unknown:engine.provider==='demo'?t.demo:engine.provider;
    const label='page' in target?t.open:'nova' in target?t.nova:target.trust==='library'?t.library:t.trust;
    const parameters=new URLSearchParams();if(caseId)parameters.set('case',caseId);if('panel' in target)parameters.set('pipeline',target.panel);
    return <article className={`ai-directory-row${focus===feature.id?' ai-directory-focus':''}`} key={feature.id} data-ai-feature={feature.id}>
      <span className={`ai-directory-icon ${feature.category==='control'?'ai-directory-control':''}`}><Icon size={21} aria-hidden="true"/></span>
      <div className="ai-directory-description"><div><h3>{copy[feature.id][0]}</h3><AITag kind={engine.kind} locale={locale}/></div><p>{copy[feature.id][1]}</p><AIPdfExample example={workflowPdfExample(feature.id,locale)} locale={locale} open={()=>openPage(feature.id==='classification'?'experiments':'documents')} hint={feature.id==='classification'?classificationText(locale).scope:undefined} openLabel={feature.id==='classification'?classificationText(locale).title:undefined}/></div>
      <details className="ai-directory-engine"><summary>{destination}</summary>{engine.model?<code>{engine.model==='not-reported'?ai.notReported:engine.model}</code>:null}<small>{demo?t.demo:feature.category==='control'?t.rules:engine.configured?t.configuration:t.unknown}</small></details>
      {'page' in target?<a className="ai-directory-link" href={`${parameters.size?`?${parameters}`:''}#${target.page}`} aria-label={`${label} · ${copy[feature.id][0]}`} onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();action(feature);}}>{label}<ArrowUpRight size={16}/></a>:<button type="button" className="ai-directory-link" onClick={()=>action(feature)} disabled={demo&&'trust' in target} aria-label={`${label} · ${copy[feature.id][0]}`}>{label}<ArrowUpRight size={16}/></button>}
    </article>;
  }
  return <section className="ai-directory surface" aria-labelledby="ai-directory-title">
    <header className="ai-directory-heading"><div><span className="eyebrow"><BrainCircuit size={14}/>{locale==='vi'?'DANH MỤC AI':locale==='de'?'KI-FUNKTIONEN':'AI CAPABILITIES'}</span><h2 id="ai-directory-title">{t.title}</h2><p>{t.intro}</p></div><span className="ai-directory-total" title={fill(u.catalogCount,{count:dashboardFeatures.length})}>{String(dashboardFeatures.length).padStart(2,'0')}</span></header>
    <div className="ai-directory-toolbar"><div className="ai-directory-search"><Search size={17}/><input type="search" maxLength={150} aria-label={t.search} placeholder={t.search} value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="ai-directory-filters" role="group" aria-label={t.category}>{(['all','ai','control'] as const).map(key=><button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{t[key]}</button>)}</div></div>
    <div className="ai-directory-summary"><span>{counts.ai} · {t.ai}</span><span>{counts.control} · {t.control}</span><span role="status">{t.showing.replace('{count}',String(visible.length)).replace('{total}',String(dashboardFeatures.length))}</span><button type="button" className="button-secondary ai-directory-toggle" aria-expanded={showList} aria-controls="ai-directory-groups" disabled={searching} onClick={()=>setExpanded(value=>!value)}>{showList?u.catalogHide:u.catalogShow}</button></div>
    <p className="ai-directory-count">{fill(u.catalogCount,{count:dashboardFeatures.length})}</p>
    <div className="ai-directory-groups" id="ai-directory-groups" hidden={!showList}>{dashboardGroups.map(group=>{const ids:readonly string[]=group.features,features=visible.filter(feature=>ids.includes(feature.id));return features.length?<details key={group.id} data-ai-group={group.id} className="ai-directory-group" open={searching||group.id===focusGroup?true:undefined}><summary><strong>{presentation[group.id]}</strong><span>{features.length}</span><ChevronDown size={16}/></summary><div className="ai-directory-list">{features.map(row)}</div></details>:null;})}</div>
    {!visible.length?<div className="ai-directory-empty"><Search size={25}/><p>{t.empty}</p><button className="button-secondary" onClick={()=>{setQuery('');setFilter('all');}}>{t.reset}</button></div>:null}
    <details className="ai-cloud-boundary ai-cloud-boundary-compact"><summary>{cloud.title}</summary><p>{cloud.hint}</p><button className="button-secondary" onClick={()=>openPage('pipeline','assets')}>{cloud.open}<ArrowUpRight size={15}/></button></details>
    <footer><ShieldCheck size={17}/><p>{t.safety}<br/>{t.limit}</p></footer>
  </section>;
}
