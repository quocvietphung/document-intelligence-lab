import type { WorkspaceCase } from "./credit-api";
import { demoCase } from "./credit-data";
import { retrieveCaseSources } from "./credit-chat";
import { accountBalance, bankMoney, type BankingData } from "./banking";
import type { PlatformData, SearchData } from "./platform";
import {datevReferences} from "./datev-reference";

/** Public fixtures only. No tenant data, provider calls, credentials or persistence. */
export const publicDemoCase: WorkspaceCase = {
  ...demoCase, applicant: "Dr. Lea Muster", coApplicant: "Jonas Beispiel",
  version: 0, amountEuro: 480000, status: "HUMAN_REVIEW",
  documents: [
    ...datevReferences.map((reference,index)=>({id:index===0?"doc-1":"doc-5",name:reference.file,type:"income",status:"review" as const,
      analysisProvider:"datev-reference-values",modelId:"publisher-reference-not-ai",confidence:null,originalAvailable:false,
      fields:[{label:"netIncome",value:reference.net,confidence:null,page:1,evidence:`DATEV LODAS 2025 · ${reference.name} · Netto-Verdienst ${reference.net}`},
        {label:"payoutAmount",value:reference.payout,confidence:null,page:1,evidence:`DATEV LODAS 2025 · ${reference.name} · Auszahlungsbetrag ${reference.payout}`}],
      pages:[{number:1,method:"publisher-reference-values",text:`DATEV LODAS 2025 reference values only; not an OCR result or original PDF. Publisher page ${reference.publisherPage}.\n${reference.name}\nNettoeinkommen / Netto-Verdienst: ${reference.net}\nAuszahlungsbetrag: ${reference.payout}\nPeriod: Dezember 2025. Different fictional identities: not evidence of the demo applicant's salary.`}]})),
    {id:"doc-2",name:"Kontoauszug_Q3_MUSTER.txt",type:"statement",status:"review",originalAvailable:false,
      fields:[{label:"monthlyRate",value:"1250 EUR",confidence:null,page:1}],
      pages:[{number:1,method:"static-demo",text:`FIKTIVER KONTOAUSZUG\nGehalt: ${datevReferences[0].payout}\nMonatliche Rate: 1250 EUR`}]},
    {id:"doc-3",name:"Identitätsnachweis · Muster",type:"identity",status:"review",originalAvailable:false},
    {id:"doc-4",name:"Praxisbewertung",type:"valuation",status:"missing",originalAvailable:false},
  ],
  issues:[{severity:"high",title:"Missing required document",detail:"valuation"},
    {severity:"medium",title:"MONTHLY_RATE_CONFLICT",detail:"1250 EUR / 980 EUR",documentId:"doc-2"}],
  audit:[["2026-10-12 10:00","FIXTURE_CREATED","public-demo"]],
};
export function demoPdfUrl(documentId:string): undefined {
  // Publisher-owned originals are never bundled into a public demo.
  void documentId;
  return undefined;
}
export function demoBanking(caseId=publicDemoCase.id): BankingData {
  return {caseId,tenantId:publicDemoCase.tenantId,synthetic:true,persistent:false,version:0,
    accounts:[{id:"practice",label:"practice",maskedReference:"DEMO · NOT AN IBAN",openingCents:1200000,currency:"EUR"},
      {id:"reserve",label:"reserve",maskedReference:"DEMO · RESERVE",openingCents:800000,currency:"EUR"}],
    transactions:[
      {id:"T-01",accountId:"practice",date:"2025-12-31",counterparty:"DATEV reference teaching movement",reference:"Mock movement for Robert reference payout · NOT an actual bank record",category:"SALARY",amountCents:288211,invoiceId:""},
      {id:"T-02",accountId:"practice",date:"2026-10-01",counterparty:"Muster Vermietung",reference:"Praxisräume · MUSTER",category:"RENT",amountCents:-125000,invoiceId:""},
      {id:"T-03",accountId:"practice",date:"2026-10-03",counterparty:"Muster Medical",reference:"DEMO-2026-001",category:"SUPPLIES",amountCents:-48000,invoiceId:"I-01"}],
    beneficiaries:[{id:"B-01",name:"Muster Medical",maskedReference:"DEMO · INVALID IBAN",verified:false}],
    invoices:[{id:"I-01",beneficiaryId:"B-01",number:"DEMO-2026-001",dueDate:"2026-10-03",amountCents:48000,currency:"EUR",description:"supplies",status:"ALREADY_PAID",evidence:"Synthetic invoice and transaction T-03. Read-only statement evidence."},
      {id:"I-02",beneficiaryId:"B-01",number:"DEMO-2026-002",dueDate:"2026-10-20",amountCents:72000,currency:"EUR",description:"supplies",status:"NEEDS_REVIEW",evidence:"Illustrative invoice for reviewer training. Document analysis only; no payment functionality exists."}],
    payments:[],events:[{id:"E-01",time:"2026-10-12T10:00:00Z",action:"BANKING_SEEDED",actor:"public-demo",reference:"Synthetic browser fixture"}]};
}
export function demoPlatform(caseId=publicDemoCase.id): PlatformData {
  const banking=demoBanking(caseId);
  return {caseId,persistent:false,generatedAt:"2026-10-12T10:00:00Z",limits:"Browser fixtures · no AI usage",architecture:"Read-only public demo",
    documentPipeline:{worker:false,persistent:false,storage:"DATEV reference values only; originals private",scanner:"Not running in public demo",retentionDays:0,
      provider:{mode:"local",activeProvider:"Reference values · no extraction",modelId:"publisher-reference-not-ai",maxPages:4}},
    jobs:[],
    evaluations:[],runs:[],reviews:[],
    agents:[{name:"Supervisor",tools:["routeReadOnlyQuestion"]},{name:"Document",tools:["documentEvidence"]},
      {name:"Banking",tools:["bankAccounts","bankTransactions","bankInvoices"]},
      {name:"Compliance",tools:["reviewPolicy"]},{name:"Risk",tools:["reviewAlerts"]},{name:"Explanation",tools:["explainEvidence"]}],
    banking:{synthetic:true,balanced:true,debitCents:288211,creditCents:288211,adapter:"Static non-submittable sample",
      ledger:[{id:"L-01",date:"2025-12-31",debit:"Demo cash",credit:"Demo salary payout",amountCents:288211,reference:"Balanced teaching entry, not a real ledger"}],
      alerts:[{id:"A-01",code:"MONTHLY_RATE_CONFLICT",severity:"MEDIUM",source:"doc-2:p1",detail:"Synthetic example: statement 1250 EUR vs self-disclosure 980 EUR.",humanReview:true}],
      reconciliation:[{documentId:"doc-1",field:"payoutAmount",value:datevReferences[0].payout,page:1,transactionIds:["T-01"],state:"AMOUNT_ONLY_MATCH",note:"Reference payout vs mock transaction only. This is not evidence of the demo applicant's salary."}],
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
