"use client";
import {Building2,FileStack,ShieldCheck,ArrowUpRight,FileSearch} from 'lucide-react';
import {documentDomains,domainOf,domainText,type DocumentDomain} from '@/lib/document-domains';
import {workspaceText} from '@/lib/workspace-language';
import type {WorkspaceCase} from '@/lib/credit-api';
import type {CreditDocument} from '@/lib/credit-data';
const icons={banking:Building2,insurance:ShieldCheck,general:FileStack};
export function DocumentDomains({locale,cases,value,onChange}:{locale:string;cases:readonly WorkspaceCase[];value:DocumentDomain|'all';onChange:(value:DocumentDomain|'all')=>void}) {
  const t=domainText(locale);
  return <section className="document-domains" aria-labelledby="document-domains-title">
    <header><div><span className="eyebrow">DOCUMENT INTELLIGENCE LAB</span><h1 id="document-domains-title">{t.title}</h1><p>{t.subtitle}</p></div><button type="button" className="button-secondary" aria-pressed={value==='all'} onClick={()=>onChange('all')}>{t.all} · {cases.length}</button></header>
    <div className="document-domain-grid">{documentDomains.map(domain=>{const Icon=icons[domain];const count=cases.filter(c=>domainOf(c.domain)===domain).length;return <button type="button" key={domain} className={`document-domain-card ${value===domain?'domain-selected':''}`} aria-pressed={value===domain} onClick={()=>onChange(domain)}><span className="domain-card-heading"><Icon size={22}/><strong>{t[domain]}</strong><ArrowUpRight size={16}/></span><span>{t[`${domain}Hint`]}</span><small>{count} {t.count}</small></button>;})}</div>
  </section>;
}
export function DomainResearch({locale,item,inspect,ask}:{locale:string;item:WorkspaceCase;inspect:(document:CreditDocument)=>void;ask:(question:string)=>void}) {
  const t=domainText(locale),w=workspaceText(locale),domain=domainOf(item.domain),docs=item.documents.filter(doc=>doc.originalAvailable);
  return <section className="surface domain-research"><header data-page-tour="banking-documents"><span className="eyebrow">{t[domain]}</span><h2>{t.research}</h2><p data-page-tour="banking-originals">{t[`${domain}Required`]}</p></header><div className="metrics-grid">{[[t.originals,docs.length],[t.fields,docs.reduce((n,d)=>n+(d.fields?.length||0),0)],[t.types,new Set(docs.map(d=>d.type)).size]].map(([label,count])=><div className="metric" key={label}><span>{label}</span><strong>{count}</strong></div>)}</div>
    <div data-page-tour="banking-results">{!docs.length?<p className="domain-empty">{t.empty}</p>:<div className="domain-source-grid">{docs.map(doc=><article key={doc.id}><FileSearch size={22}/><span className="eyebrow">{w(doc.type)}</span><h3>{doc.name}</h3><p>{doc.analysisProvider} · {doc.modelId}</p><dl>{doc.fields?.slice(0,6).map((field,index)=><div key={index}><dt>{w(field.label)}</dt><dd>{field.value}</dd></div>)}</dl><button type="button" className="button-secondary" onClick={()=>inspect(doc)}>{t.evidence}<ArrowUpRight size={15}/></button><button type="button" className="button-link" onClick={()=>ask(`${t.question}\n${doc.name} [${doc.id}:p1]`)}>{t.ask}</button></article>)}</div>}</div>
    <p className="notice-lab">{t.boundary}</p>
  </section>;
}
