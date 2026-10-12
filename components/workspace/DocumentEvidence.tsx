"use client";
import {useState} from "react";
import {useAuth} from "@/components/auth/KeycloakProvider";
import type {CreditDocument} from "@/lib/credit-data";
import {documentText} from "@/lib/document-language";
import {workspaceText} from "@/lib/workspace-language";
import {PdfPreview} from "./PdfPreview";
import {ImagePreview} from "./ImagePreview";
import {demoPdfUrl} from "@/lib/public-demo";
export function DocumentEvidence({doc,caseId,locale,editable,values,onChange}:{doc:CreditDocument;caseId:string;locale:string;editable:boolean;values:string[];onChange:(index:number,value:string)=>void}) {
  const auth=useAuth(),t=workspaceText(locale),d=documentText(locale);const [page,setPage]=useState(1);
  const sampleUrl=auth.mode==="demo"?demoPdfUrl(doc.id):undefined;
  const isPdf=doc.contentType==="application/pdf"||doc.name.toLowerCase().endsWith(".pdf");
  const isImage=doc.contentType==="image/png"||doc.contentType==="image/jpeg";
  const sourceLabel=isPdf?d("pdf"):isImage?d("image"):d("text");
  return <><div className="document-review-grid"><div><h3 className="section-heading mb-4">{sourceLabel}</h3>{sampleUrl?<PdfPreview key={doc.id} url={sampleUrl} locale={locale} requestedPage={page}/>:doc.originalAvailable&&isPdf?<PdfPreview key={doc.id} url={`/api/cases/${caseId}/documents/${doc.id}/original`} token={auth.token||undefined} locale={locale} requestedPage={page}/>:doc.originalAvailable&&isImage&&auth.token?<ImagePreview key={doc.id} url={`/api/cases/${caseId}/documents/${doc.id}/original`} token={auth.token} locale={locale}/>:<p className="notice-lab">{doc.originalAvailable?d("text"):d("fixture")}</p>}<details className="document-text-evidence"><summary>{d("text")}</summary>{(doc.pages||[]).map(source=><section className="source-page" key={source.number}><header>{t("page")} {source.number} · {t("method")}: {source.method}</header><pre>{source.text}</pre></section>)}</details><TableEvidence doc={doc} locale={locale} showPage={setPage}/></div><aside><h3 className="section-heading">{d("fields")}</h3>{(doc.fields||[]).map((field,index)=><div className="review-field" key={index}><label><strong>{t(field.label)}</strong><input aria-label={t(field.label)} value={values[index]||""} onChange={e=>onChange(index,e.target.value)} disabled={!editable} maxLength={300}/></label><small>{field.confidence==null?t("unknownConfidence"):`${d("modelConfidence")}: ${field.confidence}%`}</small><button type="button" className="button-link" onClick={()=>setPage(field.page||1)}>{t("page")} {field.page||1} → {sourceLabel}</button><blockquote>{field.evidence||"—"}</blockquote></div>)}{!doc.fields?.length?<p className="my-4 text-sm text-slate-500">{t("emptyFields")}</p>:null}{doc.fields?.some(f=>f.label==="payoutAmount")?<p className="notice-lab mt-5">{d("netVsPayout")}</p>:null}</aside></div></>;
}

function TableEvidence({doc,locale,showPage}:{doc:CreditDocument;locale:string;showPage:(page:number)=>void}){
  const label=locale==="de"?"Extrahierte Tabellen":locale==="vi"?"Bảng đã trích xuất":"Extracted tables";
  const pageLabel=workspaceText(locale)("page");
  if(!doc.tables?.length)return null;
  return <details className="document-text-evidence"><summary>{label} · {doc.tables.length}</summary>
    {doc.tables.map((table,index)=><section className="source-page" key={index}>
      <button className="button-link" onClick={()=>showPage(table.page)}>{pageLabel} {table.page} →</button>
      <div className="lab-table-wrap"><table className="audit-table"><tbody>
        {Array.from({length:Math.min(100,table.rows)},(_,row)=><tr key={row}>
          {Array.from({length:Math.min(30,table.columns)},(_,column)=><td key={column}>{table.cells.find(c=>c.row===row&&c.column===column)?.text||"—"}</td>)}
        </tr>)}
      </tbody></table></div>
    </section>)}
  </details>;
}
