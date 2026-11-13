package dev.creditlab.assistant;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Public body for a refused model answer: the stable code and reason only, never the answer or the evidence. */
@RestControllerAdvice
class ModelContractHandler {
  @ExceptionHandler(ModelContractException.class)
  ResponseEntity<Map<String, String>> handle(ModelContractException error) {
    return ResponseEntity.status(422).header("Cache-Control", "no-store")
        .body(Map.of("code", error.code(), "reason", error.reason()));
  }
}
