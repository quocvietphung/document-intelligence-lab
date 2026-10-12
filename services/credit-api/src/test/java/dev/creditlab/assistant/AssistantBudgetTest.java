package dev.creditlab.assistant;
import static org.assertj.core.api.Assertions.*;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class AssistantBudgetTest {
  @Test void accentsAndEmojiAreNotChargedAsUtf8Bytes(){assertThat(AssistantBudget.reserve("á😀",List.of(new CreditAssistantService.Source("x","x","ệ")))).isEqualTo(1003);}
  @Test void oversizedEvidenceCannotBeSilentlyUndercharged(){assertThatThrownBy(()->AssistantBudget.reserve("x".repeat(30_001),List.of())).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);}
  @Test void resetTimesUseUtcNotTheMachineTimezone(){var now=Instant.parse("2026-10-12T23:59:20Z");assertThat(new AiUsageLimitException("AI_MINUTE_LIMIT",now,false).resetAt()).isEqualTo(Instant.parse("2026-10-13T00:00:00Z"));assertThat(new AiUsageLimitException("AI_DAILY_ACCOUNT_LIMIT",now,true).resetAt()).isEqualTo(Instant.parse("2026-10-13T00:00:00Z"));}
  @Test void zeroOrUnboundedBudgetsFailClosed(){assertThatThrownBy(()->new AiQuotaPolicy(0,60,0,0)).isInstanceOf(IllegalArgumentException.class);assertThatThrownBy(()->new AiQuotaPolicy(12,60,150_000,100_000)).isInstanceOf(IllegalArgumentException.class);}
  @Test void handlerExposesOnlyCodeAndReset(){var response=new AiLimitHandler().limited(new AiUsageLimitException("AI_DAILY_ACCOUNT_LIMIT",Instant.now(),true));assertThat(response.getStatusCode().value()).isEqualTo(429);assertThat(response.getBody()).containsOnlyKeys("code","resetAt");assertThat(response.getHeaders().getFirst("Retry-After")).isNotBlank();}
}
