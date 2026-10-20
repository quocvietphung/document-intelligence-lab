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
  private final Optional<DoclingDocumentAnalysisProvider> docling;
  private final String mode;
  @org.springframework.beans.factory.annotation.Autowired(required=false) private PaddleDocumentAnalysisProvider paddle;

  public DocumentAnalysisService(LocalDocumentAnalysisProvider local,
      Optional<AzureDocumentIntelligenceProvider> azure,
      Optional<DoclingDocumentAnalysisProvider> docling,
      @Value("${app.document-intelligence.mode:local}") String mode) {
    this.local = local;
    this.azure = azure;
    this.docling = docling;
    this.mode = mode.toLowerCase(Locale.ROOT);
    if (!java.util.Set.of("local","docling","paddleocr","azure","azure-with-local-fallback").contains(this.mode)) {
      throw new IllegalArgumentException("Unsupported document intelligence mode");
    }
  }

  public CreditCase.Document analyze(String name, String contentType, byte[] bytes) {
    if (mode.equals("local")) return local.analyze(name, contentType, bytes);
    if (mode.equals("paddleocr")) {
      if(paddle==null)throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"PaddleOCR is not configured");
      return paddle.analyze(name,contentType,bytes);
    }
    if (mode.equals("docling")) return docling.orElseThrow(() -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
        "Docling is not configured")).analyze(name, contentType, bytes);
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
    Optional<? extends DocumentAnalysisProvider> selected=mode.equals("local")?Optional.of(local):mode.equals("paddleocr")?Optional.ofNullable(paddle):mode.equals("docling")?docling:azure;
    return Map.of(
        "mode", mode,
        "azureConfigured", azure.isPresent(),
        "activeProvider", selected.map(DocumentAnalysisProvider::provider).orElse("unavailable"),
        "modelId", selected.map(DocumentAnalysisProvider::modelId).orElse("unavailable"),
        "maxPages", java.util.Set.of("local","docling","paddleocr").contains(mode) ? 4 : azure.map(AzureDocumentIntelligenceProvider::maxPages).orElse(4),
        "keylessIdentity", true,
        "humanReviewRequired", true);
  }
}
