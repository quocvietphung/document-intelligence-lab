package dev.creditlab.platform;

import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Pattern;

/** EUR amount membership in cited paragraphs, NOT semantic entailment, identity or field correctness. */
public final class NumericEvidence {
  private NumericEvidence() {}
  private static final Pattern MONEY=Pattern.compile("(?<![\\p{L}\\d.,-])(-?\\d+(?:[.,]\\d+)*)(?:\\s*)(EUR|€)(?![\\p{L}])",Pattern.CASE_INSENSITIVE);
  private static final Pattern CITE=Pattern.compile("\\[([^\\]\\n]{1,150})\\]");
  public static Optional<String> normalize(String raw) {
    String value=raw;
    if(raw.matches("-?\\d{1,3}(?:\\.\\d{3})+(?:,\\d{2})?"))value=raw.replace(".","").replace(',','.');
    else if(raw.matches("-?\\d{1,3}(?:,\\d{3})+(?:\\.\\d{2})?"))value=raw.replace(",","");
    else if(raw.matches("-?\\d+(?:[.,]\\d{1,2})?"))value=raw.replace(',','.');
    else return Optional.empty();
    try{return Optional.of(new BigDecimal(value).stripTrailingZeros().toPlainString());}catch(NumberFormatException e){return Optional.empty();}
  }
  private static Set<String> amounts(String text){var out=new LinkedHashSet<String>();var m=MONEY.matcher(text);while(m.find())normalize(m.group(1)).ifPresent(out::add);return out;}
  public static Map<String,Object> check(String answer,Map<String,String> sources) {
    var rows=new ArrayList<Map<String,Object>>();
    for(String paragraph:answer.split("\\n+")) {
      var money=amounts(paragraph);if(money.isEmpty())continue;
      var ids=new LinkedHashSet<String>();var m=CITE.matcher(paragraph);while(m.find())ids.add(m.group(1));
      var support=new HashSet<String>();ids.stream().filter(sources::containsKey).forEach(id->support.addAll(amounts(sources.get(id))));
      boolean valid=!ids.isEmpty()&&ids.stream().allMatch(sources::containsKey);
      for(String amount:money)rows.add(Map.of("amount",amount,"currency","EUR","citations",List.copyOf(ids),"matched",valid&&support.contains(amount)));
    }
    return Map.of("method","eur-membership-v1","checked",rows.size(),"matched",rows.stream().filter(r->Boolean.TRUE.equals(r.get("matched"))).count(),
        "requiresReview",rows.isEmpty()||rows.stream().anyMatch(r->!Boolean.TRUE.equals(r.get("matched"))),"rows",rows,
        "limitation","Matching an amount does not prove the correct person, period, field, conclusion or absence of prompt injection.");
  }
}
