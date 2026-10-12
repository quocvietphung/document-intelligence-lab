package dev.creditlab.banking;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.CreditCaseService;
import java.time.Instant;
import java.util.*;
import java.util.function.UnaryOperator;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static dev.creditlab.banking.BankingSnapshot.*;

@Service
public class BankingLabService {
  private final CreditCaseService cases;
  private final ObjectMapper mapper;
  private final JdbcTemplate db;
  private final TransactionTemplate tx;

  public BankingLabService(CreditCaseService cases, ObjectMapper mapper, Optional<DataSource> source) {
    this.cases=cases; this.mapper=mapper;
    db=source.map(JdbcTemplate::new).orElse(null);
    tx=source.map(value->new TransactionTemplate(new DataSourceTransactionManager(value))).orElse(null);
    if(db!=null) db.execute("CREATE TABLE IF NOT EXISTS banking_lab (tenant varchar(120) NOT NULL, case_id varchar(80) NOT NULL, payload text NOT NULL, PRIMARY KEY(tenant,case_id))");
  }

  public BankingSnapshot snapshot(String tenant,String caseId) {
    cases.require(tenant,caseId);
    if(db==null) return seed(tenant,caseId,false);
    var existing=read(tenant,caseId,false);
    if(existing.isPresent()) return existing.get();
    var seeded=seed(tenant,caseId,true);
    try { db.update("INSERT INTO banking_lab(tenant,case_id,payload) VALUES(?,?,?)",tenant,caseId,encode(seeded)); }
    catch(org.springframework.dao.DuplicateKeyException ignored) { /* concurrent first read */ }
    return read(tenant,caseId,false).orElseThrow();
  }

  public long balance(BankingSnapshot state,String accountId) {
    var account=state.accounts().stream().filter(a->a.id().equals(accountId)).findFirst().orElseThrow(()->fail(HttpStatus.NOT_FOUND,"Account unavailable"));
    return account.openingCents()+state.transactions().stream().filter(m->m.accountId().equals(accountId)).mapToLong(Movement::amountCents).sum();
  }

  public BankingSnapshot draft(String tenant,String caseId,String actor,String accountId,String invoiceId,String requestId,long version,boolean checked) {
    return mutate(tenant,caseId,state->{
      var repeated=state.payments().stream().filter(p->p.requestId().equals(requestId)).findFirst();
      if(repeated.isPresent()) {
        if(!repeated.get().accountId().equals(accountId)||!repeated.get().invoiceId().equals(invoiceId)) throw fail(HttpStatus.CONFLICT,"Request ID reused for different values");
        return state;
      }
      requireVersion(state,version);
      if(!checked) throw fail(HttpStatus.UNPROCESSABLE_ENTITY,"Human source check required");
      var invoice=state.invoices().stream().filter(i->i.id().equals(invoiceId)).findFirst().orElseThrow(()->fail(HttpStatus.NOT_FOUND,"Invoice unavailable"));
      if(!invoice.status().equals("NEEDS_REVIEW")) throw fail(HttpStatus.CONFLICT,"Invoice already paid or blocked");
      if(state.beneficiaries().stream().noneMatch(b->b.id().equals(invoice.beneficiaryId())&&b.verified())) throw fail(HttpStatus.UNPROCESSABLE_ENTITY,"Unverified beneficiary");
      if(state.payments().stream().anyMatch(p->p.invoiceId().equals(invoiceId))) throw fail(HttpStatus.CONFLICT,"Payment draft already exists");
      var account=state.accounts().stream().filter(a->a.id().equals(accountId)).findFirst().orElseThrow(()->fail(HttpStatus.NOT_FOUND,"Account unavailable"));
      if(!account.currency().equals(invoice.currency())||invoice.amountCents()<=0||balance(state,accountId)<invoice.amountCents()) throw fail(HttpStatus.UNPROCESSABLE_ENTITY,"Insufficient balance or incompatible currency");
      var payment=new Payment("SIM-"+UUID.randomUUID(),requestId,accountId,invoiceId,invoice.amountCents(),"AWAITING_CONFIRMATION",actor,"",Instant.now().toString());
      var payments=new ArrayList<>(state.payments()); payments.add(payment);
      return revised(state,state.transactions(),state.invoices(),payments,event("PAYMENT_DRAFTED",actor,payment.id()));
    });
  }

  public BankingSnapshot confirm(String tenant,String caseId,String actor,String paymentId,long version,boolean confirmed) {
    return mutate(tenant,caseId,state->{
      var payment=state.payments().stream().filter(p->p.id().equals(paymentId)).findFirst().orElseThrow(()->fail(HttpStatus.NOT_FOUND,"Payment unavailable"));
      if(payment.status().equals("SIMULATED")) return state; // retry does not debit twice
      requireVersion(state,version);
      if(!confirmed) throw fail(HttpStatus.UNPROCESSABLE_ENTITY,"Explicit simulation confirmation required");
      if(balance(state,payment.accountId())<payment.amountCents()) throw fail(HttpStatus.UNPROCESSABLE_ENTITY,"Insufficient balance");
      var invoice=state.invoices().stream().filter(i->i.id().equals(payment.invoiceId())).findFirst().orElseThrow();
      if(!invoice.status().equals("NEEDS_REVIEW")||state.transactions().stream().anyMatch(t->t.invoiceId().equals(invoice.id()))) throw fail(HttpStatus.CONFLICT,"Invoice already paid");
      var beneficiary=state.beneficiaries().stream().filter(b->b.id().equals(invoice.beneficiaryId())&&b.verified()).findFirst().orElseThrow(()->fail(HttpStatus.UNPROCESSABLE_ENTITY,"Unverified beneficiary"));
      var transactions=new ArrayList<>(state.transactions());
      transactions.add(new Movement("TX-"+UUID.randomUUID(),payment.accountId(),Instant.now().toString().substring(0,10),beneficiary.name(),invoice.number(),"EQUIPMENT",-payment.amountCents(),invoice.id()));
      var payments=state.payments().stream().map(p->p.id().equals(paymentId)?new Payment(p.id(),p.requestId(),p.accountId(),p.invoiceId(),p.amountCents(),"SIMULATED",p.createdBy(),actor,p.createdAt()):p).toList();
      var invoices=state.invoices().stream().map(i->i.id().equals(invoice.id())?new Invoice(i.id(),i.beneficiaryId(),i.number(),i.dueDate(),i.amountCents(),i.currency(),i.description(),"SIMULATED_PAID",i.evidence()):i).toList();
      return revised(state,transactions,invoices,payments,event("PAYMENT_SIMULATED",actor,paymentId));
    });
  }

  private BankingSnapshot mutate(String tenant,String caseId,UnaryOperator<BankingSnapshot> action) {
    cases.require(tenant,caseId); cases.allowWrite();
    if(db==null||tx==null) throw fail(HttpStatus.SERVICE_UNAVAILABLE,"Persistent simulation unavailable");
    snapshot(tenant,caseId);
    return tx.execute(status->{
      var current=read(tenant,caseId,true).orElseThrow();
      var updated=action.apply(current);
      if(updated!=current) db.update("UPDATE banking_lab SET payload=? WHERE tenant=? AND case_id=?",encode(updated),tenant,caseId);
      return updated;
    });
  }

  private Optional<BankingSnapshot> read(String tenant,String caseId,boolean locked) {
    return db.query("SELECT payload FROM banking_lab WHERE tenant=? AND case_id=?"+(locked?" FOR UPDATE":""),(row,n)->decode(row.getString(1)),tenant,caseId).stream().findFirst();
  }
  private BankingSnapshot decode(String json) { try{return mapper.readValue(json,BankingSnapshot.class);}catch(Exception e){throw new IllegalStateException("Invalid banking snapshot");} }
  private String encode(BankingSnapshot value) { try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException("Banking snapshot encoding failed");} }
  private void requireVersion(BankingSnapshot state,long version) { if(state.version()!=version) throw fail(HttpStatus.CONFLICT,"Refresh latest simulation version"); }
  private ResponseStatusException fail(HttpStatus status,String message) { return new ResponseStatusException(status,message); }
  private Event event(String action,String actor,String reference) { return new Event(UUID.randomUUID().toString(),Instant.now().toString(),action,actor,reference); }
  private BankingSnapshot revised(BankingSnapshot s,List<Movement> movements,List<Invoice> invoices,List<Payment> payments,Event event) {
    var events=new ArrayList<>(s.events());events.add(event);
    return new BankingSnapshot(s.caseId(),s.tenantId(),true,s.persistent(),s.version()+1,s.accounts(),List.copyOf(movements),s.beneficiaries(),List.copyOf(invoices),List.copyOf(payments),List.copyOf(events));
  }
  private BankingSnapshot seed(String tenant,String id,boolean persistent) {
    var accounts=List.of(new Account("practice","practice","DEMO •••• 1048",2_500_000,"EUR"),new Account("personal","personal","DEMO •••• 2048",350_000,"EUR"),new Account("reserve","reserve","DEMO •••• 3048",1_200_000,"EUR"));
    var beneficiaries=List.of(new Beneficiary("meditech","MediTech Muster GmbH","DEMO •••• 4401",true),new Beneficiary("supplies","Praxisbedarf Beispiel KG","DEMO •••• 4402",true),new Beneficiary("unknown","Ungeprüfter Musterlieferant","DEMO •••• 4499",false));
    var movements=List.of(
      new Movement("T-01","practice","2026-10-01","KV Musterregion","Honorar September","REVENUE",1_800_000,""),
      new Movement("T-02","practice","2026-10-02","Praxis-Team (synthetic)","Gehälter","SALARY",-625_000,""),
      new Movement("T-03","practice","2026-10-03","Praxisimmobilien Muster","Miete Oktober","RENT",-185_000,""),
      new Movement("T-04","practice","2026-10-04","Demo Finanzierung","Rate Praxisdarlehen","LOAN",-125_000,""),
      new Movement("T-05","practice","2026-10-05","Praxisbedarf Beispiel KG","PB-2026-091","SUPPLIES",-120_000,"INV-PAID"),
      new Movement("T-06","practice","2026-10-06","Software Muster AG","Praxissoftware","SOFTWARE",-34_900,""),
      new Movement("T-07","practice","2026-10-07","Privatpatienten (synthetic)","Sammelzahlung","REVENUE",245_000,""),
      new Movement("T-08","personal","2026-10-01","Musterklinikum","Gehalt September","SALARY",624_000,""),
      new Movement("T-09","personal","2026-10-02","Wohnraum Muster","Wohnungsmiete","RENT",-148_000,""),
      new Movement("T-10","personal","2026-10-04","Demo Finanzierung","Privatdarlehen","LOAN",-98_000,""),
      new Movement("T-11","personal","2026-10-08","Lebensmittel Muster","Alltag","LIVING",-24_500,""));
    var invoices=List.of(
      new Invoice("INV-EQUIPMENT","meditech","MT-2026-108","2026-10-20",248_000,"EUR","equipment","NEEDS_REVIEW","Synthetic invoice MT-2026-108; MediTech Muster GmbH; total 2,480.00 EUR. Fixture, not OCR output."),
      new Invoice("INV-PAID","supplies","PB-2026-091","2026-10-05",120_000,"EUR","supplies","ALREADY_PAID","Synthetic fixture matches transaction T-05. Paying it again is blocked."),
      new Invoice("INV-UNKNOWN","unknown","XX-2026-009","2026-10-18",89_000,"EUR","unverified","BLOCKED","Synthetic fixture: beneficiary is not verified. Human investigation required; no payment draft allowed."));
    return new BankingSnapshot(id,tenant,true,persistent,0,accounts,movements,beneficiaries,invoices,List.of(),List.of(event("BANKING_SEEDED","synthetic-seed",id)));
  }
}
