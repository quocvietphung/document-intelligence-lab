package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.*;
import dev.creditlab.security.LocalModelEndpoint;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class LocalAiConfigurationTest {
  @Test void constructsWithoutNetworkOrAutomaticModelDownload() {
    assertThat(new LocalAiConfiguration().localChatModel("http://ollama:11434","qwen3:4b-instruct-2507-q4_K_M")).isNotNull();
  }
  @Test void rejectsCloudEndpointsCredentialUrlsAndMissingModels() {
    for(String url:java.util.List.of("https://example.com","http://169.254.169.254","http://localhost:11434?token=secret","http://secret@localhost:11434","http://localhost:11434/v1"))
      assertThatThrownBy(()->LocalModelEndpoint.validate(url)).isInstanceOf(IllegalArgumentException.class).hasMessageNotContaining("secret");
    assertThatThrownBy(()->new LocalAiConfiguration().localChatModel("http://ollama:11434","")).isInstanceOf(IllegalArgumentException.class);
    for(String model:java.util.List.of("https://cloud.example/model","qwen:cloud","model-cloud"))assertThatThrownBy(()->LocalModelEndpoint.model(model)).isInstanceOf(IllegalArgumentException.class);
    assertThat(LocalModelEndpoint.validate("http://host.docker.internal:11434/")).isEqualTo("http://host.docker.internal:11434");
  }
  @Test void rejectsUnknownProvider() {
    var configuration=new LocalAiConfiguration();ReflectionTestUtils.setField(configuration,"provider","automatic-fallback");
    assertThatThrownBy(configuration::validateProvider).isInstanceOf(IllegalArgumentException.class);
  }
}
