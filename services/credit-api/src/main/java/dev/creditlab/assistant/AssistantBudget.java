package dev.creditlab.assistant;

import java.util.List;

final class AssistantBudget {
  private AssistantBudget(){}
  static int reserve(String question,List<CreditAssistantService.Source> sources) {
    // Count Unicode characters, not UTF-8 bytes: Vietnamese accents must not cost 3x.
    // Deliberately remains a conservative reservation, NOT a provider token meter.
    long units=question.codePointCount(0,question.length())+1000L;
    for(var source:sources)units+=source.text().codePointCount(0,source.text().length());
    if(units>30_000)throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"Evidence context too large; ask a narrower question");
    return (int)units;
  }
}
