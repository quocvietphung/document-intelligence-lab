package dev.creditlab.platform;

import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class RetrievalEvaluationTest {
  private RagEngine.Hit hit(String id,String doc,int page){return new RagEngine.Hit(id,doc,doc,page,"page","evidence",.8,2,.8,false);}
  @Test void duplicateChunksDoNotInflateMultiPageRecallOrRanking(){
    var labels=List.<Map<String,Object>>of(Map.of("question","both pages","relevant",List.of(Map.of("documentId","d","page",1),Map.of("documentId","d","page",2)),"split","holdout"));
    var value=RetrievalEvaluation.evaluate(labels,q->new RagEngine.Search(List.of(hit("a","d",1),hit("b","d",1),hit("c","d",2)),3,"local","none","none",List.of()));
    @SuppressWarnings("unchecked")var metrics=(Map<String,Object>)value.get("metrics");
    assertThat(metrics).containsEntry("recallAt5",100.0).containsEntry("uniquePrecisionAt5",66.67).containsEntry("ndcgAt5",91.97).containsEntry("mrrAt5",100.0);
  }
  @Test void unanswerableLabelsAreRetainedWithoutInventingAModelRefusalScore(){
    var labels=List.<Map<String,Object>>of(Map.of("question","unknown answer","answerable",false,"relevant",List.of(),"split","holdout"));
    var value=RetrievalEvaluation.evaluate(labels,q->new RagEngine.Search(List.of(hit("a","d",1)),1,"local","none","none",List.of()));
    @SuppressWarnings("unchecked")var metrics=(Map<String,Object>)value.get("metrics");assertThat(metrics).containsEntry("answerableSamples",0).containsEntry("unanswerableQuestions",1).containsEntry("hitRateAt5",null).containsEntry("mrrAt5",null);
  }
  @Test void missingPagesRemainFailuresAndGroupsAreScoredSeparately(){
    var labels=List.<Map<String,Object>>of(Map.of("question","first","documentId","d","page",1,"split","tune"),Map.of("question","missing","documentId","absent","page",1,"split","holdout"));
    var value=RetrievalEvaluation.evaluate(labels,q->new RagEngine.Search(List.of(hit("a","d",1)),1,"local","none","none",List.of()));
    @SuppressWarnings("unchecked")var metrics=(Map<String,Object>)value.get("metrics");assertThat(metrics).containsEntry("hitRateAt5",50.0).containsEntry("recallAt5",50.0);
    assertThat((List<?>)value.get("groups")).hasSize(2);
  }
  @Test void lexicalSearchRetainsNumbersIdentifiersAccentsAndTermFrequency(){
    assertThat(LexicalSearch.tokens("Phí 2.967,11 EUR invoice-51109302 Netto-Verdienst")).contains("phi","2.967,11","invoice-51109302","netto-verdienst");
    var index=new LexicalSearch(List.of(new RagEngine.Chunk("a","a","",1,"page","fee fee fee credit"),new RagEngine.Chunk("b","b","",1,"page","fee credit credit credit")));
    assertThat(index.score("fee","a")).isGreaterThan(index.score("fee","b"));
  }
  @Test void rrfUsesRanksAndDoesNotPromoteZeroScoreLexicalCandidates(){
    var a=new RagEngine.Hit("a","a","",1,"page","",.9,0,0,false);var b=new RagEngine.Hit("b","b","",1,"page","",.8,3,0,false);
    var values=LexicalSearch.reciprocalRanks(List.of(a,b));assertThat(values.get("b")).isGreaterThan(values.get("a"));
  }
}
