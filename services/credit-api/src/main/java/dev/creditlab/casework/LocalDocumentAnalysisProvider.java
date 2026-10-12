package dev.creditlab.casework;

import org.springframework.stereotype.Component;

@Component
public class LocalDocumentAnalysisProvider implements DocumentAnalysisProvider {
  private final DocumentExtractor extractor;

  public LocalDocumentAnalysisProvider(DocumentExtractor extractor) { this.extractor = extractor; }

  @Override public CreditCase.Document analyze(String name, String contentType, byte[] bytes) {
    return extractor.extract(name, contentType, bytes);
  }
  @Override public String provider() { return "local"; }
  @Override public String modelId() { return "pdfbox-tesseract-rules"; }
}
