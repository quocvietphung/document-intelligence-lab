package dev.creditlab.trust;

import dev.creditlab.casework.CreditCase;
import java.util.*;
import java.util.regex.Pattern;

/** Citation existence/provenance, NOT semantic verification or calibrated accuracy. */
public final class AnswerEvidence {
  private AnswerEvidence() {}
  private static final Pattern CITE=Pattern.compile("\\[([^\\]\\n]{1,150})\\]");
  public static List<Map<String,Object>> claims(String answer,List<Map<String,Object>> sources) {
    var available=new HashSet<String>();sources.forEach(s->available.add((String)s.get("id")));
    var result=new ArrayList<Map<String,Object>>();
    for(String raw:answer.split("\\n+")) {
      String text=raw.strip();if(text.isEmpty())continue;
      var ids=new LinkedHashSet<String>();var m=CITE.matcher(text);while(m.find())ids.add(m.group(1));
      var valid=ids.stream().filter(available::contains).toList();var invalid=ids.stream().filter(id->!available.contains(id)).toList();
      var unsupported=ClaimChecks.unsupportedMoney(CITE.matcher(text).replaceAll(""),sources.stream().filter(s->valid.contains(s.get("id"))).map(s->Objects.toString(s.get("excerpt"),"")).toList());
      result.add(Map.of("text",text.substring(0,Math.min(2000,text.length())),"citations",valid,"invalidCitations",invalid,
          "unsupportedMoney",unsupported,"checkMethod","cited-source currency and amount membership; not semantic verification",
          "state",!valid.isEmpty()&&invalid.isEmpty()&&unsupported.isEmpty()?"SOURCE_LINKED":"REVIEW_REQUIRED"));
      if(result.size()>=30)break;
    }
    return List.copyOf(result);
  }
  public static Map<String,Object> source(CreditCase item,String id,String title,String text) {
    var doc=item.documents().stream().filter(d->id.startsWith(d.id()+":")).findFirst();
    int page=0;var pageMatch=Pattern.compile(":p(\\d+)(?:[:]|$)").matcher(id);
    if(pageMatch.find())try{page=Integer.parseInt(pageMatch.group(1));}catch(NumberFormatException ignored){page=0;}
    if(page==0&&doc.isPresent()&&id.endsWith(":fields"))page=doc.get().fields().stream().mapToInt(CreditCase.Field::page).min().orElse(1);
    var row=new LinkedHashMap<String,Object>();row.put("id",id);row.put("title",title);
    row.put("documentId",doc.map(CreditCase.Document::id).orElse(""));row.put("page",page);
    row.put("originalAvailable",doc.map(CreditCase.Document::originalAvailable).orElse(false));
    row.put("humanReviewed",doc.filter(d->d.originalAvailable()&&d.status().equals("verified")).isPresent());
    row.put("kind",doc.map(d->"synthetic".equals(d.analysisProvider())||"datev-reference-values".equals(d.analysisProvider())?"REFERENCE":"DOCUMENT").orElse(id.startsWith("bank-")?"FIXTURE":id.equals("app-guide")?"APP_GUIDE":"POLICY_OR_CASE"));
    row.put("excerpt",text.substring(0,Math.min(1000,text.length())));return row;
  }
}
