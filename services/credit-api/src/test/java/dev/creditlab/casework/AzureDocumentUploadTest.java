package dev.creditlab.casework;

import static org.assertj.core.api.Assertions.*;
import java.io.ByteArrayOutputStream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class AzureDocumentUploadTest {
  @Test void acceptsTwoPagePdfForFreeTier() throws Exception {
    assertThatCode(()->AzureDocumentIntelligenceProvider.validateUpload(pdf(2),2)).doesNotThrowAnyException();
  }
  @Test void rejectsExtraPageBeforeSendingToAzure() throws Exception {
    assertThatThrownBy(()->AzureDocumentIntelligenceProvider.validateUpload(pdf(3),2))
        .isInstanceOf(ResponseStatusException.class).hasMessageContaining("maximum 2 pages");
  }
  @Test void rejectsTextDisguisedAsPdf() {
    assertThatThrownBy(()->AzureDocumentIntelligenceProvider.validateUpload("Net income: 1234".getBytes(),2))
        .isInstanceOf(ResponseStatusException.class).hasMessageContaining("PDF, PNG or JPEG");
  }
  private byte[] pdf(int pages) throws Exception {
    try(var document=new PDDocument();var output=new ByteArrayOutputStream()) {
      for(int page=0;page<pages;page++) document.addPage(new PDPage());
      document.save(output);return output.toByteArray();
    }
  }
}
