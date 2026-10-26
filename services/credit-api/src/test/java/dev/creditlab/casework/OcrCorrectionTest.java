package dev.creditlab.casework;

import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.util.ReflectionTestUtils;

class OcrCorrectionTest {
  private CreditCaseService service;
  private CreditCase item;
  @BeforeEach void setup(){
    var store=new SqlCaseStore(new DriverManagerDataSource("jdbc:h2:mem:ocr"+System.nanoTime()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa",""),new ObjectMapper());
    service=new CreditCaseService(store,false);ReflectionTestUtils.setField(service,"writesEnabled",true);
    item=service.create("tenant-a","reviewer",new CreditCaseService.Draft("Synthetic OCR regression","Evidence test",0,"",0,"general"));
    var region=new CreditCase.Region("r0","Total: 3,500",.1,.2,.5,.3,600,800,null,null,null);
    var doc=new CreditCase.Document("doc-1","ocr-mismatch.pdf","invoice","review",null,List.of(new CreditCase.Field("invoiceTotal","3,500",null,1,"Total: 3,500")),List.of(new CreditCase.Page(1,"Total: 3,500","test-ocr",List.of(region))),true,"test-ocr","regression","application/pdf");
    item=service.attach("tenant-a",item.id(),"test",new byte[]{1},doc,item.version());
  }
  private CreditCaseService.OcrEdit edit(long version,String original){return new CreditCaseService.OcrEdit(version,1,"r0",original,"Total: 8,500","Compared with original image");}
  @Test void persistsSeparateTranscriptionWithoutRewritingOcrFieldsOrApproval() {
    var changed=service.correctOcr("tenant-a",item.id(),"doc-1","reviewer",edit(item.version(),"Total: 3,500"));
    var saved=service.require("tenant-a",item.id());assertThat(saved).isEqualTo(changed);
    var doc=saved.documents().getFirst();assertThat(doc.pages().getFirst().text()).isEqualTo("Total: 3,500");
    assertThat(doc.fields().getFirst().value()).isEqualTo("3,500");assertThat(doc.status()).isEqualTo("review");
    assertThat(doc.ocrCorrections()).hasSize(1);assertThat(doc.ocrCorrections().getFirst().correctedText()).isEqualTo("Total: 8,500");
    assertThat(doc.ocrCorrections().getFirst().actor()).isEqualTo("reviewer");assertThat(saved.version()).isEqualTo(item.version()+1);
    assertThat(saved.audit().getLast().get(1)).isEqualTo("OCR_TRANSCRIPTION_RECORDED");
    assertThatThrownBy(()->service.correctOcr("tenant-a",item.id(),"doc-1","reviewer",edit(item.version(),"Total: 3,500"))).hasMessageContaining("409");
  }
  @Test void rejectsForeignTenantWrongSourceAndFabricatedOcr(){
    assertThatThrownBy(()->service.correctOcr("other",item.id(),"doc-1","reviewer",edit(item.version(),"Total: 3,500"))).hasMessageContaining("404");
    assertThatThrownBy(()->service.correctOcr("tenant-a",item.id(),"doc-1","reviewer",edit(item.version(),"Total: 8,500"))).hasMessageContaining("400");
    assertThat(service.require("tenant-a",item.id()).documents().getFirst().ocrCorrections()).isEmpty();
  }
  @Test void fieldReviewRetainsOriginalOcrAndTranscriptionHistory(){
    var corrected=service.correctOcr("tenant-a",item.id(),"doc-1","reviewer",edit(item.version(),"Total: 3,500"));
    var reviewed=service.review("tenant-a",item.id(),"doc-1","reviewer",new CreditCaseService.Review(corrected.version(),List.of("8,500")));
    var field=reviewed.documents().getFirst().fields().getFirst();assertThat(field.value()).isEqualTo("8,500");assertThat(field.originalValue()).isEqualTo("3,500");
    assertThat(reviewed.documents().getFirst().ocrCorrections()).hasSize(1);
  }
}
