package dev.creditlab.platform;

import com.fasterxml.jackson.databind.*;
import dev.creditlab.casework.*;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class LabEvaluation {
  private final DocumentExtractor extractor;private final LabStore store;private final JsonNode dataset;private final RagEngine rag;
  public LabEvaluation(DocumentExtractor extractor,LabStore store,ObjectMapper mapper,RagEngine rag){this.extractor=extractor;this.store=store;this.rag=rag;try(var input=getClass().getResourceAsStream("/lab-evaluation.json")){dataset=mapper.readTree(input);}catch(Exception e){throw new IllegalStateException("Evaluation dataset unavailable",e);}}
  public Map<String,Object> run(CreditCase item) {
    int tp=0,fp=0,fn=0,correct=0,quarantined=0;var rows=new ArrayList<Map<String,Object>>();var totals=new TreeMap<String,int[]>();var confusion=new TreeMap<String,Integer>();
    for(var reference:dataset.path("references")) {
      String text=reference.path("text").asText();var doc=extractor.parse(reference.path("id").asText(),List.of(new CreditCase.Page(1,text,"synthetic-reference")),null);
      var actual=new HashMap<String,String>();doc.fields().forEach(f->actual.put(f.label(),f.value()));var expected=new HashMap<String,String>();reference.path("fields").properties().forEach(e->expected.put(e.getKey(),e.getValue().asText()));
      boolean type=doc.type().equals(reference.path("type").asText());if(type)correct++;confusion.merge(reference.path("type").asText()+" → "+doc.type(),1,Integer::sum);
      var labels=new HashSet<>(expected.keySet());labels.addAll(actual.keySet());var misses=new ArrayList<String>();
      for(String label:labels) {var count=totals.computeIfAbsent(label,k->new int[3]);if(expected.containsKey(label)&&expected.get(label).equals(actual.get(label))){tp++;count[0]++;}else{if(actual.containsKey(label)){fp++;count[1]++;}if(expected.containsKey(label)){fn++;count[2]++;}misses.add(label);}}
      boolean injection=EvidenceGuard.suspicious(text);if(injection)quarantined++;
      rows.add(Map.of("id",reference.path("id").asText(),"scenario",reference.path("scenario").asText(),"expectedType",reference.path("type").asText(),"actualType",doc.type(),"typeCorrect",type,"expected",expected,"actual",actual,"misses",misses,"quarantined",injection));
    }
    var fields=new ArrayList<Map<String,Object>>();for(var e:totals.entrySet()){var c=e.getValue();var v=new LinkedHashMap<String,Object>(metrics(c[0],c[1],c[2]));v.put("field",e.getKey());fields.add(v);}
    var retrieval=List.of(new String[]{"salary net income","netIncome"},new String[]{"employer","employer"},new String[]{"payout amount","payoutAmount"},new String[]{"monthly rate","monthlyRate"},new String[]{"statement balance","balance"});
    List<RagEngine.Chunk> corpus=new ArrayList<>();for(var ref:dataset.path("references"))corpus.add(new RagEngine.Chunk(ref.path("id").asText(),ref.path("id").asText(),ref.path("scenario").asText(),1,"reference",ref.path("text").asText()));
    double recall=0;var retrievalRows=new ArrayList<Map<String,Object>>();
    for(var query:retrieval){var relevant=new HashSet<String>();for(var ref:dataset.path("references"))if(ref.path("fields").has(query[1])&&!EvidenceGuard.suspicious(ref.path("text").asText()))relevant.add(ref.path("id").asText());var found=rag.search(item,corpus,query[0],5).hits();long hit=found.stream().filter(h->relevant.contains(h.id())).count();double value=relevant.isEmpty()?0:(double)hit/relevant.size();recall+=value;retrievalRows.add(Map.of("question",query[0],"relevant",relevant.size(),"found",hit,"recallAt5",percent(value)));}
    var report=new LinkedHashMap<String,Object>();report.put("id","eval-"+UUID.randomUUID());report.put("createdAt",Instant.now().toString());report.put("version",dataset.path("version").asText());report.put("scope",dataset.path("scope").asText());report.put("references",rows.size());report.put("classification",percent((double)correct/rows.size()));report.putAll(metrics(tp,fp,fn));report.put("fields",fields);report.put("confusion",confusion);report.put("rows",rows);report.put("injectionQuarantined",quarantined);report.put("retrieval",retrievalRows);report.put("recallAt5",percent(recall/retrieval.size()));report.put("embeddingNote","Local MiniLM is English-focused; German/VI retrieval requires separate representative evaluation.");
    store.save(item.tenantId(),item.id(),"evaluation",(String)report.get("id"),report);return report;
  }
  private Map<String,Object> metrics(int tp,int fp,int fn){double p=tp+fp==0?0:(double)tp/(tp+fp),r=tp+fn==0?0:(double)tp/(tp+fn);return Map.of("precision",percent(p),"recall",percent(r),"f1",percent(p+r==0?0:2*p*r/(p+r)),"truePositive",tp,"falsePositive",fp,"falseNegative",fn);}
  private double percent(double n){return Math.round(n*1000)/10.0;}
}
