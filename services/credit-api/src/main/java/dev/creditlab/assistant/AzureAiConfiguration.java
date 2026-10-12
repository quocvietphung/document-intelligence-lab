package dev.creditlab.assistant;

import com.azure.identity.DefaultAzureCredentialBuilder;
import com.azure.identity.AzureCliCredentialBuilder;
import com.azure.core.credential.TokenCredential;
import dev.creditlab.security.AzureTokenFileCredential;
import dev.langchain4j.model.azure.AzureOpenAiChatModel;
import dev.langchain4j.model.chat.ChatModel;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AzureAiConfiguration {
  @Value("${app.ai.required:false}") private boolean required;
  @Value("${app.ai.endpoint:}") private String endpoint;
  @Value("${app.ai.deployment:}") private String deployment;
  @jakarta.annotation.PostConstruct void validateRequiredConfiguration() {
    if(required&&(endpoint.isBlank()||deployment.isBlank()))
      throw new IllegalStateException("Azure AI is required: configure its endpoint and deployment; no silent demo fallback");
  }
  static TokenCredential credential(String type,String file) {
    return switch(type) {
      case "token-file"->new AzureTokenFileCredential(file);
      case "azure-cli"->new AzureCliCredentialBuilder().processTimeout(Duration.ofSeconds(20)).build();
      case "default"->new DefaultAzureCredentialBuilder().credentialProcessTimeout(Duration.ofSeconds(20)).build();
      default->throw new IllegalArgumentException("Unsupported Azure OpenAI credential");
    };
  }
  @Bean
  @ConditionalOnExpression("'${app.ai.endpoint:}' != '' && '${app.ai.deployment:}' != ''")
  ChatModel azureChatModel(@Value("${app.ai.endpoint}") String endpoint,
      @Value("${app.ai.deployment}") String deployment,
      @Value("${app.ai.credential:default}") String type,
      @Value("${app.ai.token-file:}") String file) {
    return AzureOpenAiChatModel.builder()
        .endpoint(endpoint)
        .tokenCredential(credential(type,file))
        .deploymentName(deployment)
        .temperature(0.1)
        .maxTokens(1500)
        .timeout(Duration.ofSeconds(35))
        .maxRetries(0)
        .logRequestsAndResponses(false)
        .build();
  }
}
