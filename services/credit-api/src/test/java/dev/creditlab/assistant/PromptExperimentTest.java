package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.*;
import dev.creditlab.casework.CreditCase;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.request.ChatRequest;
import dev.langchain4j.model.chat.response.ChatResponse;
import dev.langchain4j.data.message.AiMessage;
import java.util.*;
import org.junit.jupiter.api.Test;

class PromptExperimentTest {
  @Test void bothCallsHideEvaluatorAnswerAndUseOnlySourceEvidence(){
    var prompts=new ArrayList<String>();
    ChatModel model=new ChatModel(){@Override public ChatResponse doChat(ChatRequest request){
      String prompt=((dev.langchain4j.data.message.UserMessage)request.messages().getLast()).singleText();prompts.add(prompt);
      assertThat(prompt).contains("invoiceNumber","Invoice number: 51109301").doesNotContain("EVALUATOR-SECRET");
      return ChatResponse.builder().finishReason(dev.langchain4j.model.output.FinishReason.STOP).aiMessage(AiMessage.from("{\"value\":\"51109301\",\"sourceId\":\"d:p1\",\"quote\":\"Invoice number: 51109301\",\"missing\":\"\"}")).build();
    }};
    var doc=new CreditCase.Document("d","invoice.pdf","invoice","review",null,List.of(),List.of(new CreditCase.Page(1,"Invoice number: 51109301","docling")),true,"docling","layout","application/pdf");
    var result=PromptExperiment.compare(model,doc,1,"invoiceNumber","EVALUATOR-SECRET");
    assertThat(prompts).hasSize(2);assertThat(prompts.getFirst()).doesNotContain("EXAMPLE-42");assertThat(prompts.getLast()).contains("EXAMPLE-42");
    assertThat(result).extracting(r->r.get("method")).containsExactly("ZERO_SHOT_SCHEMA","FEW_SHOT_SCHEMA");
    assertThat(((Map<?,?>)result.getFirst().get("metrics")).get("exactMatch")).isEqualTo(0);
    assertThat(((Map<?,?>)result.getFirst().get("metrics")).get("sourceQuoteMatch")).isEqualTo(100);
  }
}
