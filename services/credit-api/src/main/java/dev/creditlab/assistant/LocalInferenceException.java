package dev.creditlab.assistant;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Only these fixed codes cross the public API. Never expose provider messages or prompts. */
final class LocalInferenceException extends ResponseStatusException {
  private final String code;
  LocalInferenceException(String code){
    super(code.equals("LOCAL_MODEL_BUSY")?HttpStatus.TOO_MANY_REQUESTS:HttpStatus.GATEWAY_TIMEOUT,code);
    if(!java.util.Set.of("LOCAL_MODEL_BUSY","LOCAL_MODEL_TIMEOUT").contains(code))throw new IllegalArgumentException("Unknown local inference failure");
    this.code=code;
  }
  String code(){return code;}
}
