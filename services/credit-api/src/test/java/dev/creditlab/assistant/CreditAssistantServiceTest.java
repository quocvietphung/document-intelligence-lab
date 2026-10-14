package dev.creditlab.assistant;
import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.CreditCaseService;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
class CreditAssistantServiceTest {
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
