package dev.creditlab.casework;

import java.util.*;
import java.util.regex.Pattern;

/** Conservative supplemental layout rules, NOT a trained payroll model.
 * Match only net income and payout, keep them distinct, abstain on ambiguity.
 * Coordinates are normalized page fractions; no font/position depends on DATEV.
 */
final class PayrollLayoutFields {
  record Line(String text,double left,double top,double right,double bottom) {
    boolean valid() {return text!=null&&Double.isFinite(left)&&Double.isFinite(top)&&
      Double.isFinite(right)&&Double.isFinite(bottom)&&left>=0&&top>=0&&right<=1&&bottom<=1&&left<right&&top<bottom;}
  }
  private record Candidate(Line line,double distance) {}
  private static final Pattern MONEY=Pattern.compile("(?i)^(?:EUR\\s*)?(?:\\d{1,3}(?:\\.\\d{3})+|\\d+),\\d{2}(?:\\s*(?:EUR|€))?$");
  static List<CreditCase.Field> extract(int page,List<Line> input) {
    var lines=input.stream().filter(Line::valid).toList();
    var fields=new LinkedHashMap<String,CreditCase.Field>();
    var conflicts=new HashSet<String>();
    for(var label:lines) {
      var canonical=DocumentExtractor.canonicalFieldLabel(label.text());
      if(canonical.isEmpty()||!Set.of("netIncome","payoutAmount").contains(canonical.get())) continue;
      var candidates=new ArrayList<Candidate>();
      for(var value:lines) {
        if(!MONEY.matcher(value.text().strip()).matches()) continue;
        double vertical=value.top()-label.bottom();
        double overlap=Math.min(label.right(),value.right())-Math.max(label.left(),value.left());
        boolean below=vertical>=-0.001&&vertical<=0.03&&overlap>0&&
          Math.abs((label.left()+label.right()-value.left()-value.right())/2)<0.06;
        boolean beside=Math.abs((label.top()+label.bottom()-value.top()-value.bottom())/2)<0.006&&
          value.left()>=label.right()-0.005&&value.left()-label.right()<0.15;
        if(below||beside) candidates.add(new Candidate(value,below?Math.max(0,vertical):value.left()-label.right()));
      }
      candidates.sort(Comparator.comparingDouble(Candidate::distance));
      if(candidates.isEmpty()||(candidates.size()>1&&candidates.get(1).distance()-candidates.get(0).distance()<0.003)) continue;
      var chosen=candidates.getFirst().line();
      var field=new CreditCase.Field(canonical.get(),chosen.text().strip(),null,page,label.text().strip()+": "+chosen.text().strip());
      var old=fields.putIfAbsent(field.label(),field);
      if(old!=null&&!old.value().equals(field.value())) conflicts.add(field.label());
    }
    conflicts.forEach(fields::remove);
    return List.copyOf(fields.values());
  }
}
