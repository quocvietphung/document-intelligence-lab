package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class SharedCitationContractTest {
  @Test void pythonAndJavaUseTheSameCitationFixtures() throws Exception {
    try(var input=getClass().getResourceAsStream("/shared-contracts/validation-cases.json")) {
      assertThat(input).isNotNull();
      var fixture=new ObjectMapper().readTree(input);
      for(var row:fixture.path("citations")) {
        var sources=new ArrayList<CreditAssistantService.Source>();
        row.path("ids").forEach(id->sources.add(new CreditAssistantService.Source(id.asText(),"fixture.pdf","Synthetic reference")));
        if(row.path("valid").asBoolean())
          assertThat(SourceCitations.validate(row.path("answer").asText(),sources)).isEqualTo(row.path("canonical").asText());
        else assertThatThrownBy(()->SourceCitations.validate(row.path("answer").asText(),sources)).isInstanceOf(ResponseStatusException.class);
      }
    }
  }
}
