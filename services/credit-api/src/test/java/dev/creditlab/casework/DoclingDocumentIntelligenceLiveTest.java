package dev.creditlab.casework;

import static org.assertj.core.api.Assertions.assertThat;
import java.io.ByteArrayOutputStream;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/** Explicit, local-only real model test; no Azure or downloaded publisher documents. */
@EnabledIfEnvironmentVariable(named="DOCLING_LIVE_URL",matches="http://(?:docling|localhost|127\\.0\\.0\\.1):[0-9]+")
class DoclingDocumentIntelligenceLiveTest {
  @Test void realDoclingReadsASyntheticInvoiceAndTable() throws Exception {
    byte[] input;
    try(var pdf=new PDDocument();var output=new ByteArrayOutputStream()){
      var page=new PDPage();pdf.addPage(page);
      try(var content=new PDPageContentStream(pdf,page)){
        var font=new PDType1Font(Standard14Fonts.FontName.HELVETICA);
        content.beginText();content.setFont(font,14);content.newLineAtOffset(60,730);
        content.showText("Invoice number: LAB-2026-001");content.newLineAtOffset(0,-24);
        content.showText("Invoice total: 120.00 EUR");content.endText();
        List<List<String>> rows=List.of(List.of("Item","Quantity","Gross worth"),List.of("Research service","1","120.00 EUR"),List.of("Total","1","120.00 EUR"));
        for(int row=0;row<=3;row++){content.moveTo(60,650-row*35);content.lineTo(540,650-row*35);}
        for(int column=0;column<=3;column++){content.moveTo(60+column*160,650);content.lineTo(60+column*160,545);}content.stroke();
        for(int row=0;row<rows.size();row++)for(int column=0;column<3;column++){
          content.beginText();content.setFont(font,11);content.newLineAtOffset(68+column*160,628-row*35);
          content.showText(rows.get(row).get(column));content.endText();
        }
      }
      pdf.save(output);input=output.toByteArray();
    }
    var provider=new DoclingDocumentAnalysisProvider(new DocumentExtractor(),System.getenv("DOCLING_LIVE_URL"));
    var result=provider.analyze("synthetic-local-invoice.pdf","application/pdf",input);
    assertThat(result.analysisProvider()).isEqualTo("docling");assertThat(result.confidence()).isNull();
    assertThat(result.status()).isEqualTo("review");assertThat(result.pages()).hasSize(1);
    assertThat(result.pages().getFirst().text()).contains("LAB-2026-001","120.00");
    assertThat(result.tables()).isNotEmpty();
    assertThat(result.tables().getFirst().cells()).anyMatch(cell->cell.text().contains("Gross"));
  }
}
