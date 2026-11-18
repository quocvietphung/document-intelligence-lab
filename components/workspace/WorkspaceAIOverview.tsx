"use client";

import {Activity,ArrowRight,FileCheck2,FileSearch,MessageSquareText,Microscope} from "lucide-react";
import type {CreditDocument} from "@/lib/credit-data";
import {chatEngine,documentAI,type AICapabilities} from "@/lib/ai-capabilities";
import type {WorkspaceTab} from "@/lib/nova-guide";

const copy={
  en:{eyebrow:"Recruiter-ready product story",title:"From 10 sample PDFs to traceable AI answers",description:"A focused Document Intelligence demo: extract fields and tables, inspect the original page, then ask Nova with citations.",step1:"1 · Run a sample",step1Hint:"Choose one of 10 prepared PDFs and start extraction.",step2:"2 · Inspect evidence",step2Hint:"Open fields, tables and the exact source page.",step3:"3 · Ask Nova",step3Hint:"Ask a grounded question and follow its citations.",documents:"Document Intelligence",nova:"Open Nova",processed:"documents in this dossier",recent:"Recent extraction results",empty:"Run a sample to create the first result.",control:"Data & AI Control Tower",controlHint:"Operational lineage, latency and quality signals.",ai103:"AI-103 Lab",ai103Hint:"Compact capability checks for local and Azure services.",local:"Local extraction",azure:"Azure Document Intelligence",unknown:"Provider not reported",search:"Evidence search",human:"Human verification"},
  de:{eyebrow:"Produktstory für Bewerbungen",title:"Von 10 Beispiel-PDFs zu nachvollziehbaren KI-Antworten",description:"Eine fokussierte Document-Intelligence-Demo: Felder und Tabellen extrahieren, die Originalseite prüfen und Nova mit Quellen fragen.",step1:"1 · Beispiel starten",step1Hint:"Eines von 10 vorbereiteten PDFs auswählen und extrahieren.",step2:"2 · Beleg prüfen",step2Hint:"Felder, Tabellen und die genaue Quellseite öffnen.",step3:"3 · Nova fragen",step3Hint:"Eine belegte Frage stellen und Quellen öffnen.",documents:"Document Intelligence",nova:"Nova öffnen",processed:"Dokumente in dieser Akte",recent:"Letzte Extraktionsergebnisse",empty:"Starten Sie ein Beispiel für das erste Ergebnis.",control:"Data & AI Control Tower",controlHint:"Datenherkunft, Latenz und Qualitätssignale.",ai103:"AI-103 Lab",ai103Hint:"Kompakte Capability-Checks für lokale und Azure-Dienste.",local:"Lokale Extraktion",azure:"Azure Document Intelligence",unknown:"Provider nicht gemeldet",search:"Belegsuche",human:"Menschliche Prüfung"},
  vi:{eyebrow:"Câu chuyện sản phẩm cho nhà tuyển dụng",title:"Từ 10 PDF mẫu đến câu trả lời AI có thể kiểm chứng",description:"Một demo Document Intelligence tập trung: trích xuất trường và bảng, kiểm tra đúng trang gốc, rồi hỏi Nova kèm trích dẫn.",step1:"1 · Chạy một mẫu",step1Hint:"Chọn một trong 10 PDF đã chuẩn bị và bắt đầu trích xuất.",step2:"2 · Kiểm tra chứng cứ",step2Hint:"Mở trường dữ liệu, bảng và đúng trang nguồn.",step3:"3 · Hỏi Nova",step3Hint:"Đặt câu hỏi dựa trên chứng cứ và mở trích dẫn.",documents:"Document Intelligence",nova:"Mở Nova",processed:"tài liệu trong hồ sơ",recent:"Kết quả trích xuất gần đây",empty:"Chạy một mẫu để tạo kết quả đầu tiên.",control:"Data & AI Control Tower",controlHint:"Theo dõi nguồn dữ liệu, độ trễ và tín hiệu chất lượng.",ai103:"AI-103 Lab",ai103Hint:"Kiểm tra năng lực gọn cho dịch vụ local và Azure.",local:"Trích xuất local",azure:"Azure Document Intelligence",unknown:"Chưa có thông tin provider",search:"Tìm kiếm chứng cứ",human:"Người kiểm tra"},
} as const;

type Props={locale:string;demo:boolean;documentMode?:string;capabilities?:AICapabilities;openSamples?:()=>void;navigate?:(tab:WorkspaceTab)=>void;openNova:()=>void;documents?:readonly CreditDocument[];inspect?:(doc:CreditDocument)=>void;};

export function WorkspaceAIOverview({locale,documentMode,capabilities,openSamples,navigate,openNova,documents=[],inspect}:Props){
  const t=copy[locale==="vi"?"vi":locale==="de"?"de":"en"];
  const documentIdentity=documentAI({analysisProvider:capabilities?.documents.configured?capabilities.documents.provider:undefined,modelId:capabilities?.documents.modelId,status:"review"},locale);
  const chat=chatEngine(capabilities,locale);
  const provider=documentMode?.startsWith("azure")?t.azure:documentMode==="docling"?"Docling · Local AI":documentMode?t.local:capabilities?.documents.configured?documentIdentity.engine:t.unknown;
  const recent=documents.filter(document=>document.status!=="missing").slice(0,4);
  const showSamples=openSamples||(()=>navigate?.("documents"));
  return <div className="recruiter-overview">
    <section className="recruiter-hero" data-page-tour="overview-ai" aria-labelledby="recruiter-hero-title">
      <div><span className="eyebrow">{t.eyebrow}</span><h2 id="recruiter-hero-title">{t.title}</h2><p>{t.description}</p><div className="recruiter-hero-actions"><button type="button" className="button-primary" onClick={showSamples}><FileSearch size={17}/>{t.documents}<ArrowRight size={15}/></button><button type="button" className="button-secondary" onClick={openNova}><MessageSquareText size={17}/>{t.nova}</button></div></div>
      <div className="recruiter-hero-stat"><strong>{documents.length}</strong><span>{t.processed}</span><small>{provider}</small></div>
    </section>
    <section className="recruiter-flow" aria-label={t.title}>
      <button type="button" onClick={showSamples}><FileSearch size={20}/><span><strong>{t.step1}</strong><small>{t.step1Hint}</small></span></button>
      <button type="button" onClick={showSamples}><FileCheck2 size={20}/><span><strong>{t.step2}</strong><small>{t.step2Hint}</small></span></button>
      <button type="button" onClick={openNova}><MessageSquareText size={20}/><span><strong>{t.step3}</strong><small>{t.step3Hint}</small></span></button>
    </section>
    <section className="recruiter-metrics" data-page-tour="dashboard-metrics" aria-label="AI configuration"><div><span>{t.documents}</span><strong>{documentIdentity.engine}</strong><code>{capabilities?.documents.modelId||t.unknown}</code></div><div><span>Nova</span><strong>{chat.engine}</strong><code>{chat.model}</code></div><div><span>{t.search}</span><strong>{capabilities?.retrieval.vectorStore||t.unknown}</strong><code>{capabilities?.retrieval.embeddingModel||t.unknown}</code></div><small>{t.human}</small></section>
    <div className="recruiter-overview-grid">
      <section className="surface recruiter-recent"><header><h3>{t.recent}</h3><button type="button" className="button-link" onClick={showSamples}>{t.documents}</button></header>{recent.length?<ul>{recent.map(document=><li key={document.id}><div><strong>{document.name}</strong><small>{document.type}</small></div><button type="button" className="button-secondary" onClick={()=>inspect?inspect(document):showSamples()}>{t.step2}</button></li>)}</ul>:<p>{t.empty}</p>}</section>
      <section className="recruiter-proof" aria-label="Portfolio proof"><a href={`/${locale}/control-tower`}><Activity size={21}/><span><strong>{t.control}</strong><small>{t.controlHint}</small></span><ArrowRight size={16}/></a><a href={`/${locale}/ai103`}><Microscope size={21}/><span><strong>{t.ai103}</strong><small>{t.ai103Hint}</small></span><ArrowRight size={16}/></a></section>
    </div>
  </div>;
}
