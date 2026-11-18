"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {Building2,FileCheck2,FileText,ReceiptText} from "lucide-react";
import {useAuth} from "@/components/auth/KeycloakProvider";
import type {CreditDocument} from "@/lib/credit-data";
import {activeDocumentJob,completedJobDocument,sampleDocumentJob,type DocumentJob} from "@/lib/document-results";
import {kaggleReferences} from "@/lib/research-samples";

const recruiterSampleIds=[
  "real-estate-construction-order",
  "real-estate-change-order",
  "real-estate-construction-invoice",
  "real-estate-acceptance-report",
  "real-estate-site-minutes",
  "invoice-51109301",
  "invoice-51109302",
  "invoice-51109303",
  "invoice-51109304",
  "principal-life-definitions",
] as const;

const copy={
  en:{eyebrow:"10 ready-to-run PDFs",title:"Run Document Intelligence on a sample",hint:"Choose one document. SmashLab queues extraction, preserves the source pages and makes the result available to Nova.",run:"Run extraction",open:"Open result",progress:"View progress",loading:"Checking local samples…",missing:"Not prepared locally",error:"The sample library is unavailable.",local:"Local extraction",azure:"Azure Document Intelligence",realEstate:"Construction dossier",general:"Invoice",insurance:"Policy wording",count:"10 focused samples"},
  de:{eyebrow:"10 startbereite PDFs",title:"Document Intelligence mit einem Beispiel starten",hint:"Wählen Sie ein Dokument. Die Extraktion wird eingeplant, die Quellseiten bleiben erhalten und Nova kann das Ergebnis verwenden.",run:"Extraktion starten",open:"Ergebnis öffnen",progress:"Fortschritt ansehen",loading:"Lokale Beispiele werden geprüft…",missing:"Lokal nicht vorbereitet",error:"Die Beispielbibliothek ist nicht verfügbar.",local:"Lokale Extraktion",azure:"Azure Document Intelligence",realEstate:"Bauakte",general:"Rechnung",insurance:"Versicherungsbedingungen",count:"10 fokussierte Beispiele"},
  vi:{eyebrow:"10 PDF chạy ngay",title:"Chạy Document Intelligence trên một mẫu",hint:"Chọn một tài liệu. Hệ thống đưa vào hàng đợi trích xuất, giữ nguyên trang nguồn và cung cấp kết quả cho Nova.",run:"Chạy trích xuất",open:"Mở kết quả",progress:"Xem tiến độ",loading:"Đang kiểm tra mẫu local…",missing:"Chưa chuẩn bị local",error:"Không tải được thư viện mẫu.",local:"Trích xuất local",azure:"Azure Document Intelligence",realEstate:"Hồ sơ xây dựng",general:"Hóa đơn",insurance:"Điều khoản bảo hiểm",count:"10 mẫu trọng tâm"},
} as const;

type Props={
  locale:string;
  disabled:boolean;
  azure:boolean;
  jobs:readonly DocumentJob[];
  documents:readonly CreditDocument[];
  analyze:(file:string)=>Promise<void>;
  openResult:(doc:CreditDocument)=>void;
  showProgress:()=>void;
};

export function RecruiterSampleGallery({locale,disabled,azure,jobs,documents,analyze,openResult,showProgress}:Props){
  const auth=useAuth();
  const t=copy[locale==="vi"?"vi":locale==="de"?"de":"en"];
  const samples=useMemo(()=>recruiterSampleIds.map(id=>kaggleReferences.find(sample=>sample.id===id)).filter((sample):sample is (typeof kaggleReferences)[number]=>Boolean(sample)),[]);
  const [available,setAvailable]=useState<Set<string>>();
  const [error,setError]=useState(false);
  const [running,setRunning]=useState<string>();
  const accepting=useRef(false);

  useEffect(()=>{
    if(!auth.token||auth.mode==="demo")return;
    const controller=new AbortController();
    void fetch("/api/research-references",{headers:{Authorization:`Bearer ${auth.token}`},cache:"no-store",signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error();const data=await response.json() as {references?:{id:string;available:boolean}[]};if(!Array.isArray(data.references))throw new Error();if(!controller.signal.aborted)setAvailable(new Set(data.references.filter(row=>row.available).map(row=>row.id)));})
      .catch(()=>{if(!controller.signal.aborted){setAvailable(new Set());setError(true);}});
    return()=>controller.abort();
  },[auth.mode,auth.token]);

  async function run(file:string){
    if(accepting.current)return;
    accepting.current=true;setRunning(file);setError(false);
    try{await analyze(file);}catch{setError(true);}finally{accepting.current=false;setRunning(undefined);}
  }

  return <section className="recruiter-samples" id="recruiter-samples" data-page-tour="dashboard-samples" aria-labelledby="recruiter-samples-title">
    <header><div><span className="eyebrow">{t.eyebrow}</span><h2 id="recruiter-samples-title">{t.title}</h2><p>{t.hint}</p></div><span className="recruiter-sample-count">{t.count}</span></header>
    {error?<p className="notice-error" role="alert">{t.error}</p>:null}
    <div className="recruiter-sample-grid">{samples.map((sample,index)=>{
      const job=sampleDocumentJob(sample.file,jobs),result=completedJobDocument(job,documents),active=Boolean(job&&activeDocumentJob(job));
      const ready=available?.has(sample.id)===true;
      const Icon=sample.domain==="real-estate"?Building2:sample.domain==="general"?ReceiptText:FileText;
      const kind=sample.domain==="real-estate"?t.realEstate:sample.domain==="general"?t.general:t.insurance;
      return <article className="recruiter-sample-card" key={sample.id}>
        <div className="recruiter-sample-index">{String(index+1).padStart(2,"0")}</div><Icon size={19} aria-hidden="true"/>
        <div className="recruiter-sample-copy"><small>{kind}</small><strong>{sample.title}</strong><span>{sample.file}</span></div>
        {result?<button type="button" className="button-primary" onClick={()=>openResult(result)}><FileCheck2 size={15}/>{t.open}</button>:active?<button type="button" className="button-primary" onClick={showProgress}>{t.progress}</button>:<button type="button" className="button-secondary" disabled={disabled||running===sample.file||!ready} onClick={()=>void run(sample.file)}>{available===undefined?t.loading:ready?(azure?t.azure:t.run):t.missing}</button>}
      </article>;
    })}</div>
    <p className="recruiter-sample-mode">{azure?t.azure:t.local}</p>
  </section>;
}
