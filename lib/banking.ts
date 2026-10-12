import { z } from "zod";
const cents=z.number().int().safe();
export const bankingSchema=z.object({
  caseId:z.string(),tenantId:z.string(),synthetic:z.literal(true),persistent:z.boolean(),version:z.number().int().nonnegative(),
  accounts:z.array(z.object({id:z.string(),label:z.string(),maskedReference:z.string(),openingCents:cents,currency:z.literal("EUR")})),
  transactions:z.array(z.object({id:z.string(),accountId:z.string(),date:z.string(),counterparty:z.string(),reference:z.string(),category:z.string(),amountCents:cents,invoiceId:z.string()})),
  beneficiaries:z.array(z.object({id:z.string(),name:z.string(),maskedReference:z.string(),verified:z.boolean()})),
  invoices:z.array(z.object({id:z.string(),beneficiaryId:z.string(),number:z.string(),dueDate:z.string(),amountCents:cents.positive(),currency:z.literal("EUR"),description:z.string(),status:z.enum(["NEEDS_REVIEW","ALREADY_PAID","BLOCKED","SIMULATED_PAID"]),evidence:z.string()})),
  payments:z.array(z.object({id:z.string(),requestId:z.string(),accountId:z.string(),invoiceId:z.string(),amountCents:cents.positive(),status:z.enum(["AWAITING_CONFIRMATION","SIMULATED"]),createdBy:z.string(),confirmedBy:z.string(),createdAt:z.string()})),
  events:z.array(z.object({id:z.string(),time:z.string(),action:z.string(),actor:z.string(),reference:z.string()})),
});
export type BankingData=z.infer<typeof bankingSchema>;
export function accountBalance(data:BankingData,id:string) {
  const account=data.accounts.find(a=>a.id===id);
  if(!account)throw new Error("Unknown account");
  return account.openingCents+data.transactions.filter(t=>t.accountId===id).reduce((sum,t)=>sum+t.amountCents,0);
}
export function bankMoney(cents:number,locale:string) {
  return new Intl.NumberFormat(locale==="vi"?"vi-VN":locale==="de"?"de-DE":"en-IE",{style:"currency",currency:"EUR"}).format(cents/100);
}
export function transactionCsv(rows:BankingData["transactions"]) {
  const cell=(value:string)=>`"${value.replaceAll('"','""')}"`;
  // Treat formula-like text as data when opened in spreadsheet software.
  const text=(value:string)=>cell(/^[=+@\-\t\r]/.test(value)?`'${value}`:value);
  return "\uFEFFDate,Account,Counterparty,Reference,Category,Amount EUR\r\n"+rows.map(row=>[text(row.date),text(row.accountId),text(row.counterparty),text(row.reference),text(row.category),cell((row.amountCents/100).toFixed(2))].join(",")).join("\r\n");
}
