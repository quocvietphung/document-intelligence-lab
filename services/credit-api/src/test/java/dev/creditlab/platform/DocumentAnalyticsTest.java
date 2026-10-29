package dev.creditlab.platform;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.CreditCaseService;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

class DocumentAnalyticsTest {
  @TempDir Path root;
  CreditCaseService cases;LabStore store;DocumentAnalytics service;DocumentResearch research;
  final String tenant="tenant",id="case",hash="a".repeat(64),runId="etl-12345678-1234-1234-1234-123456789abc",findingId="b".repeat(24);
  long version;
  @BeforeEach void setUp(){
    var source=new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa","");
    store=new LabStore(Optional.of(source),new ObjectMapper());
    store.database().execute("CREATE TABLE lab_records(tenant varchar(120),case_id varchar(80),kind varchar(50),id varchar(80),created_at timestamp,payload text,PRIMARY KEY(tenant,case_id,kind,id))");
    new ResourceDatabasePopulator(new ClassPathResource("db/migration/V4__document_analytics.sql")).execute(source);
    cases=mock(CreditCaseService.class);var item=new CreditCaseService().require("praxisbank-demo","CR-2026-1048");version=item.version();
    when(cases.require(tenant,id)).thenReturn(item);when(cases.require("foreign",id)).thenThrow(new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND));
    research=mock(DocumentResearch.class);when(research.fingerprint(item)).thenReturn(hash);
    service=new DocumentAnalytics(cases,store,research,mock(DistributedLimits.class),false,root.toString(),root.toString());
  }
  void snapshot(){
    var finding=Map.of("id",findingId,"documentId","doc","page",1,"field","invoiceTotal","code","AMOUNT_FORMAT_AMBIGUOUS","category","quality","sourceIds",List.of("source"));
    var analytics=Map.of("schemaVersion","document-analytics-v1","sourceHash",hash,"findings",List.of(finding));
    store.insert(tenant,id,"medallion-run",runId,Map.of("id",runId,"time","2026-10-29T18:00:00Z","caseVersion",version,"sourceHash",hash,"status","COMPLETE","result",Map.of("method",LocalDataPipeline.METHOD,"analytics",analytics)));
  }
  @Test void readsAreScopedAndQualityProjectionIsIdempotent(){
    snapshot();service.read(tenant,id);service.read(tenant,id);
    assertThat(store.database().queryForObject("SELECT count(*) FROM document_analytics_findings",Integer.class)).isEqualTo(1);
    assertThatThrownBy(()->service.read("foreign",id)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThat(service.read(tenant,id)).containsEntry("enabled",false).containsEntry("workerReady",false);
  }
  @Test void reviewPreservesSourceApprovalAndHistoryAndRejectsReuseAndStaleData(){
    snapshot();service.read(tenant,id);var requestId=UUID.randomUUID();
    var request=new DocumentAnalytics.Review(requestId,version,runId,findingId,"DISMISSED","Original PDF checked; ambiguous amount needs separate field review.");
    assertThat(service.review(tenant,id,"reviewer",request)).containsEntry("documentApprovalChanged",false);
    service.review(tenant,id,"reviewer",request);
    assertThat(store.database().queryForObject("SELECT count(*) FROM document_analytics_reviews",Integer.class)).isEqualTo(1);
    assertThatThrownBy(()->service.review(tenant,id,"reviewer",new DocumentAnalytics.Review(requestId,version,runId,findingId,"CONFIRMED","Changed decision"))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThatThrownBy(()->service.review(tenant,id,"reviewer",new DocumentAnalytics.Review(UUID.randomUUID(),version+1,runId,findingId,"CONFIRMED","Stale"))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    verify(cases,never()).review(any(),any(),any(),any(),any());
  }
  @Test void unknownFindingsAndUnreadyWorkerNeverPublishFakeResults(){
    assertThatThrownBy(()->service.review(tenant,id,"reviewer",new DocumentAnalytics.Review(UUID.randomUUID(),version,runId,findingId,"CONFIRMED","Unknown"))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThatThrownBy(()->service.enqueue(tenant,id,"advisor",new DocumentAnalytics.Request(UUID.randomUUID(),version,runId,true))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThat(store.list(tenant,id,"cohort-run")).isEmpty();assertThat(Files.exists(root.resolve("queue"))).isFalse();
  }
}
