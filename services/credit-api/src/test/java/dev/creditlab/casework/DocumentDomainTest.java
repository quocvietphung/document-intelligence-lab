package dev.creditlab.casework;

import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.util.ReflectionTestUtils;
import dev.creditlab.platform.RagEngine;
import dev.creditlab.trust.TrustCatalog;

class DocumentDomainTest {
  private CreditCase dossier(String domain,List<CreditCase.Document> docs) {
    return new CreditCase("CR-domain","t","Fictional research","Inspect source",0,0,"DRAFT",List.of(),List.of(),"","2026-10-15T00:00:00Z",docs,List.of(),0,domain);
  }
  @Test void oldJsonDefaultsToBankingWithoutLosingOriginals() throws Exception {
    var mapper=new ObjectMapper();var old=mapper.valueToTree(dossier("banking",List.of()));
    ((com.fasterxml.jackson.databind.node.ObjectNode)old).remove("domain");
    assertThat(mapper.treeToValue(old,CreditCase.class).domain()).isEqualTo("banking");
    assertThatThrownBy(()->DocumentDomain.normalize("arbitrary")).isInstanceOf(IllegalArgumentException.class);
  }
  @Test void generalDocumentsHaveNoCreditChecklist() {
    var parsed=new DocumentExtractor().parse("contract.txt",List.of(new CreditCase.Page(1,"Vertragsnummer: LAB-42\nDatum: 15.10.2026","text")),null);
    var verified=new CreditCase.Document(parsed.id(),parsed.name(),parsed.type(),"verified",null,parsed.fields(),parsed.pages(),true,"local","rules","text/plain");
    var result=CreditCaseService.documentView(dossier("general",List.of(verified)));
    assertThat(result.missingDocuments()).isEmpty();assertThat(result.completeness()).isEqualTo(100);
    assertThat(result.status()).isEqualTo("REVIEW_COMPLETE");assertThat(result.domain()).isEqualTo("general");
  }
  @Test void insuranceExtractionKeepsPageEvidenceAndDoesNotPromisePayout() {
    String text="FIKTIV - Versicherungsschein\nVersicherungsnummer: LAB-V-104\nVersicherer: Muster Versicherung\nVersicherungsnehmer: Erika Beispiel\nJahresbeitrag: 480,00 EUR\nSelbstbeteiligung: 250,00 EUR\nDeckungssumme: 50.000,00 EUR\nVersicherungsbeginn: 01.01.2026\nVersicherungsende: 31.12.2026";
    var doc=new DocumentExtractor().parse("fictional-policy.pdf",List.of(new CreditCase.Page(1,text,"azure-document-intelligence")),null);
    assertThat(doc.type()).isEqualTo("insurance-policy");
    assertThat(doc.fields()).extracting(CreditCase.Field::label).contains("policyNumber","premium","deductible","coverageStart","coverageEnd");
    assertThat(doc.fields()).allSatisfy(f->{assertThat(f.page()).isEqualTo(1);assertThat(f.evidence()).isNotBlank();assertThat(f.confidence()).isNull();});
    assertThat(CreditCaseService.documentView(dossier("insurance",List.of(doc))).missingDocuments()).isEmpty();
    assertThat(FieldValueNormalizer.normalize("premium","480,00 EUR")).isEqualTo("480");
    assertThat(FieldValueNormalizer.normalize("coverageStart","01.01.2026")).isEqualTo("2026-01-01");
  }
  @Test void claimDoesNotSatisfyPolicyRequirement() {
    var doc=new DocumentExtractor().parse("claim.txt",List.of(new CreditCase.Page(1,"Schadenmeldung\nSchadennummer: LAB-S-42\nVersicherungsnummer: LAB-V-104\nSchadendatum: 10.10.2026","text")),null);
    assertThat(doc.type()).isEqualTo("insurance-claim");
    assertThat(CreditCaseService.documentView(dossier("insurance",List.of(doc))).missingDocuments()).containsExactly("insurance-policy");
  }
  @Test void referenceWordingDoesNotSatisfyAnIndividualPolicyChecklist() {
    for(String text:List.of("GC 6002 PART I - DEFINITIONS insurance policy", "HO-4 POLICY COVERAGE PERIOD insurance policy", "GC 6003 POLICY ADMINISTRATION", "HO-4 SECTION II PERSONAL LIABILITY")) {
      var doc=new DocumentExtractor().parse("reference.pdf",List.of(new CreditCase.Page(1,text,"pdf-text")),null);
      assertThat(doc.type()).isEqualTo("insurance-wording");
      assertThat(doc.fields()).isEmpty();
      assertThat(CreditCaseService.documentView(dossier("insurance",List.of(doc))).missingDocuments()).containsExactly("insurance-policy");
    }
  }
  @Test void kaggleInvoiceNumberKeepsItsSourceWithoutInventingTotals() {
    var doc=new DocumentExtractor().parse("invoice.pdf",List.of(new CreditCase.Page(1,"Invoice no: 51109301\nTotal\nINR 1,844,673.60","pdf-text")),null);
    assertThat(doc.type()).isEqualTo("invoice");
    assertThat(doc.fields()).extracting(CreditCase.Field::label).containsExactly("invoiceNumber");
    assertThat(doc.fields().getFirst().value()).isEqualTo("51109301");
    assertThat(doc.fields().getFirst().evidence()).contains("Invoice no: 51109301");
  }
  @Test void domainPersistsAndEditsAreVersionChecked() {
    var store=new SqlCaseStore(new DriverManagerDataSource("jdbc:h2:mem:domains"+System.nanoTime()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa",""),new ObjectMapper());
    var service=new CreditCaseService(store,false);ReflectionTestUtils.setField(service,"writesEnabled",true);
    var created=service.create("t","a",new CreditCaseService.Draft("Insurance research","Inspect policy",0,"",0,"insurance"));
    assertThat(store.get("t",created.id()).orElseThrow().domain()).isEqualTo("insurance");
    var edited=service.edit("t",created.id(),"a",new CreditCaseService.Draft("Edited","Inspect policy",0,"",0));
    assertThat(edited.domain()).isEqualTo("insurance");assertThat(edited.missingDocuments()).containsExactly("insurance-policy");
    assertThat(store.get("other",created.id())).isEmpty();
    assertThatThrownBy(()->service.edit("t",created.id(),"a",new CreditCaseService.Draft("Stale","Inspect",0,"",0,"general"))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    var general=service.edit("t",created.id(),"a",new CreditCaseService.Draft("General","Inspect",0,"",edited.version(),"general"));
    assertThat(general.domain()).isEqualTo("general");assertThat(general.missingDocuments()).isEmpty();
  }
  @Test void ragAndControlledTasksUseTheSelectedDomain() {
    var rag=new RagEngine(false,"");
    var insurance=rag.chunks(dossier("insurance",List.of())).stream().filter(c->c.id().equals("policy")).findFirst().orElseThrow();
    assertThat(insurance.text()).contains("Insurance research").doesNotContain("matching salary");
    for(String locale:List.of("en","de","vi")) {
      assertThat(TrustCatalog.question("reconcile",locale,"insurance")).doesNotContain("Netto-Verdienst");
      assertThat(TrustCatalog.question("terminology",locale,"general")).doesNotContain("Auszahlungsbetrag");
    }
  }
}
