package dev.creditlab.casework;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DocumentAnalysisService {
  private final LocalDocumentAnalysisProvider local;
  private final Optional<AzureDocumentIntelligenceProvider> azure;
  private final String mode;

  public DocumentAnalysisService(LocalDocumentAnalysisProvider local,
      Optional<AzureDocumentIntelligenceProvider> azure,
      @Value("${app.document-intelligence.mode:local}") String mode) {
    this.local = local;
    this.azure = azure;
    this.mode = mode.toLowerCase(Locale.ROOT);
    if (!java.util.Set.of("local","azure","azure-with-local-fallback").contains(this.mode)) {
      throw new IllegalArgumentException("Unsupported document intelligence mode");
    }
  }

  public CreditCase.Document analyze(String name, String contentType, byte[] bytes) {
    if (mode.equals("local")) return local.analyze(name, contentType, bytes);
    var remote = azure.orElseThrow(() -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
        "Azure Document Intelligence endpoint is not configured"));
    try {
      return remote.analyze(name, contentType, bytes);
    } catch (ResponseStatusException error) {
      boolean invalidDocument=error.getStatusCode().value()==400||error.getStatusCode().value()==422;
      if (!mode.equals("azure-with-local-fallback") || invalidDocument) throw error;
      return local.analyze(name, contentType, bytes);
    }
  }

  public Map<String,Object> status() {
    return Map.of(
        "mode", mode,
        "azureConfigured", azure.isPresent(),
        "activeProvider", mode.equals("local") ? local.provider() : azure.map(DocumentAnalysisProvider::provider).orElse("unavailable"),
        "modelId", mode.equals("local") ? local.modelId() : azure.map(DocumentAnalysisProvider::modelId).orElse("unavailable"),
        "maxPages", mode.equals("local") ? 4 : azure.map(AzureDocumentIntelligenceProvider::maxPages).orElse(4),
        "keylessIdentity", true,
        "humanReviewRequired", true);
  }
}
