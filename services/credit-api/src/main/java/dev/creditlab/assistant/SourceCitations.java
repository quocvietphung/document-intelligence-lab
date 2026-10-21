package dev.creditlab.assistant;

import java.util.*;
import java.util.regex.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Canonicalizes redundant brackets around exact authorized IDs, never guesses or adds a source. */
final class SourceCitations {
  private SourceCitations(){}
  static String validate(String answer,List<CreditAssistantService.Source> sources){
    if(answer==null||answer.isBlank())throw invalid();
    var ids=new HashSet<String>();String result=answer;
    for(var source:sources){
      ids.add(source.id());
      result=result.replaceAll("\\[+\\s*"+Pattern.quote(source.id())+"\\s*\\]+",Matcher.quoteReplacement("["+source.id()+"]"));
    }
    var matcher=Pattern.compile("\\[([^\\]\\n]{1,150})\\]").matcher(result);boolean cited=false;
    while(matcher.find()){
      if(!ids.contains(matcher.group(1)))throw invalid();
      cited=true;
    }
    String remainder=matcher.reset().replaceAll("");
    if(!cited&&!ids.isEmpty()||remainder.contains("[")||remainder.contains("]"))throw invalid();
    return result;
  }
  private static ResponseStatusException invalid(){return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"MODEL_CITATION_CONTRACT_FAILED; no source was guessed or substituted");}
}
