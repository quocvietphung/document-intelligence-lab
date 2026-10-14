package dev.creditlab.platform;
import java.util.*;
import java.time.Instant;
import dev.creditlab.casework.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class DocumentRecoveryTest {
  @Test void retainsSafeFailureCodesWithoutCopyingProviderPayload(){
    assertThat(DocumentJobs.errorCode(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"AZURE_AUTH_UNAVAILABLE"))).isEqualTo("AZURE_AUTH_UNAVAILABLE");
    assertThat(DocumentJobs.errorCode(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"private provider details"))).isEqualTo("ANALYSIS_HTTP_503");
    assertThat(DocumentJobs.errorCode(new IllegalArgumentException("private document text"))).isEqualTo("DOCUMENT_REJECTED");
    assertThat(DocumentJobs.errorCode(new IllegalArgumentException("MALWARE_BLOCKED"))).isEqualTo("MALWARE_BLOCKED");
  }
  @Test void blocksSecurityFailuresAndChangedReferenceBytes(){
    assertThat(DocumentJobs.retryableCode("MALWARE_BLOCKED")).isFalse();
    assertThat(DocumentJobs.retryableCode("INJECTION_QUARANTINED")).isFalse();
    assertThat(DocumentJobs.retryableCode("AZURE_AUTH_UNAVAILABLE")).isTrue();
    assertThat(ApprovedDatevSamples.matches("datev-lodas-2025-robert-muster.pdf","not the approved PDF".getBytes())).isFalse();
    assertThat(ApprovedDatevSamples.matchesDigest("other.pdf","f0c6c2586e6920466c2380758989a7d669d77fb9463320e4a77a8f8bc9c3d404")).isFalse();
  }
  private final LabStore store=mock(LabStore.class);
  private final JdbcTemplate db=mock(JdbcTemplate.class);
  private final CreditCaseService cases=mock(CreditCaseService.class);
  private final DocumentObjectStore objects=mock(DocumentObjectStore.class);
  private DocumentJobs jobs(Map<String,Object> row){
    when(store.database()).thenReturn(db);
    when(db.queryForList("SELECT * FROM lab_jobs WHERE tenant=? AND case_id=? AND id=?","tenant","case","job")).thenReturn(row==null?List.of():List.of(row));
    return new DocumentJobs(store,cases,mock(DocumentAnalysisService.class),objects,mock(DocumentScanner.class),mock(DistributedLimits.class),mock(RagEngine.class),30,false);
  }
  private Map<String,Object> row(String name,String code,Instant expiry){return Map.of("status","FAILED","error_code",code,"expires_at",java.sql.Timestamp.from(expiry),"name",name,"sha256","not-approved");}
  @Test void foreignOrUnknownJobDoesNotReadAnObject(){
    assertThatThrownBy(()->jobs(null).retry("tenant","case","actor","job")).isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
    verifyNoInteractions(objects);
  }
  @Test void arbitraryStoredDocumentsCannotBeSentThroughRetry(){
    assertThatThrownBy(()->jobs(row("other-payroll.pdf","ANALYSIS_HTTP_503",Instant.now().plusSeconds(3600))).retry("tenant","case","actor","job")).isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
    verifyNoInteractions(objects);
  }
  @Test void malwareAndExpiredObjectsCannotBeRequeued(){
    assertThatThrownBy(()->jobs(row("other.pdf","MALWARE_BLOCKED",Instant.now().plusSeconds(3600))).retry("tenant","case","actor","job")).isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
    assertThatThrownBy(()->jobs(row("other.pdf","ANALYSIS_HTTP_503",Instant.now().minusSeconds(1))).retry("tenant","case","actor","job")).isInstanceOf(ResponseStatusException.class).hasMessageContaining("410");
    verifyNoInteractions(objects);
  }
}
