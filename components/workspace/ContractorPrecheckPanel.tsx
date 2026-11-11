"use client";
import {useState} from 'react';
import {basisLabel,displayAmount,findingTitle,precheckPath,precheckSchema,precheckText,type Precheck,type PrecheckSource} from '@/lib/contractor-precheck';
import {useConnectorApi} from './connector-api';

/** Read-only pre-accounting check. Shows Java-computed amounts with their source pages; the person reviews and sends. */
export function ContractorPrecheckPanel({caseId,locale,inspect}:{caseId:string;locale:string;inspect:(documentId:string,page?:number)=>void}){
  const {auth,request,run,busy,error}=useConnectorApi(locale);
  const t=precheckText(locale);
  const [result,setResult]=useState<Precheck>(),[copied,setCopied]=useState(false);
  const check=()=>void run('precheck',async()=>{setCopied(false);setResult(precheckSchema.parse(await request(precheckPath(caseId,locale))));});
  const page=(source:PrecheckSource|null|undefined)=>source?<button type="button" className="button-secondary" onClick={()=>inspect(source.documentId,source.page)}>
    {t.open}: {source.documentName??source.documentId} · p. {source.page}</button>:<span>—</span>;
  const status=(value:string)=>value==='MISSING'?t.missing:value==='PARTIAL'?t.partial:value==='FOUND'?t.found:t.complete;
  const unreviewed=result?.documents.filter(d=>d.reviewStatus!=='verified').length??0;
  const draftText=result?[...result.draft.summary,'',result.draft.email.subject,'',result.draft.email.body].join('\n'):'';
  return <section className="surface lab-section" data-page-tour="controls-contractor-precheck" aria-labelledby="contractor-precheck-title">
    <h3 id="contractor-precheck-title">{t.title}</h3>
    <p className="lab-caption">{t.intro}</p>
    <button type="button" className="button-primary" disabled={!auth.token||!!busy} onClick={check}>{busy?t.running:result?t.rerun:t.run}</button>
    {error?<p className="notice-error" role="alert">{error}</p>:null}
    {result?<div className="mt-4 grid gap-4" role="status">
      <div className="lab-metrics">
        <div className="lab-metric"><span>{t.approved}</span><strong>{displayAmount(result.approved.amount,locale)}</strong><small>{t.basis}: {basisLabel(result.approved.basis,locale)}</small>{page(result.approved.source)}</div>
        <div className="lab-metric"><span>{t.invoice}</span><strong>{displayAmount(result.invoice.amount,locale)}</strong><small>{t.basis}: {basisLabel(result.invoice.basis,locale)}</small>{page(result.invoice.source)}</div>
        <div className="lab-metric"><span>{t.variance}</span><strong>{displayAmount(result.variance.amount,locale)}</strong><small>{result.variance.sameTaxBasis?`${t.sameBasis}: ${basisLabel(result.variance.basis,locale)}`:t.noBasis}</small></div>
      </div>
      <div><h4>{t.lines}</h4><ul className="text-sm">{result.invoiceLines.map(line=><li key={line.position}>
        {t.line} {line.position}: {line.description} · {line.reference} · {displayAmount(line.net,locale)} netto · <strong>{line.approved?t.approvedLine:t.unapprovedLine}</strong> {page(line.source)}</li>)}</ul></div>
      <div><h4>{t.evidence}</h4><ul className="text-sm">
        <li>{t.acceptance}: <strong>{status(result.evidence.acceptance.status)}</strong>{result.evidence.acceptance.sources?.map(s=><span key={s.documentId+s.page+s.quote}> {page(s)}</span>)}</li>
        <li>{t.payment}: <strong>{status(result.evidence.payment.status)}</strong></li>
        <li>{t.photos}: {result.evidence.photos.provided.map(p=>p.photoId).join(', ')||'—'}{result.evidence.photos.missing.length?<> · <strong>{t.missing}: {result.evidence.photos.missing.join(', ')}</strong></>:null}</li>
      </ul></div>
      <div><h4>{t.findings}</h4><ul className="text-sm">{result.findings.map((f,i)=><li key={f.code+i}><span className={`lab-badge lab-badge-${f.severity==='HIGH'?'warn':'neutral'}`}>{f.severity}</span> {findingTitle(f.code,locale)}</li>)}</ul>
        <details className="text-xs"><summary>{t.technical}</summary><ul>{result.findings.map((f,i)=><li key={f.code+i}><code>{f.code}</code> {f.message}</li>)}</ul></details>
        {unreviewed?<p className="lab-caption">{unreviewed} {t.unreviewed}</p>:null}</div>
      {result.embeddedInstructions.length?<div className="notice-error"><h4>{t.instructions}</h4><ul className="text-sm">{result.embeddedInstructions.map(i=><li key={i.documentId+i.page}>
        {i.documentName} · p. {i.page}: <q>{i.quote}</q> {page({documentId:i.documentId,documentName:i.documentName,page:i.page})}</li>)}</ul></div>:null}
      <div><h4>{t.draft}</h4><p className="notice-lab text-sm">{t.notice}</p>
        <ul className="text-sm">{result.draft.summary.map((line,i)=><li key={i}>{line}</li>)}</ul>
        <h4 className="mt-3">{t.email}</h4><p className="text-sm"><strong>{result.draft.email.subject}</strong></p>
        <pre className="whitespace-pre-wrap text-sm">{result.draft.email.body}</pre>
        <button type="button" className="button-secondary" onClick={()=>void navigator.clipboard?.writeText(draftText).then(()=>setCopied(true)).catch(()=>setCopied(false))}>{copied?t.copied:t.copy}</button></div>
      <details><summary>{t.steps}</summary><ul className="text-xs">{result.steps.map(s=><li key={s.name}>{s.name}: {s.durationMs} ms</li>)}</ul>
        {result.traceId?<p className="text-xs">{t.trace}: <code>{result.traceId}</code></p>:null}<p className="text-xs tone-secondary">{result.boundary}</p></details>
    </div>:null}
  </section>;
}
