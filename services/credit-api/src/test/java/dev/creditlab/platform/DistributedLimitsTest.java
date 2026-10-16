package dev.creditlab.platform;

import dev.creditlab.assistant.AiUsageLimitException;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DistributedLimitsTest {
  @Test void rejectedReservationRemainsARateLimitRatherThanServiceUnavailable() {
    var redis=mock(StringRedisTemplate.class);
    doReturn(0L).when(redis).execute(any(),anyList(),any(Object[].class));
    var limits=new DistributedLimits(redis,true);
    assertThatThrownBy(()->limits.reserve("tenant","actor","experiment",6)).isInstanceOf(AiUsageLimitException.class);
  }
  @Test void redisFailureIsReportedAsServiceUnavailableWithoutLeakingItsDetails() {
    var redis=mock(StringRedisTemplate.class);
    doThrow(new IllegalStateException("private connection details")).when(redis).execute(any(),anyList(),any(Object[].class));
    var limits=new DistributedLimits(redis,true);
    assertThatThrownBy(()->limits.reserve("tenant","actor","experiment",6))
        .isInstanceOf(ResponseStatusException.class).satisfies(error->{
          var response=(ResponseStatusException)error;
          assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
          assertThat(response.getReason()).doesNotContain("private connection details");
        });
  }
}
