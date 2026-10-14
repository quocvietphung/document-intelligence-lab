package dev.creditlab.banking;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.CreditCaseService;
import java.util.*;
import javax.sql.DataSource;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
/** Compatibility endpoint: bank facts must come from uploaded documents, never seeded accounts. */
@Service
public class BankingLabService {
  private final CreditCaseService cases;private final boolean persistent;
  public BankingLabService(CreditCaseService cases,ObjectMapper mapper,Optional<DataSource> source){this.cases=cases;this.persistent=source.isPresent();}
  public BankingSnapshot snapshot(String tenant,String caseId){
    var item=cases.require(tenant,caseId);
    // Historical banking_lab payloads are not read, mutated or reseeded.
    return new BankingSnapshot(caseId,tenant,false,persistent,item.version(),List.of(),List.of(),List.of(),List.of(),List.of(),List.of());
  }
  public long balance(BankingSnapshot state,String accountId){throw new ResponseStatusException(HttpStatus.NOT_FOUND,"No balance extracted from a verified statement");}
}
