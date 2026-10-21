package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.*;
import java.util.List;
import org.junit.jupiter.api.Test;

class StructuredReviewTest {
  private final List<CreditAssistantService.Source> sources=List.of(new CreditAssistantService.Source("d:p1","invoice","Date of issue: 03/07/2023\nGross total: INR 100.00\nTax ID ABC123\nMain Street"));
  private StructuredReview.Draft draft(String quote,String date,String category){return new StructuredReview.Draft(List.of(new StructuredReview.Finding("d:p1",quote,date,category)),"");}
  @Test void timelineRetainsAnExactDatedPhraseAndRejectsUndatedAmounts(){
    assertThat(StructuredReview.render(draft("Date of issue: 03/07/2023","03/07/2023",""),"timeline","en",sources)).contains("03/07/2023 [d:p1]").doesNotContain("INR");
    assertThatThrownBy(()->StructuredReview.render(draft("Gross total: INR 100.00","100.00",""),"timeline","en",sources)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
  }
  @Test void sourceIdAndQuoteMustBothMatchTheSuppliedOriginal(){
    assertThatThrownBy(()->StructuredReview.render(draft("Date of issue: 2025","2025",""),"timeline","en",sources)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThatThrownBy(()->StructuredReview.render(new StructuredReview.Draft(List.of(new StructuredReview.Finding("foreign:p1","Date of issue: 03/07/2023","03/07/2023","")),""),"timeline","en",sources)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
  }
  @Test void privacyRendersOnlyLocalizedCategoriesNeverTheQuotedValues(){
    assertThat(StructuredReview.render(draft("Tax ID ABC123","","tax identifiers"),"privacy-review","en",sources)).contains("tax identifiers [d:p1]").doesNotContain("ABC123");
    assertThat(StructuredReview.render(draft("Main Street","","addresses"),"privacy-review","vi",sources)).contains("Địa chỉ").doesNotContain("Main Street");
  }
  @Test void emptyFindingsAreLimitedToInspectedExcerptsNotWholeDocument(){
    assertThat(StructuredReview.render(new StructuredReview.Draft(List.of(),"unknown"),"obligations","en",sources)).contains("No explicit contractual obligations","inspected excerpts","[d:p1]");
  }
}
