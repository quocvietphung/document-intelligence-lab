package dev.creditlab.assistant;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
class LocalInferenceHandler {
  @ExceptionHandler(LocalInferenceException.class)
  ResponseEntity<Map<String,String>> handle(LocalInferenceException error){
    var response=ResponseEntity.status(error.getStatusCode()).header("Cache-Control","no-store");
    if(error.code().equals("LOCAL_MODEL_BUSY"))response.header("Retry-After","5");
    return response.body(Map.of("code",error.code()));
  }
}
