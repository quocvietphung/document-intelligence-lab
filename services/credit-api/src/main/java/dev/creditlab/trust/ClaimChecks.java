package dev.creditlab.trust;

import dev.creditlab.platform.NumericEvidence;
import java.util.*;
import java.util.regex.Pattern;

/** Per-citation numeric/currency membership only. Not proof of identity, period or semantic correctness. */
public final class ClaimChecks {
  private ClaimChecks() {}
  private static final String UNIT="(?:EUR|USD|GBP|INR|CHF|VND|€|\\$|£|₹|₫)";
  private static final String NUMBER="-?\\d+(?:[.,]\\d+)*";
  private static final Pattern MONEY=Pattern.compile("(?<![\\p{L}\\d.,])(?:("+NUMBER+")\\s*("+UNIT+")|("+UNIT+")\\s*("+NUMBER+"))(?![\\p{L}\\d])",Pattern.CASE_INSENSITIVE);
  private static Set<String> money(String text) {
    var out=new LinkedHashSet<String>();var m=MONEY.matcher(text);
    while(m.find()) {
      String amount=m.group(1)==null?m.group(4):m.group(1),unit=(m.group(2)==null?m.group(3):m.group(2)).toUpperCase(Locale.ROOT);
      String currency=switch(unit){case "€"->"EUR";case "£"->"GBP";case "₹"->"INR";case "₫"->"VND";case "$"->"$-UNSPECIFIED";default->unit;};
      NumericEvidence.normalize(amount).ifPresent(n->out.add(currency+":"+n));
    }
    return out;
  }
  public static List<String> unsupportedMoney(String claim,Collection<String> citedText) {
    var supported=new HashSet<String>();citedText.forEach(s->supported.addAll(money(s)));
    return money(claim).stream().filter(m->!supported.contains(m)).toList();
  }
}
