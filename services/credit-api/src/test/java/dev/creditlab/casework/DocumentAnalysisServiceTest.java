package dev.creditlab.casework;

import static org.assertj.core.api.Assertions.assertThat;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class DocumentAnalysisServiceTest {
  @Test void localModeReportsProviderAndRetainsMetadata() {
    var service=new DocumentAnalysisService(new LocalDocumentAnalysisProvider(new DocumentExtractor()),Optional.empty(),Optional.empty(),"local");
    var document=service.analyze("statement.txt","text/plain",
        "Kontoauszug\nMonatliche Rate: 1.250,00 EUR".getBytes(StandardCharsets.UTF_8));
    assertThat(document.analysisProvider()).isEqualTo("local");
    assertThat(document.modelId()).isEqualTo("pdfbox-tesseract-rules");
    assertThat(document.contentType()).isEqualTo("text/plain");
    assertThat(service.status()).containsEntry("azureConfigured",false).containsEntry("keylessIdentity",true);
  }
  @Test void azureModeFailsClosedWhenEndpointIsMissing() {
    var service=new DocumentAnalysisService(new LocalDocumentAnalysisProvider(new DocumentExtractor()),Optional.empty(),Optional.empty(),"azure");
    assertThat(org.assertj.core.api.Assertions.catchThrowable(()->service.analyze("statement.txt","text/plain","test".getBytes(StandardCharsets.UTF_8))))
        .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
        .hasMessageContaining("endpoint is not configured");
  }
}
