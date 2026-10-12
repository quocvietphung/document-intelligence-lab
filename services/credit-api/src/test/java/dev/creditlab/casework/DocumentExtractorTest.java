package dev.creditlab.casework;
import static org.assertj.core.api.Assertions.*;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;

class DocumentExtractorTest {
  final DocumentExtractor extractor=new DocumentExtractor();
  @TestFactory Collection<DynamicTest> referenceBenchmark() throws Exception {
    var refs=new ObjectMapper().readTree(getClass().getResourceAsStream("/extraction-references.json"));
    var tests=new ArrayList<DynamicTest>();
    for(var ref:refs) tests.add(DynamicTest.dynamicTest(ref.get("id").asText(),()->{
      var document=extractor.parse("synthetic.txt",List.of(new CreditCase.Page(1,ref.get("text").asText(),"utf8-text")),null);
      assertThat(document.type()).isEqualTo(ref.get("type").asText());
      var fields=new TreeMap<String,String>(); for(var f:document.fields()) { fields.put(f.label(),f.value());assertThat(f.page()).isEqualTo(1);assertThat(f.evidence()).contains(f.value());assertThat(f.confidence()).isNull(); }
      var expected=new TreeMap<String,String>();ref.get("fields").fields().forEachRemaining(entry->expected.put(entry.getKey(),entry.getValue().asText()));
      assertThat(fields).isEqualTo(expected);assertThat(document.status()).isEqualTo("review");
    }));
    return tests;
  }
  @Test void rejectsEmptyAndUnknownBinary() {
    assertThatThrownBy(()->extractor.extract("file.pdf",new byte[0])).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThatThrownBy(()->extractor.extract("file.exe",new byte[]{1,2,3})).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
  }
  @Test void textExtractionRetainsEvidenceWithoutFakeConfidence() {
    var doc=extractor.extract("synthetic.txt","Kontoauszug\nMonatliche Rate: 1200 EUR".getBytes(java.nio.charset.StandardCharsets.UTF_8));
    assertThat(doc.fields()).hasSize(1);assertThat(doc.confidence()).isNull();assertThat(doc.originalAvailable()).isTrue();
  }
  @Test void normalizesAzureAndCustomModelFieldNames() {
    assertThat(DocumentExtractor.canonicalFieldLabel("Nettoeinkommen (€)")).contains("netIncome");
    assertThat(DocumentExtractor.canonicalFieldLabel("Monthly rate")).contains("monthlyRate");
    assertThat(DocumentExtractor.canonicalFieldLabel("Unknown bank field")).isEmpty();
    assertThat(DocumentExtractor.canonicalFieldLabel("Netto-Verdienst")).contains("netIncome");
    assertThat(DocumentExtractor.canonicalFieldLabel("Auszahlungsbetrag")).contains("payoutAmount");
    assertThat(DocumentExtractor.canonicalFieldLabel("Netto-Bezüge/Netto-Abzüge")).isEmpty();
  }
  @Test void classifiesCommonGermanPayrollHeadingAndSeparatesPayout() {
    var doc=extractor.parse("payroll.pdf",List.of(new CreditCase.Page(1,"Abrechnung der Brutto/Netto-Bezüge\nNetto-Verdienst: 2.967,11\nAuszahlungsbetrag: 2.882,11","test")),null);
    assertThat(doc.type()).isEqualTo("income");
    assertThat(doc.fields()).extracting(CreditCase.Field::label).containsExactly("netIncome","payoutAmount");
  }
}
