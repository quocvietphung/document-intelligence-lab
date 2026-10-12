"use client";
import {useState,useEffect} from "react";
import {FileText,Upload,ExternalLink} from "lucide-react";
import {useAuth} from "@/components/auth/KeycloakProvider";
import {datevReferences,datevLabels,officialPayrollReference} from "@/lib/datev-reference";
import {documentText} from "@/lib/document-language";
import {PdfPreview} from "./PdfPreview";
import {ModalSurface} from "./ModalSurface";
export function PayrollSamples({locale,busy,canImport,importSample,azure=false}:{locale:string;busy:boolean;canImport:boolean;importSample:(file:string)=>Promise<void>;azure?:boolean}) {
  const t=datevLabels(locale),d=documentText(locale),auth=useAuth();
  const [available,setAvailable]=useState<string[]>([]);
  const [preview,setPreview]=useState<string>();
  const [confirm,setConfirm]=useState<typeof datevReferences[number]>();
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    if(auth.mode==="demo"||!auth.token)return;
    const controller=new AbortController();
    void fetch("/api/payroll-references",{headers:{Authorization:`Bearer ${auth.token}`},cache:"no-store",signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error();
      const data=await response.json();
      if(!Array.isArray(data.references))throw new Error();
      if(!controller.signal.aborted)setAvailable(data.references.filter((row:{id:string;available:boolean})=>row.available&&datevReferences.some(s=>s.id===row.id)).map((r:{id:string})=>r.id));
    }).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return()=>controller.abort();
  },[auth.mode,auth.token]);
  return <section className="payroll-samples" id="datev-library"><header><FileText size={20}/><div><h3>{t.title}</h3><p>{t.hint}</p></div></header>
    {failed?<p className="notice-error" role="alert">{t.error}</p>:null}
    <div className="payroll-sample-grid">{datevReferences.map(sample=><article key={sample.id}><span className="eyebrow">DATEV LODAS · 2025</span><h4>{sample.name}</h4><small>{t.page} {sample.publisherPage} · {t.reference}</small><dl><dt>{t.net}</dt><dd>{sample.net}</dd><dt>{t.payout}</dt><dd>{sample.payout}</dd></dl><div><button className="button-secondary" disabled={!available.includes(sample.id)} onClick={()=>setPreview(sample.id)}>{t.preview}</button><button className="button-primary" disabled={!canImport||busy||!available.includes(sample.id)} onClick={()=>setConfirm(sample)}><Upload size={15}/>{t.import}</button></div>{!available.includes(sample.id)?<p className="lab-caption">{t.unavailable}</p>:null}<a className="button-link" href={officialPayrollReference+`#page=${sample.publisherPage}`} target="_blank" rel="noopener noreferrer">{t.source}<ExternalLink size={13}/></a></article>)}</div>
    {preview?<ModalSurface title={t.title} close={()=>setPreview(undefined)} label={d("close")}><p className="notice-lab mb-5">{t.badge}</p><PdfPreview locale={locale} token={auth.token} url={`/api/payroll-references?sample=${preview}`}/></ModalSurface>:null}
    {confirm?<ModalSurface title={t.confirm} close={()=>{if(!busy)setConfirm(undefined);}} label={t.cancel}><p className="notice-lab">{azure?t.azure:t.local}</p><h3 className="mt-4 font-bold">{confirm.name}</h3><p className="my-4 text-sm leading-relaxed">{t.consent}</p><div className="flex justify-end gap-2"><button className="button-secondary" disabled={busy} onClick={()=>setConfirm(undefined)}>{t.cancel}</button><button className="button-primary" disabled={busy} onClick={()=>{void importSample(confirm.file).finally(()=>setConfirm(undefined));}}>{busy?d("analyzingLocal"):t.send}</button></div></ModalSurface>:null}
  </section>;
}
