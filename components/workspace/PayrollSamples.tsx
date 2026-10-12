"use client";
import {useState} from "react";
import {FileText,Upload,ExternalLink} from "lucide-react";
import {payrollSamples,documentText,officialPayrollReference} from "@/lib/document-language";
import {PdfPreview} from "./PdfPreview";
import {ModalSurface} from "./ModalSurface";
export function PayrollSamples({locale,busy,canImport,importSample,azure=false}:{locale:string;busy:boolean;canImport:boolean;importSample:(file:string)=>Promise<void>;azure?:boolean}) {
  const t=documentText(locale);const [preview,setPreview]=useState<string|null>(null);
  return <section className="payroll-samples"><header><FileText size={20}/><div><h3>{t("sampleLibrary")}</h3><p>{t(azure?"sampleHint":"sampleHintLocal")}</p></div></header><div className="payroll-sample-grid">{payrollSamples.map(sample=><article key={sample.id}><span className="eyebrow">{t("salary")}</span><h4>{t(sample.id)}</h4><code>{sample.net}</code><div><button className="button-secondary" onClick={()=>setPreview(sample.file)}>{t("preview")}</button><button className="button-primary" disabled={!canImport||busy} onClick={()=>void importSample(sample.file)}><Upload size={15}/>{t(busy?(azure?"analyzing":"analyzingLocal"):(azure?"import":"importLocal"))}</button></div></article>)}</div><details className="public-payroll-reference"><summary>{t("publicTitle")}</summary><p>{t("publicHint")}</p><a className="button-secondary" href={officialPayrollReference} target="_blank" rel="noopener noreferrer">{t("publicLink")}<ExternalLink size={15}/></a><p className="reference-rights">{t("publicRights")}</p></details>{preview?<ModalSurface title={t("sampleTitle")} close={()=>setPreview(null)} label={t("close")}><p className="notice-lab mb-5">{t("sampleBadge")}</p><PdfPreview locale={locale} url={`/demo/${preview}`}/></ModalSurface>:null}</section>;
}
