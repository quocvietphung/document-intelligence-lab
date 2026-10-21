package dev.creditlab.platform;

import static org.assertj.core.api.Assertions.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class DocumentChunkingTest {
  @Test void fixedPreservesTheExistingOverlapAndNeverLosesTheTail(){
    String text="a".repeat(1000)+"TAIL";var parts=DocumentChunking.split(text,DocumentChunking.Strategy.FIXED,(a,b)->0);
    assertThat(parts).hasSize(2);assertThat(parts.getFirst().text()).hasSize(780);assertThat(parts.getLast().text()).endsWith("TAIL");
  }
  @Test void everyStrategyIsBoundedAndRetainsNumbersAndCurrencies(){
    for(var strategy:DocumentChunking.Strategy.values()){
      var parts=DocumentChunking.split("Invoice 51109301.\n\nINR 1,844,673.60.\n\n"+"Long paragraph ".repeat(250),strategy,(a,b)->.8);
      assertThat(parts).allSatisfy(p->assertThat(p.text().length()).isBetween(1,780));
      assertThat(parts.toString()).contains("51109301","1,844,673.60");
    }
  }
  @Test void semanticUsesEmbeddingSimilarityNotAParagraphAlias(){
    var calls=new AtomicInteger();var parts=DocumentChunking.split("Salary facts.\n\nCoverage exclusions.",DocumentChunking.Strategy.SEMANTIC,(a,b)->{calls.incrementAndGet();return .1;});
    assertThat(parts).hasSize(2);assertThat(calls.get()).isPositive();
  }
  @Test void hierarchicalChildrenCarryPageLocalParentIdentity(){
    var parts=DocumentChunking.split("a".repeat(1700),DocumentChunking.Strategy.HIERARCHICAL,(a,b)->1);
    assertThat(parts).allSatisfy(p->assertThat(p.parent()).isPositive());assertThat(parts).extracting(DocumentChunking.Part::parent).contains(1,2);
  }
}
