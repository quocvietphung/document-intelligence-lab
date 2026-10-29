package dev.creditlab.platform;

import java.util.*;
import java.util.function.Function;

/** Top-five chunk evaluation with one relevance credit per labelled document/page. */
final class RetrievalEvaluation {
  @SuppressWarnings("unchecked") static List<Map<String,Object>> sources(Map<String,Object> label){
    if(label.get("relevant") instanceof List<?> list)return (List<Map<String,Object>>)(List<?>)list;
    if(Boolean.FALSE.equals(label.get("answerable")))return List.of();
    return List.of(Map.of("documentId",label.get("documentId"),"page",label.get("page")));
  }
  private static String key(Object document,Object page){return document+":"+page;}
  static Map<String,Object> evaluate(List<Map<String,Object>> labels,Function<String,RagEngine.Search> search){
    var rows=new ArrayList<Map<String,Object>>();
    for(var label:labels){
      long start=System.nanoTime();var hits=search.apply(label.get("question").toString()).hits().stream().limit(5).toList();double ms=(System.nanoTime()-start)/1_000_000.0;
      var expected=new HashSet<String>();sources(label).forEach(s->expected.add(key(s.get("documentId"),s.get("page"))));
      boolean answerable=!Boolean.FALSE.equals(label.get("answerable"));var found=new HashSet<String>();double dcg=0;int first=0;
      for(int i=0;i<hits.size();i++){var h=hits.get(i);String source=key(h.documentId(),h.page());if(expected.contains(source)&&found.add(source)){if(first==0)first=i+1;dcg+=1.0/(Math.log(i+2)/Math.log(2));}}
      double ideal=0;for(int i=0;i<Math.min(5,expected.size());i++)ideal+=1.0/(Math.log(i+2)/Math.log(2));
      var row=new LinkedHashMap<>(label);row.put("answerable",answerable);row.put("evaluated",answerable);row.put("rank",first);row.put("passed",answerable&&first>0);row.put("durationMs",ms);
      row.put("recallAt5",expected.isEmpty()?0.0:100.0*found.size()/expected.size());row.put("uniquePrecisionAt5",hits.isEmpty()?0.0:100.0*found.size()/hits.size());row.put("ndcgAt5",ideal==0?0.0:100*dcg/ideal);
      row.put("hits",hits.stream().map(h->Map.of("id",h.id(),"documentId",h.documentId(),"page",h.page(),"score",h.score())).toList());
      if(!answerable)row.put("reason","ANSWERABILITY_NOT_EVALUATED");rows.add(row);
    }
    var result=new LinkedHashMap<String,Object>();result.put("samples",labels.size());result.put("metrics",metrics(rows));result.put("rows",rows);
    result.put("groups",rows.stream().map(r->Objects.toString(r.get("split"),"unassigned")).distinct().sorted().map(split->Map.of("split",split,"metrics",metrics(rows.stream().filter(r->Objects.toString(r.get("split"),"unassigned").equals(split)).toList()))).toList());
    result.put("measurement","Top five chunks; unique document/page relevance credit. Negative questions retained; no answerability or LLM-accuracy claim. Isolated local ranking, not Qdrant service latency.");return result;
  }
  private static Map<String,Object> metrics(List<Map<String,Object>> rows){
    var positive=rows.stream().filter(r->Boolean.TRUE.equals(r.get("answerable"))).toList();var value=new LinkedHashMap<String,Object>();
    value.put("answerableSamples",positive.size());value.put("unanswerableQuestions",rows.size()-positive.size());
    value.put("hitRateAt5",mean(positive,r->Boolean.TRUE.equals(r.get("passed"))?100.0:0.0));
    value.put("mrrAt5",mean(positive,r->((Number)r.get("rank")).intValue()==0?0.0:100.0/((Number)r.get("rank")).intValue()));
    for(var metric:List.of("recallAt5","uniquePrecisionAt5","ndcgAt5"))value.put(metric,mean(positive,r->((Number)r.get(metric)).doubleValue()));
    var times=rows.stream().mapToDouble(r->((Number)r.get("durationMs")).doubleValue()).sorted().toArray();
    value.put("p50Ms",percentile(times,.5));value.put("p95Ms",percentile(times,.95));return value;
  }
  private static Double mean(List<Map<String,Object>> rows,Function<Map<String,Object>,Double> value){return rows.isEmpty()?null:Math.round(rows.stream().mapToDouble(r->value.apply(r)).average().orElse(0)*100)/100.0;}
  private static Double percentile(double[] values,double percentile){return values.length==0?null:Math.round(values[Math.max(0,(int)Math.ceil(values.length*percentile)-1)]*100)/100.0;}
}
