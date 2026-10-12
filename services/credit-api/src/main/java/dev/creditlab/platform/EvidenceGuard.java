package dev.creditlab.platform;

import java.util.*;
import java.util.regex.Pattern;

public final class EvidenceGuard {
  private EvidenceGuard() {}
  private static final Pattern INJECTION=Pattern.compile("(?is)(ignore (all |previous |prior )?instructions|disregard.*instructions|system\\s*prompt|reveal.*(token|password|secret)|<\\|?(system|assistant)\\|?>|bypass.*(policy|guard)|ignoriere.*anweisung|bỏ qua.*hướng dẫn)");
  public static boolean suspicious(String text) { return INJECTION.matcher(text).find(); }
  public static Set<String> terms(String text) {
    var result=new LinkedHashSet<String>(); var m=Pattern.compile("[\\p{L}\\p{N}]{3,}").matcher(text.toLowerCase(Locale.ROOT));
    while(m.find()) result.add(m.group());
    result.removeAll(Set.of("the","and","with","this","that","der","die","das","und","ein","eine","dem","den","ist","von","mit","für","what","which","how"));
    return result;
  }
  public static Map<String,Object> verify(String answer,List<RagEngine.Hit> sources) {
    var ids=new HashSet<String>(); sources.forEach(s->ids.add(s.id()));
    var cited=new LinkedHashSet<String>(); var m=Pattern.compile("\\[([^\\]\\n]{1,150})\\]").matcher(answer);
    while(m.find()) cited.add(m.group(1));
    var invalid=cited.stream().filter(id->!ids.contains(id)).toList();
    Set<String> evidence=terms(sources.stream().map(RagEngine.Hit::text).reduce("",(a,b)->a+" "+b));
    Set<String> words=terms(answer); long matched=words.stream().filter(evidence::contains).count();
    double support=words.isEmpty()?0:Math.round(1000.0*matched/words.size())/10.0;
    return Map.of("validCitations",cited.stream().filter(ids::contains).toList(),"invalidCitations",invalid,
      "lexicalSupport",support,"requiresReview",cited.isEmpty()||!invalid.isEmpty()||support<45,
      "method","source-id verification + lexical overlap; not calibrated factual accuracy");
  }
}
