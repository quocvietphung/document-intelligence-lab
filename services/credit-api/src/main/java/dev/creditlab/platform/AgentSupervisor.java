package dev.creditlab.platform;

import java.util.*;
import org.springframework.stereotype.Service;

/** Routes one LLM invocation to a bounded specialist. This is a supervised pipeline, not autonomous agents. */
@Service
public class AgentSupervisor {
  public record Step(String agent,String task,List<String> tools,String state) {}
  public record Plan(String specialist,List<Step> steps,boolean blocked,String reason) {}
  public Plan route(String question) {
    String q=question.toLowerCase(Locale.ROOT);
    if(EvidenceGuard.suspicious(q)) return new Plan("Supervisor",List.of(new Step("Supervisor","Request policy check",List.of(),"BLOCKED")),true,"Instruction override or secret request");
    String specialist=q.matches("(?s).*(risk|fraud|rủi ro|betrug|risiko).*" )?"Risk":
      q.matches("(?s).*(compliance|policy|datenschutz|retention|tuân thủ|richtlinie).*" )?"Compliance":
      q.matches("(?s).*(document|salary|payroll|pdf|gehalt|beleg|dokument|netto|tài liệu|lương|versicherung|police|policy number|premium|deductible|claim|bảo hiểm).*" )?"Document":
      q.matches("(?s).*(account|transaction|invoice|konto|umsatz|rechnung|giao dịch|tài khoản).*" )?"Banking":"Explanation";
    List<String> tools=switch(specialist) {
      case "Banking"->List.of("caseSummary","documentEvidence","retrievedEvidence");
      case "Document"->List.of("caseSummary","documentEvidence","retrievedEvidence");
      case "Risk","Compliance"->List.of("caseSummary","retrievedEvidence");
      default->List.of("caseSummary","retrievedEvidence");
    };
    tools=new ArrayList<>(tools);tools.addAll(List.of("appFeatures","appFeature"));
    return new Plan(specialist,List.of(new Step("Supervisor","Classify intent and enforce tenant scope",List.of(),"COMPLETE"),
      new Step(specialist,"Read evidence and explain findings",tools,"READY"),
      new Step("Evidence verifier","Check source IDs and lexical support",List.of("verifyCitations"),"READY")),false,"");
  }
}
