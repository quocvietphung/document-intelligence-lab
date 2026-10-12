import type { WorkspaceCase } from "./credit-api";
import { demoCase } from "./credit-data";
import { retrieveCaseSources } from "./credit-chat";
import { accountBalance, bankMoney, type BankingData } from "./banking";
import type { PlatformData, SearchData } from "./platform";

/** Public fixtures only. No tenant data, provider calls, credentials or persistence. */
export const publicDemoCase: WorkspaceCase = {
  ...demoCase, applicant: "Dr. Lea Muster", coApplicant: "Jonas Beispiel",
  version: 0, amountEuro: 480000, status: "HUMAN_REVIEW",
  documents: [
    {id:"doc-1",name:"gehaltsabrechnung-2026-09-muster.pdf",type:"income",status:"review",
      analysisProvider:"static-demo",modelId:"hand-labelled-fixture",confidence:null,originalAvailable:false,
      fields:[{label:"netIncome",value:"6240 EUR",confidence:null,page:1,evidence:"Nettoeinkommen: 6240 EUR"},
        {label:"employer",value:"Musterklinikum GmbH",confidence:null,page:1,evidence:"Arbeitgeber: Musterklinikum GmbH"}],
      pages:[{number:1,method:"static-demo",text:"Gehaltsabrechnung · September 2026\nMitarbeiter: Dr. Lea Muster\nArbeitgeber: Musterklinikum GmbH\nNettoeinkommen: 6240 EUR\nDatum: 30.09.2026"}]},
    {id:"doc-2",name:"Kontoauszug_Q3_MUSTER.txt",type:"statement",status:"review",originalAvailable:false,
      fields:[{label:"monthlyRate",value:"1250 EUR",confidence:null,page:1}],
      pages:[{number:1,method:"static-demo",text:"FIKTIVER KONTOAUSZUG\nGehalt: 6240 EUR\nMonatliche Rate: 1250 EUR"}]},
    {id:"doc-3",name:"Identitätsnachweis · Muster",type:"identity",status:"review",originalAvailable:false},
    {id:"doc-4",name:"Praxisbewertung",type:"valuation",status:"missing",originalAvailable:false},
  ],
  issues:[{severity:"high",title:"Missing required document",detail:"valuation"},
    {severity:"medium",title:"MONTHLY_RATE_CONFLICT",detail:"1250 EUR / 980 EUR",documentId:"doc-2"}],
  audit:[["2026-10-12 10:00","FIXTURE_CREATED","public-demo"]],
};
export function demoPdfUrl(documentId:string) {
  return documentId==="doc-1"?"/demo/gehaltsabrechnung-2026-09-muster.pdf":undefined;
}
export function demoBanking(caseId=publicDemoCase.id): BankingData {
  return {caseId,tenantId:publicDemoCase.tenantId,synthetic:true,persistent:false,version:0,
    accounts:[{id:"practice",label:"practice",maskedReference:"DEMO · NOT AN IBAN",openingCents:1200000,currency:"EUR"},
      {id:"reserve",label:"reserve",maskedReference:"DEMO · RESERVE",openingCents:800000,currency:"EUR"}],
    transactions:[
      {id:"T-01",accountId:"practice",date:"2026-09-30",counterparty:"Musterklinikum GmbH",reference:"Gehalt September · MUSTER",category:"SALARY",amountCents:624000,invoiceId:""},
      {id:"T-02",accountId:"practice",date:"2026-10-01",counterparty:"Muster Vermietung",reference:"Praxisräume · MUSTER",category:"RENT",amountCents:-125000,invoiceId:""},
      {id:"T-03",accountId:"practice",date:"2026-10-03",counterparty:"Muster Medical",reference:"DEMO-2026-001",category:"SUPPLIES",amountCents:-48000,invoiceId:"I-01"}],
    beneficiaries:[{id:"B-01",name:"Muster Medical",maskedReference:"DEMO · INVALID IBAN",verified:false}],
    invoices:[{id:"I-01",beneficiaryId:"B-01",number:"DEMO-2026-001",dueDate:"2026-10-03",amountCents:48000,currency:"EUR",description:"supplies",status:"ALREADY_PAID",evidence:"Synthetic invoice and transaction T-03. No payment network is connected."},
      {id:"I-02",beneficiaryId:"B-01",number:"DEMO-2026-002",dueDate:"2026-10-20",amountCents:72000,currency:"EUR",description:"supplies",status:"NEEDS_REVIEW",evidence:"Illustrative invoice for reviewer training. Public demo cannot prepare or execute payments."}],
    payments:[],events:[{id:"E-01",time:"2026-10-12T10:00:00Z",action:"BANKING_SEEDED",actor:"public-demo",reference:"Synthetic browser fixture"}]};
}
export function demoPlatform(caseId=publicDemoCase.id): PlatformData {
  const banking=demoBanking(caseId);
  return {caseId,persistent:false,generatedAt:"2026-10-12T10:00:00Z",limits:"Browser fixtures · no AI usage",architecture:"Read-only public demo",
    documentPipeline:{worker:false,persistent:false,storage:"Bundled synthetic PDF",scanner:"Not running in public demo",retentionDays:0,
      provider:{mode:"local",activeProvider:"Static sample · not Azure",modelId:"hand-labelled-fixture",maxPages:4}},
    jobs:[{id:"DEMO-J01",name:publicDemoCase.documents[0].name,status:"COMPLETE",stage:"HUMAN_REVIEW",reviewStatus:"review",
      document_id:"doc-1",scan_result:null,error_code:null,sha256:"Illustrative job, not a live upload",createdAt:"2026-10-12T10:00:00Z",expiresAt:"2026-11-11T10:00:00Z",attempt:1}],
    evaluations:[],runs:[],reviews:[],
    agents:[{name:"Supervisor",tools:["routeReadOnlyQuestion"]},{name:"Document",tools:["documentEvidence"]},
      {name:"Banking",tools:["bankAccounts","bankTransactions","bankInvoices"]},
      {name:"Compliance",tools:["reviewPolicy"]},{name:"Risk",tools:["reviewAlerts"]},{name:"Explanation",tools:["explainEvidence"]}],
    banking:{synthetic:true,balanced:true,debitCents:624000,creditCents:624000,adapter:"Static non-submittable sample",
      ledger:[{id:"L-01",date:"2026-09-30",debit:"Demo cash",credit:"Demo salary income",amountCents:624000,reference:"Balanced teaching entry, not a real ledger"}],
      alerts:[{id:"A-01",code:"MONTHLY_RATE_CONFLICT",severity:"MEDIUM",source:"doc-2:p1",detail:"Synthetic example: statement 1250 EUR vs self-disclosure 980 EUR.",humanReview:true}],
      reconciliation:[{documentId:"doc-1",field:"netIncome",value:"6240 EUR",page:1,transactionIds:["T-01"],state:"AMOUNT_ONLY_MATCH",note:"Amount-only synthetic match. Identity and period remain unverified."}],
      categories:banking.transactions.map(row=>({id:row.id,counterparty:row.counterparty,amountCents:row.amountCents,category:row.category,method:"fixture-label"}))}};
}
export function demoSearch(question:string): SearchData {
  const sources=retrieveCaseSources(question,publicDemoCase);
  return {durationMs:0,search:{hits:sources.map(s=>({id:s.id,documentId:s.id.startsWith("doc-")?s.id.split(":")[0]:s.id==="policy"?"policy":"case",
    title:s.title,page:1,kind:"browser-fixture",text:s.id==="case-summary"?"Synthetic case CR-2026-1048. Valuation missing. Monthly rates differ: 1250 EUR vs 980 EUR. Human review required.":s.text,vector:0,lexical:0,score:0})),
    chunks:sources.length,backend:"Browser keyword lookup",embedding:"No model or Qdrant in public demo",reranker:"None",quarantined:[]},
    plan:{specialist:"Explanation",blocked:false,reason:"Deterministic read-only fixture lookup",
      steps:[{agent:"Explanation",task:"Display fixture evidence",tools:["browserFixtures"],state:"DEMO"}]}};
}
export function publicDemoAnswer(question:string,locale:string) {
  const bank=demoBanking(),balance=bankMoney(accountBalance(bank,"practice"),locale);
  const isBank=/account|balance|transaction|konto|kontostand|saldo|giao dịch|tài khoản|số dư/i.test(question);
  const income=publicDemoCase.documents[0].fields![0].value;
  const intro=locale==="de"?"Browser-Demonstration, keine Azure-Antwort.":locale==="vi"?"Minh họa trên trình duyệt, không phải phản hồi Azure.":"Browser demonstration, not an Azure answer.";
  const body=locale==="de"
    ?isBank?`Fiktiver Praxiskontostand: ${balance}. Quelle: statische Konten und Transaktionen [demo-banking]. Keine Bankverbindung.`:`Muster-Nettoeinkommen: ${income} [doc-1:p1]. Die Praxisbewertung fehlt. Monatsraten: 1250 EUR / 980 EUR [doc-2:p1]. Eine Fachperson muss die Belege prüfen.`
    :locale==="vi"
    ?isBank?`Số dư tài khoản phòng khám giả lập: ${balance} [demo-banking]. Chỉ là dữ liệu mẫu, không kết nối ngân hàng.`:`Thu nhập ròng mẫu: ${income} [doc-1:p1]. Thiếu báo cáo định giá. Khoản trả hằng tháng: 1250 EUR / 980 EUR [doc-2:p1]. Người có chuyên môn cần kiểm tra chứng cứ.`
    :isBank?`Synthetic practice balance: ${balance} [demo-banking]. Source: bundled accounts and transactions. No bank connection.`:`Sample net income: ${income} [doc-1:p1]. The practice valuation is missing. Monthly rates: 1250 EUR / 980 EUR [doc-2:p1]. A human must review the evidence.`;
  return `${intro}\n\n${body}`;
}
export const demoXml='<?xml version="1.0" encoding="UTF-8"?><NonSubmittableTeachingSample><Warning>NOT A VALID PAYMENT MESSAGE</Warning><Account>DEMO-INVALID-IBAN</Account><Amount currency="EUR">0</Amount></NonSubmittableTeachingSample>';
