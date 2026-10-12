package dev.creditlab.casework;

public interface DocumentAnalysisProvider {
  CreditCase.Document analyze(String name, String contentType, byte[] bytes);
  String provider();
  String modelId();
}
