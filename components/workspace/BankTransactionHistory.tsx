"use client";
import {useState} from "react";
import {ArrowUpRight,Download,RotateCcw,Search} from "lucide-react";
import {bankMoney,transactionCsv,type BankingData} from "@/lib/banking";
import {bankingText} from "@/lib/banking-language";
import {bankDate,customerUx,filterTransactions,transactionTotals} from "@/lib/customer-ux";
import {ModalSurface} from "./ModalSurface";
import {downloadBlob} from "@/lib/browser-download";

export function BankTransactionHistory({data,locale,account,onAccountChange,ask}:{data:BankingData;locale:string;account:string;onAccountChange:(account:string)=>void;ask:(question:string)=>void}) {
  const t=bankingText(locale),ux=customerUx(locale);
  const [query,setQuery]=useState(""),[direction,setDirection]=useState("any"),[from,setFrom]=useState(""),[to,setTo]=useState(""),[selected,setSelected]=useState<string>();
  const rows=filterTransactions(data.transactions,{account,query,direction,from,to}),totals=transactionTotals(rows);
  const active=account!=="all"||!!query||direction!=="any"||!!from||!!to;
  const money=(amount:number)=>bankMoney(amount,locale);
  const transaction=data.transactions.find(row=>row.id===selected);
  function reset(){onAccountChange("all");setQuery("");setDirection("any");setFrom("");setTo("");}
  function exportCsv(){
    downloadBlob(new Blob([transactionCsv(rows)],{type:"text/csv;charset=utf-8"}),`synthetic-${data.caseId}-transactions.csv`);
  }
  const details=(row:BankingData["transactions"][number])=><button type="button" className="button-link" aria-label={`${ux.inspect} · ${row.id}`} onClick={()=>setSelected(row.id)}>{ux.inspect}<ArrowUpRight size={14}/></button>;
  return <section className="surface bank-transaction-section">
    <div className="banking-section-title"><h4>{t("transactions")}</h4><button className="button-secondary" onClick={exportCsv} disabled={!rows.length}><Download size={16}/>{t("export")}</button></div>
    <div className="banking-filters"><label>{t("accounts")}<select value={account} onChange={event=>onAccountChange(event.target.value)}><option value="all">{t("all")}</option>{data.accounts.map(a=><option key={a.id} value={a.id}>{t(a.label)}</option>)}</select></label>
      <label>{t("search")}<input value={query} onChange={event=>setQuery(event.target.value)} placeholder={t("search")}/></label>
      <label>{t("direction")}<select value={direction} onChange={event=>setDirection(event.target.value)}>{["any","in","out"].map(value=><option key={value} value={value}>{t(value)}</option>)}</select></label>
      <label>{t("from")}<input type="date" value={from} max={to||undefined} onInput={event=>setFrom(event.currentTarget.value)} onChange={event=>setFrom(event.target.value)}/></label>
      <label>{t("to")}<input type="date" value={to} min={from||undefined} onInput={event=>setTo(event.currentTarget.value)} onChange={event=>setTo(event.target.value)}/></label>
    </div>
    <div className="bank-filter-status"><p role="status">{ux.results}: <strong>{rows.length}</strong> / {data.transactions.length}</p><button className="button-secondary" disabled={!active} onClick={reset}><RotateCcw size={14}/>{ux.reset}</button></div>
    <div className="bank-filter-totals" aria-label={ux.filtered}>{[[t("income"),totals.incoming],[t("expenses"),totals.outgoing],[ux.net,totals.net]].map(([label,value])=><div key={label}><small>{label}</small><strong>{money(value as number)}</strong></div>)}</div>
    <div className="banking-table-wrap banking-transaction-table"><table className="audit-table banking-table"><thead><tr><th>{t("date")}</th><th>{t("counterparty")}</th><th>{t("accounts")}</th><th>{t("category")}</th><th>{t("amount")}</th><th>{ux.details}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{bankDate(row.date,locale)}</td><td><strong>{row.counterparty}</strong><small>{row.reference}</small></td><td>{t(row.accountId)}</td><td>{t(row.category)}</td><td className={row.amountCents>0?"amount-positive":""}>{row.amountCents>0?"+":""}{money(row.amountCents)}</td><td>{details(row)}</td></tr>)}</tbody></table></div>
    <div className="bank-transaction-list">{rows.map(row=><article key={row.id}><div><strong>{row.counterparty}</strong><span className={row.amountCents>0?"amount-positive":""}>{row.amountCents>0?"+":""}{money(row.amountCents)}</span></div><p>{row.reference}</p><small>{bankDate(row.date,locale)} · {t(row.accountId)} · {t(row.category)}</small>{details(row)}</article>)}</div>
    {!rows.length?<div className="bank-transaction-empty"><Search size={24}/><p>{ux.noMatches}</p><button className="button-secondary" onClick={reset}>{ux.reset}</button></div>:null}
    {transaction?<ModalSurface title={`${ux.details} · ${transaction.id}`} label={t("close")} close={()=>setSelected(undefined)}><div className="bank-invoice-evidence"><span className="banking-badge">{t("badge")}</span><h3 className={transaction.amountCents>0?"amount-positive":""}>{transaction.amountCents>0?"+":""}{money(transaction.amountCents)}</h3><h4>{transaction.counterparty}</h4><dl className="bank-detail-grid">{[[t("reference"),transaction.reference],[t("date"),bankDate(transaction.date,locale)],[t("accounts"),t(transaction.accountId)],[t("category"),t(transaction.category)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="banking-note">{t("provenance")}</p><button className="button-primary" onClick={()=>{setSelected(undefined);ask(`${ux.explain}: ${transaction.id} · ${transaction.counterparty} · ${transaction.reference} · ${transaction.date} · ${money(transaction.amountCents)}. ${t("noWriteTools")}`);}}>{ux.explain}<ArrowUpRight size={16}/></button></div></ModalSurface>:null}
  </section>;
}
