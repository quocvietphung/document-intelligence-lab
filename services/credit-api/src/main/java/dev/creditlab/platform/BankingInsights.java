package dev.creditlab.platform;
import dev.creditlab.banking.BankingLabService;
import dev.creditlab.casework.*;
import java.util.*;
import org.springframework.stereotype.Service;
/** Document-backed checks only. Never matches payroll against invented transactions. */
@Service
public class BankingInsights {
  public BankingInsights(BankingLabService unused){}
  public Map<String,Object> read(CreditCase item){
    var alerts=new ArrayList<Map<String,Object>>();var docs=item.documents().stream().filter(d->d.originalAvailable()).toList();
    for(var doc:docs)if(!doc.status().equals("verified"))alerts.add(Map.of("id","UNREVIEWED_DOCUMENT-"+doc.id(),"code","UNREVIEWED_DOCUMENT","severity","MEDIUM","source",doc.id(),"detail",doc.name(),"humanReview",true));
    var rates=new HashSet<String>();for(var doc:docs)for(var field:doc.fields())if(field.label().equals("monthlyRate"))rates.add(FieldValueNormalizer.normalize(field.label(),field.value()));
    if(rates.size()>1)alerts.add(Map.of("id","MONTHLY_RATE_CONFLICT-"+item.id(),"code","MONTHLY_RATE_CONFLICT","severity","HIGH","source",item.id(),"detail","Different values extracted from uploaded documents","humanReview",true));
    var result=new LinkedHashMap<String,Object>();
    result.put("synthetic",false);result.put("ledger",List.of());result.put("debitCents",0);result.put("creditCents",0);result.put("balanced",false);
    result.put("alerts",alerts);result.put("reconciliation",List.of());result.put("categories",List.of());
    result.put("adapter","uploaded-document-evidence-only; no banking fixtures or payment services");return result;
  }
}
