package dev.creditlab.platform;

import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;

/** BM25 over token counts; identifiers and literal numeric strings remain searchable. */
final class LexicalSearch {
  private static final Pattern TOKEN=Pattern.compile("[\\p{L}][\\p{L}\\p{N}_-]*|[-+]?\\d+(?:[.,]\\d+)*(?:%)?");
  private static final Set<String> STOP=Set.of("the","and","with","this","that","what","which","how","der","die","das","und","ein","eine","dem","den","ist","von","mit","fur","was","welche","la","va","cua","trong","cho","bao","nhieu");
  // Small, explicit lexical glossary, not a translation model. Ambiguous terms
  // such as German "Überweisung" (transfer/referral) are deliberately absent.
  private static final Map<String,List<String>> CONCEPTS=Map.of(
      "net_income",List.of("net income","net earnings","netto-verdienst","nettoverdienst","nettoeinkommen","luong rong","thu nhap rong"),
      "payout",List.of("payout","auszahlungsbetrag","thuc chi"),
      "invoice",List.of("invoice","rechnung","hoa don"),
      "deductible",List.of("deductible","selbstbehalt","khau tru"),
      "specialist",List.of("specialist","facharzt","chuyen khoa"),
      "hours",List.of("hours","arbeitszeit","gio lam"),
      "wind",List.of("wind","sturm","gio"));
  private static final Map<String,Pattern> ALIASES=CONCEPTS.entrySet().stream().collect(java.util.stream.Collectors.toUnmodifiableMap(Map.Entry::getKey,e->Pattern.compile("(?<![\\p{L}\\p{N}])(?:"+e.getValue().stream().map(Pattern::quote).collect(java.util.stream.Collectors.joining("|"))+")(?![\\p{L}\\p{N}])")));
  static List<String> tokens(String text){
    String normalized=Normalizer.normalize(text.toLowerCase(Locale.ROOT).replace("ß","ss"),Normalizer.Form.NFD).replaceAll("\\p{M}","");
    var result=new ArrayList<String>();var matcher=TOKEN.matcher(normalized);
    while(matcher.find()){var word=matcher.group();if(!STOP.contains(word)){result.add(word);if(word.contains("-")||word.contains("_"))for(var part:word.split("[-_]"))if(part.length()>1&&!STOP.contains(part))result.add(part);}}
    ALIASES.forEach((concept,pattern)->{if(pattern.matcher(normalized).find())result.add("concept_"+concept);});return result;
  }
  private final Map<String,Map<String,Integer>> counts=new HashMap<>();
  private final Map<String,Integer> frequency=new HashMap<>();
  private final Map<String,Integer> lengths=new HashMap<>();
  private final double average;
  LexicalSearch(List<RagEngine.Chunk> chunks){
    for(var chunk:chunks){var terms=tokens(chunk.title()+"\n"+chunk.text());var bag=new HashMap<String,Integer>();terms.forEach(t->bag.merge(t,1,Integer::sum));counts.put(chunk.id(),bag);lengths.put(chunk.id(),terms.size());bag.keySet().forEach(t->frequency.merge(t,1,Integer::sum));}
    average=lengths.values().stream().mapToInt(Integer::intValue).average().orElse(1);
  }
  double score(String question,String id){
    var bag=counts.get(id);double score=0;
    for(var term:new HashSet<>(tokens(question))){int tf=bag.getOrDefault(term,0);if(tf==0)continue;double df=frequency.get(term),idf=Math.log(1+(counts.size()-df+.5)/(df+.5));score+=idf*(tf*2.2)/(tf+1.2*(.25+.75*lengths.get(id)/Math.max(1,average)));}return score;
  }
  double coverage(String question,String id){var terms=new HashSet<>(tokens(question));return terms.isEmpty()?0:(double)terms.stream().filter(counts.get(id)::containsKey).count()/terms.size();}
  static Map<String,Double> reciprocalRanks(List<RagEngine.Hit> hits){
    var result=new HashMap<String,Double>();
    for(boolean lexical:List.of(true,false)){
      var ranked=hits.stream().filter(h->(lexical?h.lexical():h.vector())>0).sorted(Comparator.comparingDouble((RagEngine.Hit h)->lexical?h.lexical():h.vector()).reversed().thenComparing(RagEngine.Hit::id)).limit(24).toList();
      for(int i=0;i<ranked.size();i++)result.merge(ranked.get(i).id(),1.0/(60+i+1),Double::sum);
    }return result;
  }
}
