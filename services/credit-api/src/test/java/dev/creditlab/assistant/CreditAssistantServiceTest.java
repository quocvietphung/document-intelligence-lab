package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.assertThat;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.CreditCaseService;
import org.junit.jupiter.api.Test;
import java.util.Optional;

class CreditAssistantServiceTest {
  @Test void bankingQuestionUsesReadOnlySyntheticSources() {
    var cases=new CreditCaseService();var mapper=new ObjectMapper();
    var bank=new dev.creditlab.banking.BankingLabService(cases,mapper,Optional.empty());
    var service=new CreditAssistantService(cases,mapper,Optional.empty(),bank);
    var response=service.answer("praxisbank-demo","tester",new CreditAssistantService.AssistantRequest("CR-2026-1048","en","Summarize accounts, transactions and invoices"));
    assertThat(response.answer()).contains("Synthetic banking","cannot execute or confirm payments");
    assertThat(response.sources()).extracting(CreditAssistantService.Source::id).contains("bank-accounts","bank-transactions","bank-invoices");
  }
  @Test void localFallbackIsTenantScopedAndRefusesCreditDecision() {
    var service=new CreditAssistantService(new CreditCaseService(),new ObjectMapper(),Optional.empty());
    var response=service.answer("praxisbank-demo","tester",
        new CreditAssistantService.AssistantRequest("CR-2026-1048","de","Welche Unterlagen fehlen?"));
    assertThat(response.mode()).isEqualTo("synthetic-demo");
    assertThat(response.answer()).contains("Praxisbewertung").contains("keine Kreditentscheidung");
    assertThat(response.sources()).extracting(CreditAssistantService.Source::id).contains("case-summary","policy");
    assertThat(response.answer()).contains("[case-summary]", "[policy]").doesNotContain("[case-summary, policy]");
  }
}
