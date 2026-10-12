package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.*;
import dev.creditlab.security.AzureTokenFileCredential;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class AzureAiConfigurationTest {
  @Test void localContainerUsesOnlyShortLivedTokenFile() {
    assertThat(AzureAiConfiguration.credential("token-file","/run/azure-auth/token.json")).isInstanceOf(AzureTokenFileCredential.class);
  }
  @Test void rejectsUnknownCredentialsAndMissingFile() {
    assertThatThrownBy(()->AzureAiConfiguration.credential("api-key","" )).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->AzureAiConfiguration.credential("token-file","" )).isInstanceOf(IllegalArgumentException.class);
  }
  @Test void requiredAzureModeCannotSilentlyBecomeDemo() {
    var config=new AzureAiConfiguration();
    ReflectionTestUtils.setField(config,"required",true);
    ReflectionTestUtils.setField(config,"endpoint","");ReflectionTestUtils.setField(config,"deployment","");
    assertThatThrownBy(config::validateRequiredConfiguration).isInstanceOf(IllegalStateException.class);
  }
}
