package dev.creditlab.platform;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DocumentPipelineTest {
  private final CreditCaseService cases=mock(CreditCaseService.class);
  private final DocumentAnalysisService analysis=mock(DocumentAnalysisService.class);
  private final DocumentObjectStore objects=mock(DocumentObjectStore.class);
  private final DocumentScanner scanner=mock(DocumentScanner.class);
  private final DistributedLimits limits=mock(DistributedLimits.class);
  private final RagEngine rag=mock(RagEngine.class);
  private DocumentJobs service(LabStore store,boolean worker){return new DocumentJobs(store,cases,analysis,objects,scanner,limits,rag,30,worker);}

  @Test void retriesOnlyTransientErrorsWithBoundedBackoff(){
    for(String code:List.of("MALWARE_BLOCKED","DOCUMENT_REJECTED","INJECTION_QUARANTINED","AZURE_AUTH_UNAVAILABLE","AZURE_ACCESS_DENIED","SOURCE_INTEGRITY_FAILED"))assertThat(DocumentJobs.automaticRetry(code,1)).isFalse();
    assertThat(DocumentJobs.automaticRetry("ANALYSIS_HTTP_503",1)).isTrue();
    assertThat(DocumentJobs.automaticRetry("ANALYSIS_HTTP_429",2)).isTrue();
    assertThat(DocumentJobs.automaticRetry("ANALYSIS_HTTP_503",3)).isFalse();
    assertThat(DocumentJobs.retryDelaySeconds(1)).isEqualTo(30);assertThat(DocumentJobs.retryDelaySeconds(2)).isEqualTo(60);
  }
  private LabStore sqlStore(){
    var source=new DriverManagerDataSource("jdbc:h2:mem:pipeline"+UUID.randomUUID()+";DB_CLOSE_DELAY=-1","sa","");
    var store=new LabStore(Optional.of(source),new ObjectMapper());
    store.database().execute("CREATE TABLE lab_jobs(id varchar PRIMARY KEY,tenant varchar,case_id varchar,status varchar,stage varchar,last_actor varchar,next_attempt_at timestamp,finished_at timestamp,updated_at timestamp,expires_at timestamp)");
    return store;
  }
  private void seed(LabStore store,String state){store.database().update("INSERT INTO lab_jobs(id,tenant,case_id,status,expires_at) VALUES('job','tenant','case',?,?)",state,java.sql.Timestamp.from(Instant.now().plusSeconds(3600)));}
  @Test void cancellationIsScopedAtomicAndDoesNotDeleteOriginals(){
    var store=sqlStore();seed(store,"QUEUED");var jobs=service(store,false);
    assertThat(jobs.cancel("tenant","case","advisor","job")).containsEntry("status","CANCELLED");
    assertThat(store.database().queryForObject("SELECT status FROM lab_jobs WHERE id='job'",String.class)).isEqualTo("CANCELLED");
    assertThatThrownBy(()->jobs.cancel("tenant","case","advisor","job")).isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
    verifyNoInteractions(objects,analysis,scanner);
  }
  @Test void runningFinishedExpiredAndForeignJobsCannotBeCancelled(){
    for(String state:List.of("PROCESSING","COMPLETE","FAILED","EXPIRED")){
      var store=sqlStore();seed(store,state);var jobs=service(store,false);
      assertThatThrownBy(()->jobs.cancel("tenant","case","advisor","job")).isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
      assertThatThrownBy(()->jobs.cancel("foreign","case","advisor","job")).isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
    }
    verifyNoInteractions(objects,analysis);
  }
  private final byte[] bytes="Invoice source fixture".getBytes(StandardCharsets.UTF_8);
  private final CreditCase.Document doc=new CreditCase.Document("new-doc","invoice.pdf","invoice","review",null,List.of(),List.of(new CreditCase.Page(1,"Invoice source fixture","test")),true,"test","test","application/pdf");
  private LabStore workerStore(JdbcTemplate db)throws Exception{
    var store=spy(new LabStore(Optional.empty(),new ObjectMapper()));doReturn(true).when(store).persistent();doReturn(db).when(store).database();
    var row=new LinkedHashMap<String,Object>();row.put("id","job");row.put("tenant","tenant");row.put("case_id","case");row.put("actor","advisor");row.put("object_key","object");row.put("name","invoice.pdf");row.put("content_type","application/pdf");row.put("attempt",1);row.put("sha256",HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)));
    when(db.queryForList(anyString())).thenAnswer(call->call.getArgument(0,String.class).contains("RETURNING")?List.of(row):List.of());
    when(db.queryForList(anyString(),any(Object[].class))).thenReturn(List.of(Map.of("id","job")));
    when(db.update(anyString(),any(Object[].class))).thenReturn(1);
    when(objects.read("object")).thenReturn(bytes);when(scanner.scan(bytes)).thenReturn("CLAMAV_CLEAN");
    when(cases.require("tenant","case")).thenReturn(new CreditCaseService().require("praxisbank-demo","CR-2026-1048"));
    return store;
  }
  @Test void resumesAnImmutableExtractionWithoutCallingPaidAnalysisAgain()throws Exception{
    var db=mock(JdbcTemplate.class);var store=workerStore(db);store.insert("tenant","case","job-analysis","job",Map.of("id","job","document",store.encode(doc)));
    service(store,true).work();
    verify(analysis,never()).analyze(anyString(),anyString(),any());verify(scanner).scan(bytes);
    verify(db).update(contains("status='COMPLETE'"),any(Object[].class));
    assertThat(store.find("tenant","case","job-analysis","job")).isPresent();
  }
  @Test void rejectsChangedStoredBytesBeforeScannerOrAzure()throws Exception{
    var db=mock(JdbcTemplate.class);var store=workerStore(db);when(objects.read("object")).thenReturn("changed".getBytes(StandardCharsets.UTF_8));
    service(store,true).work();verifyNoInteractions(scanner,analysis);
    verify(db).update(contains("next_attempt_at=?"),eq("FAILED"),eq("SOURCE_INTEGRITY_FAILED"),isNull(),any(),eq("job"),eq("tenant"),eq("case"),eq(1));
  }
  @Test void staleWorkersCannotCallTheProviderOrAttachEvidence()throws Exception{
    var db=mock(JdbcTemplate.class);var store=workerStore(db);when(db.queryForList(anyString(),any(Object[].class))).thenReturn(List.of());
    service(store,true).work();verifyNoInteractions(analysis);verify(cases,never()).attach(anyString(),anyString(),anyString(),any(),any(),anyLong());
  }
  @Test void authenticationFailuresStopImmediatelyInsteadOfRetryingThreeTimes()throws Exception{
    var db=mock(JdbcTemplate.class);var store=workerStore(db);when(analysis.analyze(anyString(),anyString(),any())).thenThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"AZURE_AUTH_UNAVAILABLE"));
    service(store,true).work();
    verify(db).update(contains("next_attempt_at=?"),eq("FAILED"),eq("AZURE_AUTH_UNAVAILABLE"),isNull(),any(),eq("job"),eq("tenant"),eq("case"),eq(1));
  }
  @Test void approvedKaggleReferencesStillRejectSubstitutedBytes(){
    assertThat(ApprovedResearchSamples.matchesDigest("kaggle-invoice-51109301.pdf","1e823688f4dd4efaf4f6a75c124cccef0e7864bf7ad6f053b94b9714949b4f79")).isTrue();
    assertThat(ApprovedResearchSamples.matches("kaggle-invoice-51109301.pdf",bytes)).isFalse();
    assertThat(ApprovedResearchSamples.matchesDigest("unapproved.pdf","1e823688f4dd4efaf4f6a75c124cccef0e7864bf7ad6f053b94b9714949b4f79")).isFalse();
  }
}
