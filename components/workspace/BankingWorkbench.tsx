"use client";

import {useCallback,useEffect,useState} from "react";
import {ArrowDownLeft,ArrowUpRight,CheckCircle2,Download,Landmark,ReceiptText,RefreshCw,ShieldCheck,WalletCards,Workflow} from "lucide-react";
import {useAuth} from "@/components/auth/KeycloakProvider";
import {accountBalance,bankingSchema,bankMoney,transactionCsv,type BankingData} from "@/lib/banking";
import {bankingText} from "@/lib/banking-language";
import {ModalSurface} from "./ModalSurface";
import {demoBanking} from "@/lib/public-demo";
import {publicDemoText} from "@/lib/public-demo-language";


type Section="accounts"|"transactions"|"payments"|"tools";
export function BankingWorkbench({caseId,locale,ask}:{caseId:string;locale:string;ask:(question:string)=>void}) {
  const auth=useAuth(),t=bankingText(locale);
  const [data,setData]=useState<BankingData|null>(null),[section,setSection]=useState<Section>("accounts");
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState(false);
  const [account,setAccount]=useState("all"),[query,setQuery]=useState(""),[direction,setDirection]=useState("any"),[from,setFrom]=useState(""),[to,setTo]=useState("");
  const [invoiceId,setInvoiceId]=useState<string|null>(null),[paymentId,setPaymentId]=useState<string|null>(null),[debit,setDebit]=useState("practice"),[checked,setChecked]=useState(false);
  const load=useCallback(async(signal?:AbortSignal)=>{
    if(auth.mode==="demo"){setData(demoBanking(caseId));setLoading(false);setError("");return;}
    if(!auth.token){setLoading(false);return;}
    setLoading(true);setError("");
    try {
      const response=await fetch(`/api/cases/${caseId}/banking`,{headers:{Authorization:`Bearer ${auth.token}`},cache:"no-store",signal});
      if(!response.ok)throw new Error();
      const next=bankingSchema.parse(await response.json());
      if(next.caseId!==caseId||next.tenantId!==auth.tenantId)throw new Error();
      if(!signal?.aborted)setData(next);
    } catch {if(!signal?.aborted){setError("error");setData(null);}} finally {if(!signal?.aborted)setLoading(false);}
  },[auth.mode,auth.token,auth.tenantId,caseId]);
  useEffect(()=>{const controller=new AbortController();const timer=window.setTimeout(()=>void load(controller.signal),0);return()=>{clearTimeout(timer);controller.abort();};},[load]);
  async function write(path:string,body:unknown) {
    if(busy||!data)return;
    setBusy(true);setError("");setSuccess(false);
    try {
      const response=await fetch(`/api/cases/${caseId}/banking/payments${path}`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(!response.ok){setError(response.status===409?"conflict":response.status===422?"rejected":"error");return;}
      const next=bankingSchema.parse(await response.json());
      if(next.caseId!==caseId||next.tenantId!==auth.tenantId)throw new Error();
      setData(next);setInvoiceId(null);setPaymentId(null);setChecked(false);setSuccess(true);
    } catch {setError("error");} finally {setBusy(false);}
  }
  const canDraft=data?.persistent&&auth.roles.some(r=>r==="ADVISOR"||r==="ADMIN");
  const canConfirm=data?.persistent&&auth.roles.some(r=>r==="REVIEWER"||r==="ADMIN");
  const rows=(data?.transactions||[]).filter(row=>(account==="all"||row.accountId===account)&&
    `${row.counterparty} ${row.reference}`.toLowerCase().includes(query.toLowerCase())&&
    (direction==="any"||(direction==="in"?row.amountCents>0:row.amountCents<0))&&(!from||row.date>=from)&&(!to||row.date<=to)).toSorted((a,b)=>b.date.localeCompare(a.date));
  const money=(cents:number)=>bankMoney(cents,locale);
  const invoice=data?.invoices.find(i=>i.id===invoiceId),payment=data?.payments.find(p=>p.id===paymentId);
  const duplicate=invoice&&data?.payments.some(p=>p.invoiceId===invoice.id);
  const income=(data?.transactions||[]).filter(row=>row.amountCents>0).reduce((sum,row)=>sum+row.amountCents,0);
  const outgoing=-(data?.transactions||[]).filter(row=>row.amountCents<0).reduce((sum,row)=>sum+row.amountCents,0);
  function exportCsv() {
    const url=URL.createObjectURL(new Blob([transactionCsv(rows)],{type:"text/csv;charset=utf-8"}));
    const anchor=document.createElement("a");anchor.href=url;anchor.download=`synthetic-${caseId}-transactions.csv`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="banking-workbench" aria-label={t("banking")}>
    
    <header className="banking-intro"><div><span className="banking-badge"><ShieldCheck size={14}/>{t("badge")}</span><h3>{t("title")}</h3><p>{auth.mode==="demo"?publicDemoText(locale)("modelNote"):t("subtitle")}</p></div><button className="button-secondary" onClick={()=>void load()} disabled={busy||loading}><RefreshCw size={16}/>{t("refresh")}</button></header>
    <div className="banking-tabs" role="group" aria-label={t("banking")}>{([["accounts",WalletCards],["transactions",ArrowUpRight],["payments",ReceiptText],["tools",Workflow]] as const).map(([id,Icon])=><button key={id} aria-pressed={section===id} className={section===id?"active":""} onClick={()=>{setSection(id);setSuccess(false);}}><Icon size={17}/>{t(id)}</button>)}</div>
    {error?<p className="notice-error" role="alert">{t(error)}</p>:null}{success?<p className="notice-success" role="status">{t("saved")}</p>:null}
    {loading?<p className="surface p-7" role="status">{t("loading")}</p>:null}
    {!loading&&data?<><p className="banking-storage"><span className="status-dot"/>{t(data.persistent?"persistent":"volatile")} · {caseId} · v{data.version}</p>
      {section==="accounts"?<><div className="bank-account-grid">{data.accounts.map(a=><article className={`bank-account ${a.id==="practice"?"bank-account-primary":""}`} key={a.id}><div className="bank-account-top"><Landmark size={22}/><span>DEMO / {a.currency}</span></div><p>{t(a.label)}</p><h4>{money(accountBalance(data,a.id))}</h4><div className="bank-account-bottom"><code>{a.maskedReference}</code><button onClick={()=>{setAccount(a.id);setSection("transactions");}} aria-label={`${t("transactions")} · ${t(a.label)}`}><ArrowUpRight size={19}/></button></div></article>)}</div>
        <div className="banking-summary"><article className="surface"><ArrowDownLeft/><div><span>{t("income")}</span><strong>{money(income)}</strong></div></article><article className="surface"><ArrowUpRight/><div><span>{t("expenses")}</span><strong>{money(outgoing)}</strong></div></article><article className="surface"><ReceiptText/><div><span>{t("NEEDS_REVIEW")}</span><strong>{data.invoices.filter(i=>i.status==="NEEDS_REVIEW").length}</strong></div></article></div>
        <section className="surface p-6"><div className="banking-section-title"><h4>{t("routing")}</h4><button className="button-link" onClick={()=>ask(t("accountQuestion"))}>{t("ask")} <ArrowUpRight size={15}/></button></div><p className="banking-note">{t("routingHint")}</p></section></>:null}
      {section==="transactions"?<section className="surface p-5"><div className="banking-section-title"><h4>{t("transactions")}</h4><button className="button-secondary" onClick={exportCsv} disabled={!rows.length}><Download size={16}/>{t("export")}</button></div><div className="banking-filters"><label>{t("accounts")}<select value={account} onChange={e=>setAccount(e.target.value)}><option value="all">{t("all")}</option>{data.accounts.map(a=><option key={a.id} value={a.id}>{t(a.label)}</option>)}</select></label><label>{t("search")}<input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("search")}/></label><label>{t("direction")}<select value={direction} onChange={e=>setDirection(e.target.value)}>{["any","in","out"].map(v=><option key={v} value={v}>{t(v)}</option>)}</select></label><label>{t("from")}<input type="date" value={from} max={to||undefined} onChange={e=>setFrom(e.target.value)}/></label><label>{t("to")}<input type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)}/></label></div>
        <div className="banking-table-wrap"><table className="audit-table banking-table"><thead><tr><th>{t("date")}</th><th>{t("counterparty")}</th><th>{t("accounts")}</th><th>{t("category")}</th><th>{t("amount")}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.date}</td><td><strong>{row.counterparty}</strong><small>{row.reference}</small></td><td>{t(row.accountId)}</td><td>{t(row.category)}</td><td className={row.amountCents>0?"amount-positive":""}>{row.amountCents>0?"+":""}{money(row.amountCents)}</td></tr>)}</tbody></table></div>{!rows.length?<p className="banking-note p-5">{t("empty")}</p>:null}</section>:null}
      {section==="payments"?<><div className="bank-invoice-grid">{data.invoices.map(i=><article className="surface bank-invoice" key={i.id}><div className="banking-section-title"><ReceiptText size={22}/><span className={`bank-status ${i.status==="BLOCKED"?"warning":""}`}>{t(i.status)}</span></div><h4>{t(i.description)}</h4><p>{data.beneficiaries.find(b=>b.id===i.beneficiaryId)?.name}</p><strong className="invoice-amount">{money(i.amountCents)}</strong><div className="bank-invoice-meta"><span>{i.number}</span><span>{t("due")}: {i.dueDate}</span></div><button className="button-secondary" onClick={()=>{setInvoiceId(i.id);setChecked(false);setError("");}}>{t("review")} <ArrowUpRight size={16}/></button></article>)}</div><section className="surface p-6"><h4 className="section-heading">{t("payments")}</h4>{!data.payments.length?<p className="banking-note mt-4">{t("noPayments")}</p>:data.payments.map(p=><div className="bank-payment-row" key={p.id}><CheckCircle2 size={20}/><div><strong>{data.invoices.find(i=>i.id===p.invoiceId)?.number}</strong><p>{t(p.status)} · {money(p.amountCents)}</p></div>{p.status==="AWAITING_CONFIRMATION"?<button className="button-primary" disabled={!canConfirm||busy} onClick={()=>{setPaymentId(p.id);setChecked(false);setError("");}}>{t("confirm")}</button>:null}</div>)}</section><section className="surface p-6"><h4 className="section-heading">{t("ledger")}</h4><div className="banking-table-wrap"><table className="audit-table"><thead><tr><th>{t("date")}</th><th>{t("action")}</th><th>{t("actor")}</th></tr></thead><tbody>{data.events.toReversed().map(e=><tr key={e.id}><td>{e.time.slice(0,19).replace("T"," ")} UTC</td><td>{t(e.action)}<small className="block">{e.reference}</small></td><td><code>{e.actor}</code></td></tr>)}</tbody></table></div></section></>:null}
      {section==="tools"?<section className="surface p-7"><span className="eyebrow">JAVA / LANGCHAIN4J</span><h4 className="mt-3 text-xl font-bold">{t("routing")}</h4><p className="banking-note mt-3">{t("routingHint")}</p><div className="bank-tool-grid">{["readAccounts","readTransactions","readInvoices"].map((label,i)=><article key={label}><Workflow size={24}/><h5>{t(label)}</h5><code>{["bankAccounts","bankTransactions","bankInvoices"][i]}()</code><span>READ ONLY</span></article>)}</div><p className="notice-lab"><ShieldCheck size={17}/>{t("noWriteTools")}</p><button className="button-primary mt-5" onClick={()=>ask(t("accountQuestion"))}>{t("ask")}<ArrowUpRight size={16}/></button></section>:null}
      <p className="banking-note mt-5">{auth.mode==="demo"?publicDemoText(locale)("badge"):t("provenance")}</p>
    </>:null}
    {invoice&&data?<ModalSurface title={`${t("evidence")} · ${invoice.number}`} close={()=>{if(!busy)setInvoiceId(null);}} label={t("close")}><div className="bank-invoice-evidence"><span className="bank-status">{t(invoice.status)}</span><h3>{money(invoice.amountCents)}</h3><p>{data.beneficiaries.find(b=>b.id===invoice.beneficiaryId)?.name}</p><code>{data.beneficiaries.find(b=>b.id===invoice.beneficiaryId)?.maskedReference}</code><blockquote>{invoice.evidence}</blockquote></div>
      {invoice.status==="ALREADY_PAID"||invoice.status==="SIMULATED_PAID"||duplicate?<p className="notice-lab mt-4">{t("duplicate")}</p>:invoice.status==="BLOCKED"?<p className="notice-error">{t("blocked")}</p>:<><label className="banking-select-label">{t("chooseAccount")}<select value={debit} onChange={e=>setDebit(e.target.value)}>{data.accounts.map(a=><option key={a.id} value={a.id}>{t(a.label)} · {money(accountBalance(data,a.id))}</option>)}</select></label><label className="bank-check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>{t("sourceChecked")}</label><p className="banking-note mb-4">{t("confirmHint")}</p><button className="button-primary" disabled={!canDraft||busy||!checked||accountBalance(data,debit)<invoice.amountCents} onClick={()=>void write("",{accountId:debit,invoiceId:invoice.id,requestId:crypto.randomUUID(),version:data.version,sourceChecked:checked})}>{t(busy?"loading":"prepare")}</button></>}{error?<p className="notice-error" role="alert">{t(error)}</p>:null}</ModalSurface>:null}
    {payment&&data?<ModalSurface title={t("confirm")} close={()=>{if(!busy)setPaymentId(null);}} label={t("close")}><div className="bank-invoice-evidence"><span className="banking-badge">{t("badge")}</span><h3>{money(payment.amountCents)}</h3><p>{data.invoices.find(i=>i.id===payment.invoiceId)?.number} · {t(payment.accountId)}</p></div><p className="banking-note my-5">{t("confirmHint")}</p><label className="bank-check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>{t("sourceChecked")}</label><button className="button-primary" disabled={!canConfirm||!checked||busy} onClick={()=>void write(`/${payment.id}/confirm`,{version:data.version,confirmed:checked})}>{t(busy?"loading":"confirm")}</button>{error?<p className="notice-error" role="alert">{t(error)}</p>:null}</ModalSurface>:null}
  </section>;
}
