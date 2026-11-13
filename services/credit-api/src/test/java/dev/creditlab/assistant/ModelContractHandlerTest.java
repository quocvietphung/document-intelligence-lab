package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.*;
import org.junit.jupiter.api.Test;

class ModelContractHandlerTest {
  @Test void refusalsReturnOnlyTheCodeAndReasonAsNoStore(){
    var response=new ModelContractHandler().handle(new ModelContractException("MODEL_CITATION_CONTRACT_FAILED","NON_SOURCE_BRACKET","no source was guessed or substituted"));
    assertThat(response.getStatusCode().value()).isEqualTo(422);
    assertThat(response.getBody()).containsOnlyKeys("code","reason").containsEntry("code","MODEL_CITATION_CONTRACT_FAILED").containsEntry("reason","NON_SOURCE_BRACKET");
    assertThat(response.getHeaders().getFirst("Cache-Control")).isEqualTo("no-store");
  }
}
