package dev.creditlab.assistant;
import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.CreditCaseService;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
class CreditAssistantServiceTest {
 @Test void contentFilterIsNotReportedAsServiceOutageOrDisabled(){
  assertThat(CreditAssistantService.providerStatus(new RuntimeException(new dev.langchain4j.exception.ContentFilteredException("private provider payload")))).isEqualTo(org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY);
  assertThat(CreditAssistantService.providerStatus(new dev.langchain4j.exception.HttpException(400,"other invalid request"))).isEqualTo(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE);
 }
 @Test void providerDiagnosticsContainStatusButNeverSensitiveExceptionPayload(){
  var failure=new RuntimeException("private prompt and Bearer token",new dev.langchain4j.exception.HttpException(429,"provider response secret"));
  assertThat(CreditAssistantService.safeFailure(failure)).contains("RuntimeException/HttpException","httpStatus=429").doesNotContain("private","Bearer","secret","provider response");
 }
 @Test void missingModelNeverReturnsADemonstrationAnswer(){
  var service=new CreditAssistantService(new CreditCaseService(),new ObjectMapper(),Optional.empty());
  for(String locale:new String[]{"de","en","vi"})
   assertThatThrownBy(()->service.answer("praxisbank-demo","tester",new CreditAssistantService.AssistantRequest("CR-2026-1048",locale,"Summarize this PDF"))).isInstanceOfSatisfying(ResponseStatusException.class,e->assertThat(e.getStatusCode().value()).isEqualTo(503));
 }
 @Test void wrongTenantStillCannotReadDocuments(){
  var service=new CreditAssistantService(new CreditCaseService(),new ObjectMapper(),Optional.empty());
  assertThatThrownBy(()->service.answer("foreign","tester",new CreditAssistantService.AssistantRequest("CR-2026-1048","en","Show evidence"))).isInstanceOfSatisfying(ResponseStatusException.class,e->assertThat(e.getStatusCode().value()).isEqualTo(404));
 }
 @Test void documentToolsExcludePublisherValuesWithoutUploadedOriginal(){
  var tool=new CaseTools(new CreditCaseService().require("praxisbank-demo","CR-2026-1048"),new ObjectMapper());
  assertThat(tool.documentEvidence()).isEqualTo("[]");
 }
}
