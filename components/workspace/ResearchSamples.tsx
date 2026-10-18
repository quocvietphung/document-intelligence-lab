"use client";
import {useEffect,useRef,useState} from 'react';
import {FileText,ArrowUpRight,ShieldCheck} from 'lucide-react';
import {useAuth} from '@/components/auth/KeycloakProvider';
import {ModalSurface} from './ModalSurface';
import {PdfPreview} from './PdfPreview';
import type {DocumentDomain} from '@/lib/document-domains';
import {researchSamples,researchSampleLabels,researchSampleUrl,researchSampleScope,type ResearchSample} from '@/lib/research-samples';
import {activeDocumentJob,completedJobDocument,sampleDocumentJob,type DocumentJob} from '@/lib/document-results';
import type {CreditDocument} from '@/lib/credit-data';

export function ResearchSamples({domain,locale,disabled,analyze,azure=false,jobs=[],documents=[],openResult,showProgress}:{domain:DocumentDomain;locale:string;disabled:boolean;analyze:(file:string)=>Promise<void>;azure?:boolean;jobs?:readonly DocumentJob[];documents?:readonly CreditDocument[];openResult?:(doc:CreditDocument)=>void;showProgress?:()=>void}) {
  const t=researchSampleLabels(locale),auth=useAuth(),samples=researchSamples(domain);
  const [selected,setSelected]=useState<ResearchSample>(),[preview,setPreview]=useState<ResearchSample>(),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  const [available,setAvailable]=useState<string[]|undefined>();
  const [query,setQuery]=useState('');const accepting=useRef(false);
  useEffect(()=>{
    if(!auth.token||auth.mode==='demo')return;
    const controller=new AbortController();
    void fetch(`/api/research-references?domain=${domain}`,{headers:{Authorization:`Bearer ${auth.token}`},cache:'no-store',signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error();
      const data=await response.json() as {references?:{id:string;available:boolean}[]};
      if(!Array.isArray(data.references))throw new Error();
      if(!controller.signal.aborted)setAvailable(data.references.filter(row=>row.available===true).map(row=>row.id));
    }).catch(()=>{if(!controller.signal.aborted){setError(true);setAvailable([]);}});
    return()=>controller.abort();
  },[domain,auth.token,auth.mode]);
  async function submit(){if(!selected||accepting.current)return;accepting.current=true;setBusy(true);setError(false);try{await analyze(selected.file);setSelected(undefined);}catch{setError(true);}finally{accepting.current=false;setBusy(false);}}
  const visible=samples.filter(sample=>`${sample.title} ${sample.publisher} ${sample.language} ${sample.file}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="research-samples" id="research-library" data-page-tour="research-library"><header><h3>{t.title}</h3><p>{t.hint}</p></header>
    {error?<p role="alert" className="notice-error">{t.error}</p>:null}
    <label className="research-library-search">{t.search}<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={t.search}/></label><p className="lab-caption" role="status">{visible.length} / {samples.length} · {t.kaggle}</p>
    <div>{visible.map(sample=>{
      const ready=available?.includes(sample.id),job=sampleDocumentJob(sample.file,jobs),result=completedJobDocument(job,documents);
      return <article key={sample.id} className="research-sample-card"><div className="research-sample-heading"><FileText size={22}/><div><span className="eyebrow">{t.kaggle} · {sample.synthetic?t.synthetic:t.publisher}</span><h4>{sample.title}</h4><small>{sample.file}</small></div></div>
        <p>{sample.language} · {sample.jurisdiction} · {t.pages}: {sample.sourcePages.join(', ')}</p><p>{researchSampleScope(sample,locale)}</p><details><summary><ShieldCheck size={14}/>{t.provenance}</summary><p>{sample.publisher} · {sample.kaggleLicense} · {t.version} {sample.datasetVersion}</p><p>{sample.synthetic?t.syntheticRights:t.rights}</p><a className="button-link" href={sample.sourceUrl} target="_blank" rel="noopener noreferrer">{t.source}<ArrowUpRight size={14}/></a></details>
        <div className="research-sample-actions"><button type="button" className="button-secondary" disabled={!ready||busy} onClick={()=>setPreview(sample)}>{t.preview}</button>
          {result&&openResult?<button type="button" className="button-primary" onClick={()=>openResult(result)}>{t.existing}</button>:job&&activeDocumentJob(job)&&showProgress?<button type="button" className="button-primary" onClick={showProgress}>{t.processing}</button>:<button type="button" className="button-primary" disabled={disabled||busy||!ready} onClick={()=>setSelected(sample)}>{t.analyze}</button>}
        </div>{!ready?<p role="status">{available===undefined&&auth.token?t.loading:t.missing}</p>:null}
      </article>;
    })}</div>
    {!visible.length?<p role="status">{t.noMatches}</p>:null}
    {preview?<ModalSurface wide title={preview.title} close={()=>setPreview(undefined)} label={t.cancel}><p className="notice-lab">{researchSampleScope(preview,locale)} {t.mapped}: {preview.sourcePages.map((page,index)=>`${index+1} → ${page}`).join(' · ')}</p><PdfPreview locale={locale} token={auth.token} url={researchSampleUrl(preview)}/></ModalSurface>:null}
    {selected?<ModalSurface title={t.confirm} close={()=>{if(!busy)setSelected(undefined);}} label={t.cancel}><h3>{selected.title}</h3><p className="notice-lab">{azure?t.cloud:t.local}</p><p className="my-4 text-sm leading-relaxed">{researchSampleScope(selected,locale)}</p><p className="text-xs leading-relaxed">{t.mapped}: {selected.sourcePages.map((page,index)=>`${index+1} → ${page}`).join(' · ')}</p>{error?<p role="alert">{t.error}</p>:null}<div className="research-sample-actions"><button type="button" disabled={busy} className="button-primary" onClick={()=>void submit()}>{t.send}</button><button type="button" disabled={busy} className="button-secondary" onClick={()=>setSelected(undefined)}>{t.cancel}</button></div></ModalSurface>:null}
  </section>;
}
