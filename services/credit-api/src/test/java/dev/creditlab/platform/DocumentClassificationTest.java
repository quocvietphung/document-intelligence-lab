package dev.creditlab.platform;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class DocumentClassificationTest {
  @TempDir Path root;
  CreditCaseService cases;LabStore store;DocumentAnalytics analytics;DocumentClassification service;long version;
  @BeforeEach void setUp(){
    cases=mock(CreditCaseService.class);var item=new CreditCaseService().require("praxisbank-demo","CR-2026-1048");version=item.version();
    when(cases.require("tenant","case")).thenReturn(item);
    when(cases.require("foreign","case")).thenThrow(new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND));
    var source=new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa","");
    store=new LabStore(Optional.of(source),new ObjectMapper());
    store.database().execute("CREATE TABLE lab_records(tenant varchar(120),case_id varchar(80),kind varchar(50),id varchar(80),created_at timestamp,payload text,PRIMARY KEY(tenant,case_id,kind,id))");
    analytics=mock(DocumentAnalytics.class);when(analytics.workerReady()).thenReturn(true);
    service=new DocumentClassification(cases,store,new DocumentExtractor(),analytics,mock(DistributedLimits.class),root.toString());
  }
  @Test void corpusReadsActualNativePdfsAndSeparatesTemplateFamilies()throws Exception{
    var input=service.benchmarkInput("tenant","case");String json=input.get("datasetJson").toString();
    assertThat(RagEngine.hash(json)).isEqualTo(input.get("datasetFingerprint"));
    var rows=new ObjectMapper().readTree(json);assertThat(rows.size()).isEqualTo(66);
    var groups=new HashMap<String,String>();var hashes=new HashSet<String>();
    for(var row:rows){assertThat(row.get("text").asText()).contains("SYNTHETIC RESEARCH DOCUMENT");
      assertThat(row.get("page").asInt()).isEqualTo(1);assertThat(hashes.add(row.get("sha256").asText())).isTrue();
      String group=row.get("group").asText(),split=row.get("split").asText(),previous=groups.putIfAbsent(group,split);
      assertThat(previous==null||previous.equals(split)).isTrue();assertThat(row.get("ruleType").asText()).isNotBlank();}
    assertThat(new String(service.pdf("tenant","case","bench-0001"),0,5,java.nio.charset.StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
    assertThatThrownBy(()->service.pdf("tenant","case","../../secret")).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    String output=System.getProperty("classification.export");if(output!=null)Files.writeString(Path.of(output),store.encode(input));
  }
  @Test void queueIsConsentVersionTenantBoundAndDoesNotChangeDocuments(){
    String fingerprint=service.benchmarkInput("tenant","case").get("datasetFingerprint").toString();
    var request=new DocumentClassification.Request(UUID.randomUUID(),version,fingerprint,true);
    var run=service.enqueue("tenant","case","advisor",request);assertThat(run.get("status")).isEqualTo("QUEUED");
    assertThat(store.encode(service.enqueue("tenant","case","advisor",request))).isEqualTo(store.encode(run));
    assertThat(store.list("tenant","case","classification-run")).hasSize(1);
    assertThatThrownBy(()->service.read("foreign","case")).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThatThrownBy(()->service.enqueue("tenant","case","advisor",new DocumentClassification.Request(UUID.randomUUID(),version+1,fingerprint,true))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThatThrownBy(()->service.enqueue("tenant","case","advisor",new DocumentClassification.Request(UUID.randomUUID(),version,fingerprint,false))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThat(root.resolve("classification-queue")).isDirectory();
    verify(cases,never()).review(any(),any(),any(),any(),any());
  }
  @Test void unavailableWorkerDoesNotInventAResult(){
    when(analytics.workerReady()).thenReturn(false);
    assertThat(service.read("tenant","case")).containsEntry("workerReady",false);
    assertThatThrownBy(()->service.enqueue("tenant","case","advisor",new DocumentClassification.Request(UUID.randomUUID(),version,service.benchmarkInput("tenant","case").get("datasetFingerprint").toString(),true))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThat(store.list("tenant","case","classification-run")).isEmpty();
  }
}
