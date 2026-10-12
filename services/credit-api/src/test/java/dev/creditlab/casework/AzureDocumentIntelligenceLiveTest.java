package dev.creditlab.casework;

import static org.assertj.core.api.Assertions.*;
import java.io.ByteArrayOutputStream;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/** Opt-in: sends only a generated synthetic page to the explicitly configured Azure resource. */
@EnabledIfEnvironmentVariable(named="AZURE_DOCUMENT_LIVE_TEST",matches="true")
class AzureDocumentIntelligenceLiveTest {
  @Test void extractsSyntheticPayrollUsingEntraIdentity() throws Exception {
    String endpoint=System.getenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT");
    assertThat(endpoint).isNotBlank();
    var provider=new AzureDocumentIntelligenceProvider(new DocumentExtractor(),endpoint,"prebuilt-layout",2,"azure-cli","");
    byte[] pdf=syntheticPayroll();
    String samplePath=System.getenv("AZURE_DOCUMENT_SAMPLE_PATH");
    if(samplePath!=null&&!samplePath.isBlank()) java.nio.file.Files.write(java.nio.file.Path.of(samplePath),pdf);
    var result=provider.analyze("synthetic-payroll.pdf","application/pdf",pdf);
    assertThat(result.analysisProvider()).isEqualTo("azure-document-intelligence");
    assertThat(result.modelId()).isEqualTo("prebuilt-layout");
    assertThat(result.type()).isEqualTo("income");
    assertThat(result.pages()).hasSize(1);
    assertThat(result.pages().getFirst().text()).contains("Nettoeinkommen").contains("3200");
    assertThat(result.fields()).anySatisfy(field->{
      assertThat(field.label()).isEqualTo("netIncome");
      assertThat(field.value()).contains("3200");
      assertThat(field.page()).isEqualTo(1);
    });
    System.out.println("Azure live verification: provider="+result.analysisProvider()+", model="+result.modelId()+
        ", pages="+result.pages().size()+", fields="+result.fields().size()+", review="+result.status());
  }
  private byte[] syntheticPayroll() throws Exception {
    try(var document=new PDDocument();var output=new ByteArrayOutputStream()) {
      var page=new PDPage();document.addPage(page);
      try(var content=new PDPageContentStream(document,page)) {
        content.beginText();content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA),14);
        content.setLeading(28);content.newLineAtOffset(60,730);
        for(String line:List.of("SYNTHETIC TEST DOCUMENT - NO REAL PERSON","Gehaltsabrechnung",
            "Nettoeinkommen: 3200 EUR","Arbeitgeber: Muster GmbH","Datum: 01.10.2026")) {
          content.showText(line);content.newLine();
        }
        content.endText();
      }
      document.save(output);return output.toByteArray();
    }
  }
}
