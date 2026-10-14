package dev.creditlab.platform;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class ResearchLabTest {
  private final CreditCase item=new CreditCaseService().require("praxisbank-demo","CR-2026-1048");
  private final LabStore store=new LabStore(Optional.empty(),new ObjectMapper());
  private final ResearchLab lab=new ResearchLab(new ObjectMapper(),new DocumentExtractor(),new RagEngine(false,""),store);
  @Test void catalogueHasNoRunsAndNoCloudCalls(){assertThat(lab.catalog(item)).containsEntry("references",40).containsEntry("azureCalls",0).containsEntry("runs",List.of());}
  @Test void allSuitesHaveMeasuredVariantsAndScopedImmutableHistory(){
    for(var suite:ResearchLab.Suite.values()){
      var report=lab.run(item,"test-advisor",suite);
      assertThat(report).containsEntry("azureCalls",0).containsEntry("suite",suite.name()).containsEntry("caseId",item.id());
      assertThat(report.get("datasetHash").toString()).hasSize(64);
      assertThat(report.get("implementationHash").toString()).hasSize(64);
      assertThat((List<?>)report.get("variants")).isNotEmpty();
      assertThat(report.get("scope").toString()).contains("not live case");
    }
    assertThat(store.list(item.tenantId(),item.id(),"research-run")).hasSize(4);
    assertThat(store.list("foreign",item.id(),"research-run")).isEmpty();
    assertThat(store.list(item.tenantId(),"another-case","research-run")).isEmpty();
  }
  @Test void documentExperimentActuallyReadsGeneratedPdfsAndRetainsFailures(){
    var report=lab.run(item,"test",ResearchLab.Suite.DOCUMENTS);
    @SuppressWarnings("unchecked")var variants=(List<Map<String,Object>>)report.get("variants");
    assertThat(variants).hasSize(2);
    for(var v:variants){assertThat(v).containsEntry("samples",40);assertThat(((Number)v.get("passed")).intValue()).isBetween(1,39);}
    assertThat(variants.get(1)).containsEntry("method","pdfbox-label-rules");
  }
  @Test void generatedPdfIsReadableAndSourceFaithful()throws Exception{
    var doc=new DocumentExtractor().extract("reference.pdf","application/pdf",ResearchLab.pdf("Gehaltsabrechnung\nNetto-Verdienst: 2.967,11 EUR\nAuszahlungsbetrag: 2.882,11 EUR"));
    assertThat(doc.fields()).extracting(CreditCase.Field::value).contains("2.967,11 EUR","2.882,11 EUR");
    assertThat(doc.pages().getFirst().method()).isEqualTo("pdf-text");
  }
  @Test void retrievalComparesThreeMethodsAndContainsAllThreeLanguages(){
    @SuppressWarnings("unchecked")var variants=(List<Map<String,Object>>)lab.run(item,"test",ResearchLab.Suite.RETRIEVAL).get("variants");
    assertThat(variants).extracting(v->v.get("method")).containsExactly("BM25","VECTOR","HYBRID");
    @SuppressWarnings("unchecked")var rows=(List<Map<String,Object>>)variants.getFirst().get("rows");
    assertThat(rows).hasSize(12);assertThat(rows).extracting(r->r.get("scenario").toString().substring(0,2)).contains("en","de","vi");
  }
  @Test void amountMembershipRequiresCitationsPreservesSignAndCurrency(){
    for(String value:List.of("2.967,11","2967.11","2,967.11"))assertThat(NumericEvidence.normalize(value)).contains("2967.11");
    assertThat(NumericEvidence.check("Net 2967.11 EUR [p1]",Map.of("p1","Net 2.967,11 EUR"))).containsEntry("requiresReview",false);
    for(String answer:List.of("Net 2967.11 EUR [fake]","Net 2967.11 EUR","Balance 210 EUR [p1]","Net 9999 EUR [p1]"))
      assertThat(NumericEvidence.check(answer,Map.of("p1","Net 2967.11 EUR; Balance -210 EUR"))).containsEntry("requiresReview",true);
    assertThat(NumericEvidence.check("2450 EUR [p1]",Map.of("p1","2450 USD"))).containsEntry("requiresReview",true);
    assertThat(NumericEvidence.check("100 EUR [p1]\n200 EUR",Map.of("p1","100 EUR and 200 EUR"))).containsEntry("requiresReview",true);
  }
  @Test void amountMatchMustNotClaimFieldOrIdentityVerification(){
    var report=NumericEvidence.check("Payout 2450 EUR [p1]",Map.of("p1","Net income 2450 EUR"));
    assertThat(report).containsEntry("requiresReview",false);
    assertThat(report.get("limitation").toString()).contains("person","field");
    assertThat(NumericEvidence.check("No numerical claim [p1]",Map.of("p1","source"))).containsEntry("checked",0).containsEntry("requiresReview",true);
  }
}
