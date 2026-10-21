package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class SourceCitationsTest {
  private final List<CreditAssistantService.Source> sources=List.of(new CreditAssistantService.Source("doc-actual:p1:fields","invoice.pdf","Invoice no: 51109301"));
  @Test void onlyRedundantBracketsAroundAnExactAvailableIdAreCanonicalized(){
    assertThat(SourceCitations.validate("Rechnungsnummer 51109301 [[doc-actual:p1:fields]].",sources)).isEqualTo("Rechnungsnummer 51109301 [doc-actual:p1:fields].");
    assertThat(SourceCitations.validate("Invoice [doc-actual:p1:fields].",sources)).isEqualTo("Invoice [doc-actual:p1:fields].");
  }
  @Test void unknownMissingAndNearMatchIdsAreRejectedNotRepaired(){
    for(String answer:List.of("Invoice 51109301", "Invoice [doc-guessed:p1]", "Invoice [[doc-actual:p2:fields]]", "Invoice [doc-actual:p1:fields] [1]", "Invoice [doc-actual:p1:fields] [unfinished"))
      assertThatThrownBy(()->SourceCitations.validate(answer,sources)).isInstanceOfSatisfying(ResponseStatusException.class,e->assertThat(e.getStatusCode().value()).isEqualTo(422));
  }
}
