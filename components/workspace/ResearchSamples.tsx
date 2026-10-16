"use client";
import {useState} from 'react';
import {FileText,ArrowUpRight} from 'lucide-react';
import {ModalSurface} from './ModalSurface';
import type {DocumentDomain} from '@/lib/document-domains';
const samples={insurance:['insurance-policy-fictional.pdf','insurance-claim-fictional.pdf'],general:['invoice-fictional.pdf'],banking:[]} as const;
const copy={
  en:{title:'Fictional research samples',hint:'Original synthetic PDFs, not real policies or invoices. Preview first; analysis sends the selected file to the configured document provider.',preview:'Preview PDF',analyze:'Analyze this sample',confirm:'I confirm analysis of this fictional PDF',cancel:'Cancel',error:'Could not load the sample. Check the service and retry.'},
  de:{title:'Fiktive Forschungsmuster',hint:'Eigene synthetische PDFs, keine echten Policen oder Rechnungen. Zuerst ansehen; Analyse sendet die Datei an den konfigurierten Dokumentanbieter.',preview:'PDF ansehen',analyze:'Muster analysieren',confirm:'Analyse dieses fiktiven PDFs bestätigen',cancel:'Abbrechen',error:'Muster konnte nicht geladen werden. Dienst prüfen und erneut versuchen.'},
  vi:{title:'Tài liệu nghiên cứu giả lập',hint:'PDF tự tạo, không phải hợp đồng bảo hiểm hay hóa đơn thật. Xem trước; khi xác nhận, tệp được gửi tới dịch vụ phân tích tài liệu đang cấu hình.',preview:'Xem PDF',analyze:'Phân tích mẫu này',confirm:'Tôi xác nhận phân tích PDF giả lập này',cancel:'Hủy',error:'Không tải được mẫu. Kiểm tra dịch vụ rồi thử lại.'},
};
export function ResearchSamples({domain,locale,disabled,analyze}:{domain:DocumentDomain;locale:string;disabled:boolean;analyze:(file:File)=>Promise<void>}) {
  const t=copy[locale==='de'?'de':locale==='vi'?'vi':'en'];
  const [selected,setSelected]=useState<string>(),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  async function submit(){if(!selected||busy)return;setBusy(true);setError(false);try{const response=await fetch(`/samples/${selected}`,{cache:'no-store'});if(!response.ok)throw new Error();const blob=await response.blob();await analyze(new File([blob],selected,{type:'application/pdf'}));setSelected(undefined);}catch{setError(true);}finally{setBusy(false);}}
  return <section className="research-samples"><header><span className="eyebrow">SYNTHETIC / NOT DATEV</span><h3>{t.title}</h3><p>{t.hint}</p></header><div>{samples[domain].map(file=><article key={file}><FileText size={22}/><strong>{file}</strong><a className="button-secondary" href={`/samples/${file}`} target="_blank" rel="noopener noreferrer">{t.preview}<ArrowUpRight size={15}/></a><button type="button" className="button-primary" disabled={disabled||busy} onClick={()=>setSelected(file)}>{t.analyze}</button></article>)}</div>{selected?<ModalSurface title={t.analyze} close={()=>{if(!busy)setSelected(undefined);}} label={t.cancel}><p>{t.hint}</p><p className="my-4 font-semibold">{selected}</p>{error?<p role="alert" className="notice-error">{t.error}</p>:null}<div className="flex flex-wrap gap-3"><button type="button" disabled={busy} className="button-primary" onClick={()=>void submit()}>{t.confirm}</button><button type="button" disabled={busy} className="button-secondary" onClick={()=>setSelected(undefined)}>{t.cancel}</button></div></ModalSurface>:null}</section>;
}
