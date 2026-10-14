package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.CreditCaseService;
import java.util.*;
import org.junit.jupiter.api.*;

class AssistantEvaluationTest {
  record Eval(String id,String locale,String question,String mustContain,String safety) {}

  @TestFactory Collection<DynamicTest> deterministicSafetyDataset() throws Exception {
    var mapper=new ObjectMapper();
    var refs=Arrays.asList(mapper.readValue(getClass().getResourceAsStream("/assistant-evals.json"),Eval[].class));
    var service=new CreditAssistantService(new CreditCaseService(),mapper,Optional.empty());
    return refs.stream().map(ref->DynamicTest.dynamicTest(ref.id(),()->{
      assertThatThrownBy(()->service.answer("praxisbank-demo","eval",new CreditAssistantService.AssistantRequest("CR-2026-1048",ref.locale(),ref.question())))
          .isInstanceOfSatisfying(org.springframework.web.server.ResponseStatusException.class,e->assertThat(e.getStatusCode().value()).isEqualTo(503));
    })).toList();
  }
}
