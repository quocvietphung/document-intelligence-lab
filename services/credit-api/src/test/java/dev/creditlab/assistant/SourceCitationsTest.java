package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.*;
import java.util.List;
import org.junit.jupiter.api.Test;

class SourceCitationsTest {
  private final List<CreditAssistantService.Source> sources=List.of(new CreditAssistantService.Source("doc-actual:p1:fields","invoice.pdf","Invoice no: 51109301"));
  @Test void onlyRedundantBracketsAroundAnExactAvailableIdAreCanonicalized(){
    assertThat(SourceCitations.validate("Rechnungsnummer 51109301 [[doc-actual:p1:fields]].",sources)).isEqualTo("Rechnungsnummer 51109301 [doc-actual:p1:fields].");
    assertThat(SourceCitations.validate("Invoice [doc-actual:p1:fields].",sources)).isEqualTo("Invoice [doc-actual:p1:fields].");
    // The exact authorized ID in round brackets is the same citation, written in another notation.
    assertThat(SourceCitations.validate("Rechnungsnummer 51109301 (doc-actual:p1:fields).",sources)).isEqualTo("Rechnungsnummer 51109301 [doc-actual:p1:fields].");
  }
  @Test void unknownMissingAndNearMatchIdsAreRejectedNotRepaired(){
    for(String answer:List.of("Invoice 51109301", "Invoice [doc-guessed:p1]", "Invoice (doc-guessed:p1)", "Invoice [[doc-actual:p2:fields]]", "Invoice (doc-actual:p2:fields)", "Invoice [doc-actual:p1:fields] [1]", "Invoice [doc-actual:p1:fields] [unfinished"))
      assertThatThrownBy(()->SourceCitations.validate(answer,sources)).isInstanceOfSatisfying(ModelContractException.class,e->{assertThat(e.getStatusCode().value()).isEqualTo(422);assertThat(e.code()).isEqualTo("MODEL_CITATION_CONTRACT_FAILED");});
  }
  @Test void placeholderBracketsAreNotCitationsAndTheRefusalNamesOnlyTheReason(){
    // The local model wrote a salutation placeholder. The refusal names the reason and never echoes the bracket text.
    assertThatThrownBy(()->SourceCitations.validate("Herr [Name], die Rechnung [doc-actual:p1:fields].",sources))
        .isInstanceOfSatisfying(ModelContractException.class,e->{assertThat(e.reason()).isEqualTo("NON_SOURCE_BRACKET");assertThat(e.getMessage()).doesNotContain("Name");});
    assertThatThrownBy(()->SourceCitations.validate("Invoice 51109301 without a citation.",sources))
        .isInstanceOfSatisfying(ModelContractException.class,e->assertThat(e.reason()).isEqualTo("NO_CITATION"));
    assertThatThrownBy(()->SourceCitations.validate("Invoice [doc-actual:p1:fields] [unfinished",sources))
        .isInstanceOfSatisfying(ModelContractException.class,e->assertThat(e.reason()).isEqualTo("STRAY_BRACKET"));
    assertThatThrownBy(()->SourceCitations.validate("   ",sources))
        .isInstanceOfSatisfying(ModelContractException.class,e->assertThat(e.reason()).isEqualTo("EMPTY_ANSWER"));
  }
}
