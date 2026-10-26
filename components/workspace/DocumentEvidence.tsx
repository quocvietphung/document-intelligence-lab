"use client";
import {useState} from 'react';
import {Sparkles} from 'lucide-react';
import {useAuth} from '@/components/auth/KeycloakProvider';
import type {CreditDocument} from '@/lib/credit-data';
import type {WorkspaceCase} from '@/lib/credit-api';
import {documentText} from '@/lib/document-language';
import {workspaceText} from '@/lib/workspace-language';
import {demoPdfUrl} from '@/lib/public-demo';
import {aiText} from '@/lib/ai-capabilities';
import {documentTableLayout,documentUi} from '@/lib/document-results';
import {structureText} from '@/lib/document-structure';
import {fieldRegions,inspectionText,regionTableContext,type EvidenceContext,type EvidenceSelection} from '@/lib/evidence-inspection';
import {PdfPreview} from './PdfPreview';
import {ImagePreview} from './ImagePreview';
import {PayrollReferenceNotice} from './PayrollReferenceNotice';
import {InsuranceReferenceNotice} from './InsuranceReferenceNotice';
import {AIDocumentBadge} from './AITransparency';
import {DocumentRecognitionDetails} from './DocumentResults';
import {OcrCorrectionForm} from './OcrCorrectionForm';

export function DocumentEvidence({doc,caseId,locale,editable,values,onChange,onExplain,initialPage=1,context,caseVersion=0,onOcrSaved}:{doc:CreditDocument;caseId:string;locale:string;editable:boolean;values:string[];onChange:(index:number,value:string)=>void;onExplain?:(question:string)=>void;initialPage?:number;context?:EvidenceContext;caseVersion?:number;onOcrSaved?:(item:WorkspaceCase)=>void}) {
  const auth=useAuth(),t=workspaceText(locale),d=documentText(locale),copy=inspectionText(locale);
  const [page,setPage]=useState(initialPage);
  const [selection,setSelection]=useState<EvidenceSelection|undefined>(()=>{
    if(!context)return;
    const p=doc.pages?.find(p=>p.number===initialPage),region=p?.regions?.find(r=>`${doc.id}:p${initialPage}:${r.id}`===context.sourceId);
    return {page:initialPage,sourceId:region?.id||'page',ocrText:region?.text||context.ocrText||p?.text||'',value:region?.text||'',region,tableContext:regionTableContext(region,doc.tables)};
  });
  const sampleUrl=auth.mode==='demo'?demoPdfUrl(doc.id):undefined;
  const isPdf=doc.contentType==='application/pdf'||doc.name.toLowerCase().endsWith('.pdf');
  const isImage=doc.contentType==='image/png'||doc.contentType==='image/jpeg';
  const sourceLabel=isPdf?d('pdf'):isImage?d('image'):d('text');
  function selectField(index:number){
    const f=doc.fields?.[index];if(!f)return;const number=f.page||1;
    const candidates=fieldRegions(doc.pages?.find(p=>p.number===number)?.regions||[],f.originalValue??f.value,f.evidence||'');
    const region=candidates.length===1?candidates[0]:undefined;
    setPage(number);setSelection({page:number,sourceId:region?.id||`field-${index}`,ocrText:region?.text||f.originalValue||f.value,value:f.originalValue??f.value,region,candidates,fieldIndex:index});
  }
  function selectRegion(number:number,id?:string){
    setPage(number);const region=doc.pages?.find(p=>p.number===number)?.regions?.find(r=>r.id===id);
    if(!region){setSelection(undefined);return;}
    setSelection({page:number,sourceId:region.id,ocrText:region.text,value:region.text,region,tableContext:regionTableContext(region,doc.tables)});
  }
  const previewProps={locale,requestedPage:page,selection,answerText:context?.answerText,onPageChange:(number:number)=>{setPage(number);setSelection(undefined);}};
  return <>
    <AIDocumentBadge doc={doc} locale={locale}/><DocumentRecognitionDetails doc={doc} locale={locale}/>
    <PayrollReferenceNotice doc={doc} locale={locale}/><InsuranceReferenceNotice name={doc.name} locale={locale}/>
    {!doc.fields?.length?<p className="notice-lab mt-4">{t('emptyFields')}</p>:null}
    <div className={`document-review-grid${doc.fields?.length?'':' document-review-source-only'}`}><div>
      <h3 className="section-heading mb-4">{sourceLabel}</h3>
      {sampleUrl?<PdfPreview key={doc.id} url={sampleUrl} {...previewProps}/>:doc.originalAvailable&&isPdf?<PdfPreview key={doc.id} url={`/api/cases/${caseId}/documents/${doc.id}/original`} token={auth.token||undefined} {...previewProps}/>:doc.originalAvailable&&isImage&&auth.token?<ImagePreview key={doc.id} url={`/api/cases/${caseId}/documents/${doc.id}/original`} token={auth.token} locale={locale}/>:<p className="notice-lab">{doc.originalAvailable?d('text'):d('fixture')}</p>}
      {doc.pages?.some(p=>p.regions?.length)?<label className="evidence-occurrence-picker">{copy.choose}<select value={selection?.page===page&&selection.region?selection.sourceId:''} onChange={e=>selectRegion(page,e.target.value)}><option value="" disabled>{copy.choose}</option>{doc.pages?.find(p=>p.number===page)?.regions?.map(r=><option key={r.id} value={r.id}>{r.id} · {r.text.slice(0,90)}{r.row!=null?` · ${copy.row} ${r.row+1}, ${copy.column} ${(r.column??0)+1}`:''}</option>)}</select><small>{copy.manual}</small></label>:null}
      {selection&&editable&&onOcrSaved?<OcrCorrectionForm key={`${selection.page}:${selection.sourceId}`} doc={doc} selection={selection} caseId={caseId} caseVersion={caseVersion} locale={locale} onSaved={onOcrSaved}/>:null}
      {doc.ocrCorrections?.length?<details className="document-text-evidence"><summary>{copy.history} · {doc.ocrCorrections.length}</summary><p>{copy.pending}</p>{doc.ocrCorrections.map(c=><section key={c.id}><strong>{t('page')} {c.page} · {c.sourceId}</strong><blockquote>{c.originalText}</blockquote><p>→ {c.correctedText}</p><small>{c.reason} · {c.actor} · {c.time}</small></section>)}</details>:null}
      <details className="document-text-evidence"><summary>{d('text')}</summary>{(doc.pages||[]).map(source=><section className="source-page" key={source.number}><header>{t('page')} {source.number} · {t('method')}: {source.method}</header><pre>{source.text}</pre></section>)}</details>
      <TableEvidence doc={doc} locale={locale} select={selectRegion}/>
      <StructureEvidence doc={doc} locale={locale} select={selectRegion}/>
    </div>{doc.fields?.length?<aside><h3 className="section-heading">{d('fields')}</h3>
      {(doc.fields||[]).map((field,index)=><div className="review-field" key={index}>
        <label><strong>{t(field.label)}</strong><input aria-label={t(field.label)} value={values[index]||''} onChange={e=>onChange(index,e.target.value)} disabled={!editable} maxLength={300}/></label>
        <details className="review-confidence"><summary>{documentUi(locale).fieldSignal}</summary><small>{field.confidence==null?t('unknownConfidence'):`${d('modelConfidence')}: ${field.confidence}%`}</small><p>{documentUi(locale).ocrHint}</p></details>
        <button type="button" className="button-link" onClick={()=>selectField(index)}>{copy.select} · {t('page')} {field.page||1}</button>
        <blockquote>{field.evidence||'—'}</blockquote>
        {onExplain?<button type="button" className="ai-field-explain" aria-label={`${aiText(locale).explainField} · ${t(field.label)}`} onClick={()=>{
          const matches=fieldRegions(doc.pages?.find(p=>p.number===(field.page||1))?.regions||[],field.originalValue??field.value,field.evidence||'');
          onExplain(`${aiText(locale).fieldRequest} ${t(field.label)} · ${doc.name} [${doc.id}:p${field.page||1}${matches.length===1?':'+matches[0].id:''}]`);
        }}><Sparkles size={13}/>{aiText(locale).explainField}</button>:null}
      </div>)}
      {doc.fields?.some(f=>f.label==='payoutAmount')?<p className="notice-lab mt-5">{d('netVsPayout')}</p>:null}
    </aside>:null}</div>
  </>;
}

function TableEvidence({doc,locale,select}:{doc:CreditDocument;locale:string;select:(page:number,id?:string)=>void}){
  const label=locale==='de'?'Extrahierte Tabellen':locale==='vi'?'Bảng đã trích xuất':'Extracted tables',copy=inspectionText(locale);
  const pageLabel=workspaceText(locale)('page');if(!doc.tables?.length)return null;
  return <details className="document-text-evidence"><summary>{label} · {doc.tables.length}</summary>{doc.tables.map((table,index)=><section className="source-page" key={index}>
    <button className="button-link" onClick={()=>select(table.page)}>{pageLabel} {table.page} →</button>
    <p>{structureText(locale).tableHint}</p>
    <div className="lab-table-wrap"><table className="audit-table"><tbody>{documentTableLayout(table).map((cells,row)=><tr key={row}>{cells.map(cell=>{
      const {text,column}=cell,Tag=cell.columnHeader||cell.rowHeader?'th':'td';
      const source=doc.pages?.find(p=>p.number===table.page)?.regions?.filter(r=>r.table===index&&r.row===row&&r.column===column);
      return <Tag key={column} rowSpan={cell.rowSpan} colSpan={cell.columnSpan} scope={cell.columnHeader?'col':cell.rowHeader?'row':undefined}>{source?.length===1?<button type="button" className="button-link" aria-label={`${copy.select} · ${copy.row} ${row+1} · ${copy.column} ${column+1}`} onClick={()=>select(table.page,source[0].id)}>{text}</button>:text}</Tag>;
    })}</tr>)}</tbody></table></div>
  </section>)}</details>;
}

function StructureEvidence({doc,locale,select}:{doc:CreditDocument;locale:string;select:(page:number,id?:string)=>void}){
  const t=structureText(locale),structure=doc.structure;
  const nodes=structure?.blocks.slice(0,80)||[],index=new Map(nodes.map(n=>[n.ref,n]));
  const children=new Set(nodes.flatMap(n=>n.children));
  function render(ref:string,depth=0):React.ReactNode{
    const node=index.get(ref);if(!node||depth>64)return null;
    const kind=node.kind==='title'?t.titleLabel:t[node.kind as keyof typeof t]||t.unknown;
    const excerpt=node.regionIds.length===1?doc.pages?.find(p=>p.number===node.page)?.regions?.find(r=>r.id===node.regionIds[0])?.text.slice(0,120):undefined;
    return <li key={ref}>{node.page?<button type="button" className="button-link" onClick={()=>select(node.page!,node.regionIds.length===1?node.regionIds[0]:undefined)}>{kind} · {t.page} {node.page}{excerpt?` — ${excerpt}`:''}</button>:<span>{kind}</span>}{node.children.length?<ol>{node.children.map(child=>render(child,depth+1))}</ol>:null}</li>;
  }
  return <details className="document-text-evidence"><summary>{t.title}</summary><p>{t.hint}</p><p><strong>{t.tags}:</strong> {t[structure?.nativeTags||'NOT_INSPECTED']}</p>{structure?.issues.map(code=><p key={code}>{t[code as keyof typeof t]||t.empty}</p>)}{nodes.length?<ol className="document-structure-tree">{nodes.filter(n=>!children.has(n.ref)).map(n=>render(n.ref))}</ol>:<p>{t.empty}</p>}{(structure?.blocks.length||0)>80?<p>{t.limit}</p>:null}</details>;
}
