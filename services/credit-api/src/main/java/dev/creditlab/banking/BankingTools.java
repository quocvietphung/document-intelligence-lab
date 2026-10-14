package dev.creditlab.banking;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.agent.tool.Tool;
import java.util.Map;

/** Bound by the server to one verified tenant/case; no model-selected identifier or write tool. */
public class BankingTools {
  private final BankingSnapshot state;
  private final ObjectMapper mapper;
  public BankingTools(BankingSnapshot state,ObjectMapper mapper) { this.state=state;this.mapper=mapper; }
  @Tool("Read synthetic account balances for the selected case. These are fixtures, not uploaded document extractions.")
  public String bankAccounts() {
    return json(Map.of("sourceId","bank-accounts","synthetic",true,"accounts",state.accounts().stream().map(a->Map.of(
        "id",a.id(),"label",a.label(),"currency",a.currency(),"balanceCents",a.openingCents()+state.transactions().stream().filter(t->t.accountId().equals(a.id())).mapToLong(BankingSnapshot.Movement::amountCents).sum())).toList()));
  }
  @Tool("Read synthetic transactions for the selected case. Integer amounts are cents, negative means outgoing.")
  public String bankTransactions() { return json(Map.of("sourceId","bank-transactions","synthetic",true,"transactions",state.transactions().stream().skip(Math.max(0,state.transactions().size()-30)).toList())); }
  @Tool("Read sample invoice evidence and supplier verification for document reconciliation. Analysis only; no payment functionality exists.")
  public String bankInvoices() { return json(Map.of("sourceId","bank-invoices","synthetic",true,"invoices",state.invoices(),"beneficiaries",state.beneficiaries())); }
  private String json(Object value) {try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException("Tool encoding unavailable");}}
}
