package dev.creditlab.assistant;

import java.util.*;
import java.util.regex.*;

/**
 * Canonicalizes redundant brackets around exact authorized IDs, never guesses or adds a source.
 * Every square-bracket text must be one authorized ID: a placeholder such as [Name], a page number or a note is refused,
 * not repaired, so the citation contract is the same for the chat UI and the lab command.
 */
final class SourceCitations {
  private SourceCitations(){}
  static String validate(String answer,List<CreditAssistantService.Source> sources){
    if(answer==null||answer.isBlank())throw invalid("EMPTY_ANSWER");
    var ids=new HashSet<String>();String result=answer;
    for(var source:sources){
      ids.add(source.id());
      result=result.replaceAll("\\[+\\s*"+Pattern.quote(source.id())+"\\s*\\]+",Matcher.quoteReplacement("["+source.id()+"]"));
      // The same exact authorized ID in round brackets is the same citation in another notation; any other text is refused.
      result=result.replaceAll("\\(\\s*"+Pattern.quote(source.id())+"\\s*\\)",Matcher.quoteReplacement("["+source.id()+"]"));
    }
    var matcher=Pattern.compile("\\[([^\\]\\n]{1,150})\\]").matcher(result);boolean cited=false;
    while(matcher.find()){
      if(!ids.contains(matcher.group(1)))throw invalid("NON_SOURCE_BRACKET");
      cited=true;
    }
    String remainder=matcher.reset().replaceAll("");
    if(!cited&&!ids.isEmpty())throw invalid("NO_CITATION");
    if(remainder.contains("[")||remainder.contains("]"))throw invalid("STRAY_BRACKET");
    return result;
  }
  private static ModelContractException invalid(String reason){
    return new ModelContractException("MODEL_CITATION_CONTRACT_FAILED",reason,"no source was guessed or substituted");
  }
}
