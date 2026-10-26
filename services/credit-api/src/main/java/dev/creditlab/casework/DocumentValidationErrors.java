package dev.creditlab.casework;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

/** Validation errors must not echo or log rejected OCR text, amounts or reviewer notes. */
@RestControllerAdvice(assignableTypes=CreditCaseController.class)
public class DocumentValidationErrors {
  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String,String>> invalid(MethodArgumentNotValidException ignored){
    return ResponseEntity.badRequest().body(Map.of("error","Invalid document request"));
  }
}
