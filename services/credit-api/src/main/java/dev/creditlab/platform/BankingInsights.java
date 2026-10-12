package dev.creditlab.platform;

import dev.creditlab.banking.*;
import dev.creditlab.casework.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class BankingInsights {
  private final BankingLabService banking;
  public BankingInsights(BankingLabService banking){this.banking=banking;}
  public Map<String,Object> read(CreditCase item) {
    var bank=banking.snapshot(item.tenantId(),item.id());var ledger=new ArrayList<Map<String,Object>>();long debits=0,credits=0;
    for(var movement:bank.transactions()) {
      long amount=Math.abs(movement.amountCents());String debit=movement.amountCents()>0?"Bank:"+movement.accountId():"Expense:"+movement.category();String credit=movement.amountCents()>0?"Income:"+movement.category():"Bank:"+movement.accountId();
      ledger.add(Map.of("id",movement.id(),"date",movement.date(),"debit",debit,"credit",credit,"amountCents",amount,"reference",movement.reference()));debits+=amount;credits+=amount;
    }
    var categories=bank.transactions().stream().map(t->Map.of("id",t.id(),"counterparty",t.counterparty(),"amountCents",t.amountCents(),"category",t.category(),"method","seeded category; Nova can explain on request")).toList();
    var alerts=new ArrayList<Map<String,Object>>();
    for(var invoice:bank.invoices()) {
      if(invoice.status().equals("ALREADY_PAID"))alerts.add(alert("DUPLICATE_INVOICE","MEDIUM",invoice.id(),"Already-paid invoice matches a sample movement. Review evidence; do not classify this as fraud."));
      if(invoice.status().equals("BLOCKED"))alerts.add(alert("UNVERIFIED_BENEFICIARY","HIGH",invoice.id(),"Beneficiary is unverified in the synthetic fixture."));
    }
    item.validationIssues().forEach(i->alerts.add(alert(i.code(),i.severity(),item.id(),i.message())));
    var reconciliation=new ArrayList<Map<String,Object>>();
    for(var d:item.documents()) for(var f:d.fields()) if(f.label().equals("netIncome")||f.label().equals("payoutAmount")) {
      Long cents=money(f.value());var matches=bank.transactions().stream().filter(t->cents!=null&&t.amountCents()>0&&t.category().equals("SALARY")&&t.amountCents()==cents).map(BankingSnapshot.Movement::id).toList();
      reconciliation.add(Map.of("documentId",d.id(),"field",f.label(),"value",f.value(),"page",f.page(),"transactionIds",matches,"state",matches.isEmpty()?"NO_MATCH":"AMOUNT_ONLY_MATCH","note","Amount-only comparison with synthetic movements. Period and account holder are not validated; human review required."));
    }
    return Map.of("synthetic",true,"ledger",ledger,"debitCents",debits,"creditCents",credits,"balanced",debits==credits,"alerts",alerts,"reconciliation",reconciliation,"categories",categories,"adapter","Open Banking fixture adapter v1; no bank network connection");
  }
  private Map<String,Object> alert(String code,String severity,String source,String detail){return Map.of("id",code+"-"+source,"code",code,"severity",severity,"source",source,"detail",detail,"humanReview",true);}
  private Long money(String value){try{String s=value.replaceAll("[^0-9,.-]","");if(s.contains(","))s=s.replace(".","").replace(',','.');return new java.math.BigDecimal(s).movePointRight(2).longValueExact();}catch(Exception e){return null;}}
  public String sampleXml(String caseId) {
    // Deliberately invalid bank identifiers prevent this sample from being usable for payment submission.
    return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!-- NON-SUBMITTABLE SYNTHETIC TRAINING EXAMPLE; no payment route exists -->\n<Document xmlns=\"urn:iso:std:iso:20022:tech:xsd:pain.001.001.09\"><CstmrCdtTrfInitn><GrpHdr><MsgId>LAB-"+caseId+"</MsgId><NbOfTxs>1</NbOfTxs><CtrlSum>12.00</CtrlSum></GrpHdr><PmtInf><PmtInfId>DEMO-ONLY</PmtInfId><Dbtr><Nm>Musterperson</Nm></Dbtr><DbtrAcct><Id><IBAN>DEMO-NOT-AN-IBAN</IBAN></Id></DbtrAcct></PmtInf></CstmrCdtTrfInitn></Document>";
  }
}
