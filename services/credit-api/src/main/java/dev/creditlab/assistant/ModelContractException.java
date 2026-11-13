package dev.creditlab.assistant;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * A model answer that broke an output contract. It keeps HTTP 422 and carries a stable code and reason, so the caller
 * can explain the refusal. The answer text, quoted source text and any guessed identifier never leave the server.
 */
final class ModelContractException extends ResponseStatusException {
  private final String code;
  private final String reason;

  ModelContractException(String code, String reason, String detail) {
    super(HttpStatus.UNPROCESSABLE_ENTITY, code + "; reason=" + reason + "; " + detail);
    this.code = code;
    this.reason = reason;
  }

  String code() {
    return code;
  }

  String reason() {
    return reason;
  }
}
