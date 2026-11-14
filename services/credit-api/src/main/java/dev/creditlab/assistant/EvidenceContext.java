package dev.creditlab.assistant;

import java.util.*;

/**
 * Chooses which evidence excerpts reach the model. Each step can be switched off so its effect can be measured on
 * its own. Dedupe only removes text that another kept excerpt of the same document already contains; the relevance
 * cut drops weak hits across documents and is therefore off unless configured (scripts/benchmark-nova.mjs checks
 * that comparison questions keep their documents).
 */
final class EvidenceContext {
  private EvidenceContext(){}
  /** dedupe: drop an excerpt whose text repeats another excerpt of the same document, including a table excerpt whose
   *  every cell is already in a kept text excerpt of the same page.
   *  relativeScore: drop retrieval hits scoring below this share of the best hit (0 = off). */
  record Options(boolean dedupe,double relativeScore){
    static Options baseline(){return new Options(false,0);}
  }
  record Selection(List<CreditAssistantService.Source> sources,int duplicates,int belowRelevance){
    int removed(){return duplicates+belowRelevance;}
  }
  /** The case summary, policy and app guide are part of the answer contract and always stay. */
  private static final Set<String> FIXED=Set.of("case-summary","policy","app-guide");

  /** "doc-1:p2:r3" and "doc-1:p2" belong to "doc-1"; fixed sources are their own document. */
  static String documentOf(String id){int at=id.indexOf(":p");return at>0?id.substring(0,at):id;}

  /**
   * Local CPU model budget: the fixed sources always stay; document excerpts keep their ranking order and are cut
   * once the next one would exceed the character budget. The best-ranked excerpt is always kept, whole, so no text is
   * truncated and the citation validator sees only exact source texts.
   */
  static List<CreditAssistantService.Source> withinLocalBudget(List<CreditAssistantService.Source> ranked,int maxChars){
    var kept=new ArrayList<CreditAssistantService.Source>();
    int used=0;
    for(var source:ranked){
      if(FIXED.contains(source.id())){kept.add(source);continue;}
      int size=source.text().codePointCount(0,source.text().length());
      if(used>0&&used+size>maxChars)continue;
      kept.add(source);used+=size;
    }
    return List.copyOf(kept);
  }
  private static String normal(String text){return text.toLowerCase(Locale.ROOT).replaceAll("\\s+"," ").strip();}
  private static final java.util.regex.Pattern TABLE=java.util.regex.Pattern.compile("(.+):p(\\d+):t\\d+:c\\d+"),
      PAGE_TEXT=java.util.regex.Pattern.compile("(.+):p(\\d+)(?::parent\\d+)?(?::c\\d+)?");
  /** Cell values of a table excerpt ("r1 c2: value" lines, possibly cut at either end). */
  static List<String> cells(String table){
    var out=new ArrayList<String>();
    for(String line:table.split("\\n")){
      if(line.strip().matches("r\\d*(?:\\s+c?\\d*:?)?"))continue;
      String value=normal(line.replaceFirst("^\\s*r\\d+\\s+c\\d+:\\s*",""));
      if(!value.isEmpty())out.add(value);
    }
    return out;
  }
  /** A table excerpt is redundant when every cell already appears in kept text excerpts of the same page. */
  private static boolean tableInPageText(CreditAssistantService.Source table,List<CreditAssistantService.Source> kept){
    var match=TABLE.matcher(table.id());if(!match.matches())return false;
    String page=normal(kept.stream().filter(other->{var text=PAGE_TEXT.matcher(other.id());return text.matches()&&text.group(1).equals(match.group(1))&&text.group(2).equals(match.group(2));})
        .map(CreditAssistantService.Source::text).reduce("",(a,b)->a+"\n"+b));
    var values=cells(table.text());
    return !page.isEmpty()&&!values.isEmpty()&&values.stream().allMatch(page::contains);
  }

  /**
   * @param ordered sources in rank order, best first
   * @param scores retrieval scores by source id; sources without a score are never dropped for relevance
   * @param keep sources that must stay, such as an exact field selection
   */
  static Selection select(List<CreditAssistantService.Source> ordered,Map<String,Double> scores,Set<String> keep,Options options){
    var kept=new ArrayList<CreditAssistantService.Source>();int duplicates=0;
    for(var source:ordered){
      boolean pinned=FIXED.contains(source.id())||keep.contains(source.id());
      if(options.dedupe()&&!pinned&&!source.text().isBlank()){
        String document=documentOf(source.id()),text=normal(source.text());
        int contained=-1,containing=-1;
        for(int i=0;i<kept.size();i++){
          var other=kept.get(i);
          if(FIXED.contains(other.id())||keep.contains(other.id())||!documentOf(other.id()).equals(document))continue;
          String otherText=normal(other.text());
          if(otherText.contains(text)){contained=i;break;}
          if(text.contains(otherText)&&containing<0)containing=i;
        }
        if(contained>=0){duplicates++;continue;}
        // A wider excerpt of the same passage replaces the narrower one at its (better) rank.
        if(containing>=0){kept.set(containing,source);duplicates++;continue;}
      }
      kept.add(source);
    }
    if(options.dedupe()){
      var withoutTables=new ArrayList<CreditAssistantService.Source>();
      for(var source:kept){
        if(!FIXED.contains(source.id())&&!keep.contains(source.id())&&tableInPageText(source,kept)){duplicates++;continue;}
        withoutTables.add(source);
      }
      kept=withoutTables;
    }
    int belowRelevance=0;
    if(options.relativeScore()>0&&!scores.isEmpty()){
      double best=kept.stream().map(s->scores.get(s.id())).filter(Objects::nonNull).mapToDouble(Double::doubleValue).max().orElse(0);
      var relevant=new ArrayList<CreditAssistantService.Source>();
      for(var source:kept){
        Double score=scores.get(source.id());
        if(score!=null&&best>0&&score<options.relativeScore()*best&&!FIXED.contains(source.id())&&!keep.contains(source.id())){belowRelevance++;continue;}
        relevant.add(source);
      }
      kept=relevant;
    }
    return new Selection(List.copyOf(kept),duplicates,belowRelevance);
  }
}
