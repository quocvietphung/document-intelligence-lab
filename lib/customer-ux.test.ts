import {describe,it,expect} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {readFileSync} from "node:fs";
import {customerUx,customerUxTables,filterTransactions,transactionTotals,searchText,bankDate,nearChatBottom,novaSuggestions,reviewAlertPresentation} from "./customer-ux";
import {demoBanking} from "./public-demo";
import {transactionCsv} from "./banking";
import {NovaSuggestions} from "@/components/workspace/NovaConversation";
import {BankTransactionHistory} from "@/components/workspace/BankTransactionHistory";
const sample={...demoBanking("CR-UX-TEST"),transactions:[
  {id:"T-01",accountId:"practice",date:"2026-10-02",counterparty:"Praxis-Team",reference:"Gehälter",category:"SALARY",amountCents:-625000,invoiceId:""},
  {id:"T-02",accountId:"practice",date:"2026-10-03",counterparty:"Praxisimmobilien Muster",reference:"Miete Oktober",category:"RENT",amountCents:-185000,invoiceId:""},
  {id:"T-03",accountId:"practice",date:"2026-10-04",counterparty:"Demo Finanzierung",reference:"Rate",category:"LOAN",amountCents:-125000,invoiceId:""},
  {id:"T-06",accountId:"practice",date:"2026-10-06",counterparty:"Software Muster AG",reference:"Praxissoftware",category:"SOFTWARE",amountCents:-34900,invoiceId:""},
  {id:"T-08",accountId:"personal",date:"2026-10-01",counterparty:"Musterklinikum",reference:"Gehalt September",category:"SALARY",amountCents:624000,invoiceId:""},
]};
const filters={account:"all",query:"",direction:"any",from:"",to:""};
describe("customer-focused lab usability",()=>{
  it("has complete meaningful labels in all languages",()=>{
    for(const table of Object.values(customerUxTables)){expect(Object.keys(table).sort()).toEqual(Object.keys(customerUxTables.en).sort());expect(Object.values(table).every(value=>value.length>0)).toBe(true);}
    expect(customerUx("unknown")).toEqual(customerUxTables.en);
  });
  it("searches accents and German sharp s consistently",()=>{
    expect(searchText("Gehälter Straße")).toBe("gehalter strasse");
    expect(searchText("Đối chiếu")).toBe("doi chieu");
    expect(filterTransactions(sample.transactions,{...filters,query:"gehalter"})).toHaveLength(1);
  });
  it("combines account, direction and inclusive date filters without mutation",()=>{
    const original=sample.transactions.map(row=>row.id);
    const rows=filterTransactions(sample.transactions,{...filters,account:"practice",direction:"out",from:"2026-10-02",to:"2026-10-04"});
    expect(rows).toHaveLength(3);expect(rows.every(row=>row.accountId==="practice"&&row.amountCents<0)).toBe(true);
    expect(sample.transactions.map(row=>row.id)).toEqual(original);
    expect(rows.map(row=>row.date)).toEqual(["2026-10-04","2026-10-03","2026-10-02"]);
  });
  it("calculates exact cent totals for visible rows, including no matches",()=>{
    const rows=filterTransactions(sample.transactions,{...filters,account:"personal",direction:"in"});
    expect(transactionTotals(rows)).toEqual({incoming:624000,outgoing:0,net:624000,count:1});
    expect(transactionTotals([])).toEqual({incoming:0,outgoing:0,net:0,count:0});
  });
  it("exports the same filtered rows with existing spreadsheet protections",()=>{
    const rows=filterTransactions(sample.transactions,{...filters,query:"software"});
    const csv=transactionCsv(rows);expect(csv).toContain("Software Muster AG");expect(csv).not.toContain("Musterklinikum");
  });
  it("formats dates without changing the document's calendar day",()=>{
    expect(bankDate("2026-10-13","en")).toBe("13 Oct 2026");expect(bankDate("bad-date","vi")).toBe("bad-date");
  });
  it("does not force a reader back to the latest messages",()=>{
    expect(nearChatBottom(0,200,800)).toBe(false);expect(nearChatBottom(600,200,800)).toBe(true);
  });
  it("renders opt-in questions, not a hidden automatic send",()=>{
    const html=renderToStaticMarkup(createElement(NovaSuggestions,{locale:"vi",page:"studio",select:()=>{}}));
    expect(html).toContain("Không tự động gửi lên AI");expect(html).toContain("AI Studio");
    expect(novaSuggestions("de","banking").questions[0]).toContain("Bereichsrecherche");
  });
  it("renders reset, count, mobile cards and detail entry points",()=>{
    const html=renderToStaticMarkup(createElement(BankTransactionHistory,{data:sample,locale:"en",account:"all",onAccountChange:()=>{},ask:()=>{}}));
    expect(html).toContain("Clear filters");expect(html).toContain("Matching transactions");expect(html).toContain("bank-transaction-list");expect(html).toContain("View details · T-01");
  });
  it("uses human labels without altering original review evidence",()=>{
    const alert={code:"UNREVIEWED_DOCUMENT",severity:"MEDIUM",detail:"doc-test"};
    const presentation=reviewAlertPresentation(alert,"vi",[{id:"doc-test",name:"datev-robert.pdf"}]);
    expect(presentation.title).toBe("Tài liệu chưa được xác nhận");expect(presentation.detail).toContain("datev-robert.pdf");expect(presentation.severity).toBe("Cần kiểm tra");expect(alert.detail).toBe("doc-test");
  });
  it("keeps banking evidence read-only and tenant isolated",()=>{
    const source=readFileSync("components/workspace/BankingWorkbench.tsx","utf8");
    expect(source).not.toMatch(/banking\/payments|canDraft|canConfirm|method:\s*\"POST\"/);expect(source).toContain('DocumentCorpus');
    const corpus=readFileSync("components/workspace/DocumentCorpus.tsx","utf8");expect(corpus).toContain('value.tenantId!==auth.tenantId');expect(corpus).toContain('uploadedEvidence');
    const chat=readFileSync("components/workspace/CreditWorkspace.tsx","utf8");expect(chat).toContain("sending.current");expect(chat).toContain("caseChatPayload");
  });
  it("refreshes queue review state when the saved case version changes",()=>{
    const source=readFileSync("components/workspace/PlatformWorkbench.tsx","utf8");
    expect(source).toContain("[load,caseVersion]");
    expect(readFileSync("components/workspace/CreditWorkspace.tsx","utf8")).toContain("caseVersion={item.version||0}");
  });
  it("applies date input immediately as well as on committed native change",()=>{
    const source=readFileSync("components/workspace/BankTransactionHistory.tsx","utf8");
    expect(source).toContain("onInput={event=>setFrom(event.currentTarget.value)}");
    expect(source).toContain("onInput={event=>setTo(event.currentTarget.value)}");
  });
});
