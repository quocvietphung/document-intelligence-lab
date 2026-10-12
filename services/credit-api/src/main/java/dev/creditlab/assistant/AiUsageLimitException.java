package dev.creditlab.assistant;

import java.time.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public class AiUsageLimitException extends ResponseStatusException {
  private final String code;private final Instant resetAt;
  public AiUsageLimitException(String code,Instant now,boolean daily) {
    super(HttpStatus.TOO_MANY_REQUESTS,code);this.code=code;
    resetAt=daily?now.atZone(ZoneOffset.UTC).toLocalDate().plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant()
      :Instant.ofEpochSecond((now.getEpochSecond()/60+1)*60);
  }
  public String code(){return code;}
  public Instant resetAt(){return resetAt;}
}
