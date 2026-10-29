package dev.creditlab.platform;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.CreditCase;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.assertj.core.api.Assertions.*;

/** Explicit local PDF benchmark; the corpus is private and never auto-downloaded in CI. */
class RagPdfBenchmarkTest {
  @Test @EnabledIfEnvironmentVariable(named="RAG_PDF_CORPUS",matches=".+")
  void comparePinnedOriginalsWithSourceGroupedLabels() throws Exception {
    var mapper=new ObjectMapper();var file=Path.of(System.getenv("RAG_PDF_CORPUS"));
    var data=mapper.readTree(Files.readAllBytes(file));var documents=new ArrayList<CreditCase.Document>();var hashes=new TreeMap<String,String>();
    Path root=Path.of(System.getenv("RAG_REPOSITORY_ROOT")).toRealPath();
    for(var doc:data.path("documents")){
      var pdf=root.resolve(doc.path("preparedFile").asText()).toRealPath();assertThat(pdf).startsWith(root.resolve(".local"));
      String hash=HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(pdf)));assertThat(hash).isEqualTo(doc.path("sha256").asText());hashes.put(doc.path("id").asText(),hash);
      var pages=new ArrayList<CreditCase.Page>();for(var p:doc.path("pages"))pages.add(new CreditCase.Page(p.path("number").asInt(),p.path("text").asText(),"native-pdf-reference"));
      documents.add(new CreditCase.Document(doc.path("id").asText(),doc.path("name").asText(),"general","review",null,List.of(),pages,true,"native-pdf-reference","pypdf","application/pdf"));
    }
    var item=new CreditCase("PDF-benchmark","local-benchmark","PDF references","Isolated retrieval comparison",0,0,"HUMAN_REVIEW",List.of(),List.of(),"","",documents,List.of(),1,"general");
    var labels=new ArrayList<Map<String,Object>>();
    for(var q:data.path("questions")){
      var label=mapper.convertValue(q,new TypeReference<Map<String,Object>>(){});var relevant=new ArrayList<Map<String,Object>>();
      for(var source:q.path("relevant"))relevant.add(Map.of("documentId",source.path("sourceId").asText(),"page",source.path("page").asInt()));
      label.put("relevant",relevant);labels.add(label);
    }
    var rag=new RagEngine(true,"");var chunks=rag.chunks(item).stream().filter(c->hashes.containsKey(c.documentId())).toList();
    rag.benchmark(item,chunks,"warm local embeddings",5,RagEngine.Strategy.VECTOR);
    var variants=new ArrayList<Map<String,Object>>();
    for(var strategy:RagEngine.Strategy.values()){
      var value=new LinkedHashMap<>(RetrievalEvaluation.evaluate(labels,q->rag.benchmark(item,chunks,q,5,strategy)));value.put("method",strategy.name());variants.add(value);
    }
    var report=new LinkedHashMap<String,Object>();report.put("format","rag-pdf-benchmark-v1");report.put("extraction",data.path("extraction").asText());report.put("labelProvenance",data.path("labelProvenance").asText());
    report.put("scope","Nine small prepared PDFs; shared templates and translated questions; not representative business accuracy. One model configuration, no tuning on held-out results.");
    report.put("sourceHashes",hashes);report.put("questions",labels.size());report.put("chunks",chunks.size());report.put("model",rag.configuration());report.put("variants",variants);report.put("llmCalls",0);report.put("azureCalls",0);
    Path output=file.resolveSibling("native-results.json");mapper.writerWithDefaultPrettyPrinter().writeValue(output.toFile(),report);System.out.println("Private PDF benchmark: "+output);
    assertThat(variants).hasSize(5);assertThat(variants).allSatisfy(v->assertThat((List<?>)v.get("groups")).hasSize(2));
  }
}
