package dev.creditlab.casework;

import static org.assertj.core.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class RealEstateDossierReviewTest {
  private final DocumentExtractor extractor=new DocumentExtractor();

  @Test void authoredPdfDossierClassifiesExtractsAndFlagsTheIntentionalVariance() throws Exception {
    var documents=new ArrayList<CreditCase.Document>();
    for(var expected:Map.of(
        "fictional-construction-order.pdf","construction-order",
        "fictional-change-order.pdf","change-order",
        "fictional-construction-invoice.pdf","construction-invoice",
        "fictional-acceptance-report.pdf","acceptance-report",
        "fictional-site-meeting-minutes.pdf","site-meeting-minutes").entrySet()) {
      try(var input=getClass().getResourceAsStream("/real-estate/"+expected.getKey())) {
        assertThat(input).as(expected.getKey()).isNotNull();
        var document=extractor.extract(expected.getKey(),"application/pdf",input.readAllBytes());
        assertThat(document.type()).isEqualTo(expected.getValue());
        assertThat(document.pages()).hasSize(1);
        assertThat(document.fields()).allSatisfy(field->{assertThat(field.page()).isEqualTo(1);assertThat(field.evidence()).isNotBlank();});
        documents.add(document);
      }
    }
    assertThat(documents).filteredOn(d->d.type().equals("construction-order")).singleElement()
        .extracting(d->d.fields().stream().map(CreditCase.Field::label).toList()).asList().contains("projectId","orderNumber","orderTotal");
    assertThat(documents).filteredOn(d->d.type().equals("construction-invoice")).singleElement()
        .extracting(d->d.fields().stream().map(CreditCase.Field::label).toList()).asList().contains("invoiceNumber","invoiceTotal","orderNumber");

    var issues=RealEstateDossierReview.evaluate("real-estate",documents);
    assertThat(issues).extracting(CreditCase.ValidationIssue::code)
        .contains("CONSTRUCTION_INVOICE_EXCEEDS_APPROVED_VALUE","OPEN_ACCEPTANCE_DEFECTS")
        .doesNotContain("PROJECT_REFERENCE_CONFLICT","ORDER_REFERENCE_CONFLICT","REMEDIATION_DEADLINE_CONFLICT");
    assertThat(issues).filteredOn(issue->issue.code().equals("CONSTRUCTION_INVOICE_EXCEEDS_APPROVED_VALUE")).singleElement()
        .extracting(CreditCase.ValidationIssue::message).asString().contains("1200.00 EUR");
  }

  @Test void realEstateDomainRequiresTheReviewChainAndUsesAConstructionSpecificRagBoundary() {
    assertThat(DocumentDomain.normalize("REAL-ESTATE")).isEqualTo("real-estate");
    assertThat(DocumentDomain.required("real-estate")).containsExactly("construction-order","change-order","construction-invoice","acceptance-report");
    for(String locale:List.of("en","de","vi"))
      assertThat(dev.creditlab.trust.TrustCatalog.question("reconcile",locale,"real-estate"))
          .containsAnyOf("payment","Zahlungs","thanh toán").doesNotContain("Netto-Verdienst");
  }

  @Test void equallyValuedDistinctChangeOrdersAreNotCollapsed() {
    var fields=List.of(
        new CreditCase.Field("orderTotal","100.00",99,1,"order"),
        new CreditCase.Field("invoiceTotal","120.00",99,1,"invoice"));
    var change=List.of(new CreditCase.Field("changeOrderTotal","10.00",99,1,"change"));
    var documents=List.of(document("order",fields),document("change-a",change),document("change-b",change));
    assertThat(RealEstateDossierReview.evaluate("real-estate",documents))
        .extracting(CreditCase.ValidationIssue::code)
        .doesNotContain("CONSTRUCTION_INVOICE_EXCEEDS_APPROVED_VALUE","CONSTRUCTION_INVOICE_BELOW_APPROVED_VALUE");
  }

  private static CreditCase.Document document(String id,List<CreditCase.Field> fields) {
    return new CreditCase.Document(id,id+".pdf","fixture","EXTRACTED",99,fields,List.of(),true,"fixture","fixture","application/pdf");
  }
}
