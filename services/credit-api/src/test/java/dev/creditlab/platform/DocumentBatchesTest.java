package dev.creditlab.platform;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DocumentBatchesTest {
  private final CreditCaseService cases=mock(CreditCaseService.class);
  private final DocumentJobs jobs=mock(DocumentJobs.class);
  private LabStore store;private DocumentBatches service;
  private final String requestId=UUID.randomUUID().toString();
  private final List<DocumentBatches.Input> files=List.of(new DocumentBatches.Input("invoice.pdf","application/pdf",new byte[]{1,2,3}));
  @BeforeEach void setup(){
    store=new LabStore(Optional.of(new DriverManagerDataSource("jdbc:h2:mem:batch"+UUID.randomUUID()+";DB_CLOSE_DELAY=-1","sa","")),new ObjectMapper());
    store.database().execute("CREATE TABLE lab_records(tenant varchar,case_id varchar,kind varchar,id varchar,created_at timestamp,payload varchar,PRIMARY KEY(tenant,case_id,kind,id))");
    store.database().execute("CREATE TABLE lab_jobs(id varchar,tenant varchar,case_id varchar,status varchar,document_id varchar,retry_of varchar,created_at timestamp,sha256 varchar)");
    when(cases.require("tenant","case")).thenReturn(new CreditCaseService().require("praxisbank-demo","CR-2026-1048"));
    var counter=new AtomicInteger();
    when(jobs.enqueue(anyString(),anyString(),anyString(),anyString(),anyString(),any())).thenAnswer(call->{String id="job-"+counter.incrementAndGet();store.database().update("INSERT INTO lab_jobs(id,tenant,case_id,status,created_at,sha256) VALUES(?,?,?,'QUEUED',CURRENT_TIMESTAMP,?)",id,call.getArgument(0),call.getArgument(1),DocumentBatches.hash(call.getArgument(5)));return Map.of("id",id,"status","QUEUED");});
    service=new DocumentBatches(store,cases,jobs);
  }
  private Map<String,Object> submit(){return service.submit("tenant","case","actor",requestId,"Invoices","Permitted test source","invoice",files);}
  @Test void storesDurableScopedReceiptAndReplaysWithoutEnqueuingTwice(){
    var first=submit();var second=submit();assertThat(second).isEqualTo(first);
    verify(jobs,times(1)).enqueue(anyString(),anyString(),anyString(),anyString(),anyString(),any());
    assertThat(store.find("tenant","case","document-batch",first.get("id").toString())).isPresent();
    assertThat(store.find("foreign","case","document-batch",first.get("id").toString())).isEmpty();
    assertThat(store.encode(first)).doesNotContain("accessToken","object_key","extractedText");
    assertThat(first).containsEntry("state","SUBMITTED").containsEntry("persistent",true);
  }
  @Test void reusedRequestWithDifferentContentIsConflict(){
    submit();assertThatThrownBy(()->service.submit("tenant","case","actor",requestId,"Changed","Permitted test source","invoice",files)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
    verify(jobs,times(1)).enqueue(anyString(),anyString(),anyString(),anyString(),anyString(),any());
  }
  @Test void validatesWholeIntakeBeforeSavingOrQueuing(){
    assertThatThrownBy(()->service.submit("tenant","case","actor",requestId,"Invoices","Source","invoice",Collections.nCopies(5,files.getFirst()))).isInstanceOf(ResponseStatusException.class).hasMessageContaining("422");
    assertThatThrownBy(()->service.submit("tenant","case","actor",requestId,"Invoices","Source","custom-model",files)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("422");
    assertThatThrownBy(()->DocumentBatches.validate(List.of(new DocumentBatches.Input("run.exe","application/pdf",new byte[]{1})))).isInstanceOf(ResponseStatusException.class);
    verifyNoInteractions(jobs);assertThat(store.list("tenant","case","document-batch")).isEmpty();
  }
  @Test void partialRejectionRemainsVisibleAndNeverBecomesSuccess(){
    doThrow(new ResponseStatusException(HttpStatus.CONFLICT,"Duplicate")).when(jobs).enqueue(anyString(),anyString(),anyString(),anyString(),anyString(),any());
    var receipt=submit();assertThat(store.encode(receipt)).contains("DUPLICATE").doesNotContain("\"jobId\"");
    assertThat(service.list("tenant","case")).containsEntry("adfConnected",false).containsEntry("cloudIngestionConnected",false);
  }
  @Test void followsExplicitRetriesWithoutLosingOriginalReceipt(){
    var receipt=submit();
    store.database().update("UPDATE lab_jobs SET status='FAILED' WHERE id='job-1'");
    store.database().update("INSERT INTO lab_jobs(id,tenant,case_id,status,document_id,retry_of,created_at) VALUES('job-retry','tenant','case','COMPLETE','review-doc','job-1',CURRENT_TIMESTAMP)");
    var updated=service.list("tenant","case");String json=store.encode(updated);
    assertThat(json).contains("\"jobId\":\"job-1\"","\"currentJobId\":\"job-retry\"","\"documentId\":\"review-doc\"");
    assertThat(receipt.get("id")).isEqualTo("batch-"+requestId);
  }
  @Test void duplicateReceiptLinksExistingResultWithoutCreatingAnotherJob(){
    submit();doThrow(new ResponseStatusException(HttpStatus.CONFLICT)).when(jobs).enqueue(anyString(),anyString(),anyString(),anyString(),anyString(),any());
    var receipt=service.submit("tenant","case","actor",UUID.randomUUID().toString(),"Copy","Same source","invoice",files);
    assertThat(store.encode(receipt)).contains("DUPLICATE","\"jobId\":\"job-1\"");
    assertThat(store.database().queryForObject("SELECT COUNT(*) FROM lab_jobs",Integer.class)).isEqualTo(1);
  }
  @Test void typeAndMissingFieldChecksAreNotConfidenceOrApproval(){
    var doc=new CreditCase.Document("doc","invoice.pdf","invoice","review",99,List.of(new CreditCase.Field("invoiceNumber","INV-1",null,1,"Invoice number: INV-1")),List.of(),true,"test","test","application/pdf");
    assertThat(DocumentBatches.missingFields("invoice",doc)).containsExactly("invoiceTotal");
    assertThat(DocumentBatches.mismatch("payroll",doc.type())).isTrue();
    assertThat(DocumentBatches.mismatch("general",doc.type())).isFalse();
    assertThat(DocumentBatches.PROFILES.get("insurance-wording")).isEmpty();
  }
  @Test void foreignTenantIsRejectedBeforeAnyIntake(){
    when(cases.require("foreign","case")).thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND));
    assertThatThrownBy(()->service.submit("foreign","case","actor",requestId,"Invoices","Source","invoice",files)).isInstanceOf(ResponseStatusException.class);
    verifyNoInteractions(jobs);
  }
}
