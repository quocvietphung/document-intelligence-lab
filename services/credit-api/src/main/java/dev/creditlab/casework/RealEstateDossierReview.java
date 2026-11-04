package dev.creditlab.casework;

import java.math.BigDecimal;
import java.util.*;

/** Deterministic cross-document checks; every finding still requires source review. */
final class RealEstateDossierReview {
  private RealEstateDossierReview() {}

  static List<CreditCase.ValidationIssue> evaluate(String domain,List<CreditCase.Document> documents) {
    if(!"real-estate".equals(domain))return List.of();
    var issues=new ArrayList<CreditCase.ValidationIssue>();
    var projectIds=values(documents,"projectId");
    var orderNumbers=values(documents,"orderNumber");
    if(projectIds.size()>1)issues.add(issue("PROJECT_REFERENCE_CONFLICT","HIGH","Project IDs differ across source documents"));
    if(orderNumbers.size()>1)issues.add(issue("ORDER_REFERENCE_CONFLICT","HIGH","Order numbers differ across source documents"));

    var order=money(documents,"orderTotal",false);
    var changes=money(documents,"changeOrderTotal",true);
    var invoice=money(documents,"invoiceTotal",false);
    if(order.isPresent()&&invoice.isPresent()) {
      BigDecimal approved=order.get().add(changes.orElse(BigDecimal.ZERO));
      BigDecimal variance=invoice.get().subtract(approved);
      if(variance.signum()>0)issues.add(issue("CONSTRUCTION_INVOICE_EXCEEDS_APPROVED_VALUE","HIGH",
          "Extracted invoice exceeds extracted order plus change orders by "+variance.setScale(2).toPlainString()+" EUR; verify every source value"));
      else if(variance.signum()<0)issues.add(issue("CONSTRUCTION_INVOICE_BELOW_APPROVED_VALUE","MEDIUM",
          "Extracted invoice is below extracted order plus change orders by "+variance.abs().setScale(2).toPlainString()+" EUR; verify scope and partial billing"));
    }

    values(documents,"openDefects").stream().map(RealEstateDossierReview::integer).filter(value->value>0).findFirst()
        .ifPresent(value->issues.add(issue("OPEN_ACCEPTANCE_DEFECTS","MEDIUM",value+" extracted acceptance defects remain open; inspect the acceptance source and deadline")));
    var acceptanceDeadlines=values(documents,"remediationDeadline");
    var taskDeadlines=values(documents,"taskDeadline");
    if(!acceptanceDeadlines.isEmpty()&&!taskDeadlines.isEmpty()&&Collections.disjoint(acceptanceDeadlines,taskDeadlines))
      issues.add(issue("REMEDIATION_DEADLINE_CONFLICT","HIGH","Acceptance and site-minutes deadlines differ"));
    return List.copyOf(issues);
  }

  private static CreditCase.ValidationIssue issue(String code,String severity,String message) {
    return new CreditCase.ValidationIssue(code,severity,message,true);
  }
  private static Set<String> values(List<CreditCase.Document> documents,String label) {
    var values=new LinkedHashSet<String>();
    for(var document:documents)for(var field:document.fields())if(field.label().equals(label))values.add(FieldValueNormalizer.normalize(label,field.value()));
    values.remove("");return values;
  }
  private static Optional<BigDecimal> money(List<CreditCase.Document> documents,String label,boolean sum) {
    var observations=new LinkedHashMap<String,BigDecimal>();
    for(var document:documents)for(var field:document.fields())if(field.label().equals(label)) {
      try { observations.putIfAbsent(document.id(),new BigDecimal(FieldValueNormalizer.normalize(label,field.value()))); }
      catch(NumberFormatException ignored) { /* Invalid money stays a normal extraction finding. */ }
    }
    if(observations.isEmpty())return Optional.empty();
    if(!sum) {
      var distinct=new LinkedHashSet<>(observations.values());
      return distinct.size()==1?Optional.of(distinct.iterator().next()):Optional.empty();
    }
    return Optional.of(observations.values().stream().reduce(BigDecimal.ZERO,BigDecimal::add));
  }
  private static int integer(String value) {try{return Integer.parseInt(value.replaceAll("[^0-9]",""));}catch(NumberFormatException ignored){return 0;}}
}
