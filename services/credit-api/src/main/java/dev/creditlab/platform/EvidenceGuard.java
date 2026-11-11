package dev.creditlab.platform;

import java.util.*;
import java.util.regex.Pattern;

public final class EvidenceGuard {
  private EvidenceGuard() {}
  private static final Pattern INJECTION=Pattern.compile("(?is)(ignore (all |previous |prior )?instructions|disregard.*instructions|system\\s*prompt|reveal.*(token|password|secret)|<\\|?(system|assistant)\\|?>|bypass.*(policy|guard)|ignoriere.*anweisung|bỏ qua.*hướng dẫn)");
  public static boolean suspicious(String text) {
    String normalized=java.text.Normalizer.normalize(Objects.requireNonNullElse(text,""),java.text.Normalizer.Form.NFKC)
        .replaceAll("\\p{Cf}","").replaceAll("\\s+"," ");
    return INJECTION.matcher(normalized).find()||Pattern.compile("(?is)(<\\s*/?\\s*(system|assistant|developer)\\s*>|\\[inst\\]|\\[/?system\\]|send.{0,80}(api.?key|access.?token|password|secret).{0,80}https?://|tiết lộ.{0,30}(mật khẩu|token)|verrate.{0,30}(passwort|geheimnis))").matcher(normalized).find();
  }
  // Text that asks an assistant to approve, release payment or send mail. Unlike suspicious(), such a sentence
  // does not quarantine the upload: it is reported with its page and kept out of model context.
  private static final Pattern AUTOMATED_APPROVAL=Pattern.compile("(?iu)(?:\\bautomatisch\\w*\\b.{0,40}\\b(?:freigeben|genehmigen|bezahlen|überweisen|anweisen)"
      +"|\\b(?:ki|ai|assistent\\w*|assistant|llm|copilot|nova|chatbot|(?:ki|ai)[- ]agent\\w*|sprachmodell|language model)\\b.{0,120}\\b(?:freigeben|genehmigen|approve|release (?:the )?payment|mark (?:it|this|the invoice) as (?:approved|reviewed|verified)|send .{0,30}(?:e-?mail|confirmation)|e-?mail .{0,60}senden)"
      +"|\\bauto(?:matically)?[- ]approve|\\bapprove\\b.{0,40}\\b(?:automatically|without (?:human )?review)"
      +"|(?:tự động|hãy|vui lòng)\\s.{0,40}(?:phê duyệt|duyệt thanh toán|duyệt hóa đơn|chuyển khoản|gửi email)"
      +"|(?:\\bai\\b|trợ lý).{0,80}(?:phê duyệt|duyệt|chuyển khoản|gửi email))");
  /** Lines of document text that instruct an assistant to approve, pay or send. Each result is a quoted line (max 300 chars). */
  public static List<String> approvalInstructions(String text) {
    var found=new ArrayList<String>();
    for(String line:Objects.requireNonNullElse(text,"").split("\\R")) {
      String normalized=java.text.Normalizer.normalize(line,java.text.Normalizer.Form.NFKC).replaceAll("\\p{Cf}","").replaceAll("\\s+"," ").strip();
      if(!normalized.isEmpty()&&AUTOMATED_APPROVAL.matcher(normalized).find())found.add(normalized.length()>300?normalized.substring(0,300):normalized);
    }
    return List.copyOf(found);
  }
  /** Untrusted for model context: classic injection or an embedded approval/payment instruction. */
  public static boolean untrustedForModel(String text) { return suspicious(text)||!approvalInstructions(text).isEmpty(); }
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
