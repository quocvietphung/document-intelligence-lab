package dev.creditlab.trust;

import static org.assertj.core.api.Assertions.*;
import org.junit.jupiter.api.Test;

class DocumentTasksTest {
  @Test void allTenTasksHaveBoundedPromptsInEachDomainAndLanguage(){
    assertThat(TrustCatalog.TASKS).hasSize(10);
    for(String id:TrustCatalog.TASKS)for(String locale:java.util.List.of("en","de","vi"))for(String domain:java.util.List.of("banking","insurance","general")){
      assertThat(id).matches(TrustCatalog.TASK_PATTERN);
      assertThat(TrustCatalog.question(id,locale,domain)).isNotBlank().hasSizeLessThanOrEqualTo(2000);
    }
  }
  @Test void newTasksAreReviewDraftsWithDistinctBoundaries(){
    assertThat(TrustCatalog.question("timeline","en")).contains("verbatim date","source page","Do not invent");
    assertThat(TrustCatalog.question("obligations","en")).contains("not legal advice","missing or excerpted context");
    assertThat(TrustCatalog.question("privacy-review","en")).contains("Do not repeat sensitive values","or modify the PDF","human must inspect");
    assertThatThrownBy(()->TrustCatalog.question("automatic-redaction","en")).isInstanceOf(IllegalArgumentException.class);
  }
}
