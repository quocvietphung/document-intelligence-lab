package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.*;
import dev.langchain4j.service.SystemMessage;
import java.util.List;
import org.junit.jupiter.api.Test;

class DocumentReviewModelTest {
  @Test void systemRuleReservesSquareBracketsForSourceIds() throws NoSuchMethodException {
    String system=String.join("\n",DocumentReviewModel.class.getMethod("review",String.class).getAnnotation(SystemMessage.class).value());
    assertThat(system).contains("reserved for those IDs","[Name]","neutral greeting without a name");
  }

  @Test void userPromptRepeatsTheBracketRule(){
    var sources=List.of(new CreditAssistantService.Source("doc-1:p1:c1","Invoice","Total 100,00 EUR"));
    assertThat(DocumentReviewModel.prompt("general","German","Summe?",sources)).contains("Square brackets only around exact source IDs");
  }
}
