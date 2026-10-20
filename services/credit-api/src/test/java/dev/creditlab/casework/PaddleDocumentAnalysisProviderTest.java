package dev.creditlab.casework;

import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class PaddleDocumentAnalysisProviderTest {
  private final PaddleDocumentAnalysisProvider provider=new PaddleDocumentAnalysisProvider(new DocumentExtractor(),"http://localhost:8090");
  @Test void mapsContractWithoutInventingConfidenceOrHumanApproval()throws Exception{
    var input=new ObjectMapper().readTree("{\"provider\":\"paddleocr\",\"model\":\"PP-StructureV3\",\"pages\":[{\"number\":1,\"text\":\"Fictional invoice INV-123 total 15.00 EUR\"}],\"tables\":[]}");
    var doc=provider.parse("invoice.pdf","application/pdf",input);
    assertThat(doc.analysisProvider()).isEqualTo("paddleocr");assertThat(doc.confidence()).isNull();assertThat(doc.status()).isEqualTo("review");assertThat(doc.pages()).hasSize(1);
  }
  @Test void rejectsUnknownModelsAndMissingPageEvidence()throws Exception{
    for(String value:new String[]{"{}","{\"provider\":\"paddleocr\",\"model\":\"PP-StructureV3\",\"pages\":[],\"tables\":[]}"}){
      var input=new ObjectMapper().readTree(value);assertThatThrownBy(()->provider.parse("invoice.pdf","application/pdf",input)).isInstanceOf(ResponseStatusException.class);
    }
  }
}
