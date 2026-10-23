package dev.creditlab.assistant;

import dev.creditlab.security.LocalModelEndpoint;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.ollama.OllamaChatModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class LocalAiConfiguration {
  @Value("${app.ai.provider:azure}") private String provider="azure";
  @jakarta.annotation.PostConstruct void validateProvider() {
    if(!java.util.Set.of("azure","ollama").contains(provider))throw new IllegalArgumentException("Unknown Nova provider");
  }
  @Bean
  @ConditionalOnProperty(name="app.ai.provider",havingValue="ollama")
  ChatModel localChatModel(@Value("${app.ai.local-url:http://ollama:11434}") String endpoint,
      @Value("${app.ai.local-model:}") String model) {
    return new LocalInferenceModel(OllamaChatModel.builder().baseUrl(LocalModelEndpoint.validate(endpoint))
        .modelName(LocalModelEndpoint.model(model)).temperature(0.0).think(false).numCtx(4096).numPredict(420)
        .timeout(LocalInferenceModel.TIMEOUT).maxRetries(0).logRequests(false).logResponses(false)
        .supportedCapabilities(dev.langchain4j.model.chat.Capability.RESPONSE_FORMAT_JSON_SCHEMA).build());
  }
}
