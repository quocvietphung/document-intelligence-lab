package dev.creditlab.assistant;

import java.time.Instant;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class AiLimitHandler {
  @ExceptionHandler(AiUsageLimitException.class)
  public ResponseEntity<Map<String,Object>> limited(AiUsageLimitException error) {
    long seconds=Math.max(1,error.resetAt().getEpochSecond()-Instant.now().getEpochSecond());
    return ResponseEntity.status(429).header("Retry-After",String.valueOf(seconds)).header("Cache-Control","no-store")
      .body(Map.of("code",error.code(),"resetAt",error.resetAt().toString()));
  }
}
