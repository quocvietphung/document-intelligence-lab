package dev.creditlab.casework;
import com.azure.identity.CredentialUnavailableException;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class AzureDocumentRecoveryTest {
  @Test void expiredOrMissingCredentialHasSpecificSafeReason(){
    var error=AzureDocumentIntelligenceProvider.unavailable(new RuntimeException(new CredentialUnavailableException("SENSITIVE-TEST-CONTENT")));
    assertThat(error.getStatusCode().value()).isEqualTo(503);
    assertThat(error.getReason()).isEqualTo("AZURE_AUTH_UNAVAILABLE");
    assertThat(error.getMessage()).doesNotContain("SENSITIVE-TEST-CONTENT");
  }
  @Test void unrelatedOutageIsNotCalledAnExpiredToken(){
    assertThat(AzureDocumentIntelligenceProvider.unavailable(new RuntimeException("private document payload")).getReason()).isEqualTo("AZURE_SERVICE_UNAVAILABLE");
  }
}
