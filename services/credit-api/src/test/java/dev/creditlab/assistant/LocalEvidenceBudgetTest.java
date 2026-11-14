package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;

class LocalEvidenceBudgetTest {
  private static CreditAssistantService.Source excerpt(String id, int chars) {
    return new CreditAssistantService.Source(id, "Invoice", "x".repeat(chars));
  }

  @Test void fixedSourcesStayAndDocumentExcerptsKeepTheirRankingWithinTheBudget() {
    var ranked = List.of(
        excerpt("doc-a:p1:c1", 2_000),
        new CreditAssistantService.Source("case-summary", "Case", "Status=OPEN"),
        excerpt("doc-b:p2:c1", 2_000),
        excerpt("doc-c:p3:c1", 2_000),
        new CreditAssistantService.Source("policy", "Policy", "Human review is mandatory."));
    var kept = EvidenceContext.withinLocalBudget(ranked, 5_000);
    assertThat(kept).extracting(CreditAssistantService.Source::id)
        .containsExactly("doc-a:p1:c1", "case-summary", "doc-b:p2:c1", "policy");
  }

  @Test void theBestExcerptIsKeptWholeEvenWhenItAloneExceedsTheBudget() {
    var kept = EvidenceContext.withinLocalBudget(List.of(excerpt("doc-a:p1:c1", 9_000), excerpt("doc-b:p1:c1", 100)), 5_000);
    assertThat(kept).extracting(CreditAssistantService.Source::id).containsExactly("doc-a:p1:c1");
    assertThat(kept.getFirst().text()).hasSize(9_000);
  }

  @Test void aSmallLowerRankedExcerptIsStillKeptWhenItFits() {
    var kept = EvidenceContext.withinLocalBudget(List.of(excerpt("doc-a:p1:c1", 4_500), excerpt("doc-b:p1:c1", 2_000), excerpt("doc-c:p1:c1", 400)), 5_000);
    assertThat(kept).extracting(CreditAssistantService.Source::id).containsExactly("doc-a:p1:c1", "doc-c:p1:c1");
  }
}
