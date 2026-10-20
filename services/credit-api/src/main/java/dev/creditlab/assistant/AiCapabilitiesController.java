package dev.creditlab.assistant;

import dev.creditlab.casework.DocumentAnalysisService;
import dev.creditlab.platform.RagEngine;
import dev.langchain4j.model.chat.ChatModel;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Configuration metadata only. No credentials, endpoints, case data or inference/probing. */
@RestController
@PreAuthorize("hasAnyRole('ADVISOR','REVIEWER','ADMIN')")
public class AiCapabilitiesController {
  private final Optional<ChatModel> chat;
  private final DocumentAnalysisService documents;
  private final RagEngine retrieval;
  private final String deployment;
  @Value("${app.ai.provider:azure}") private String provider="azure";
  @Value("${app.ai.local-model:}") private String localModel="";
  public AiCapabilitiesController(Optional<ChatModel> chat,DocumentAnalysisService documents,RagEngine retrieval,
      @Value("${app.ai.deployment:}") String deployment) {
    this.chat=chat;this.documents=documents;this.retrieval=retrieval;this.deployment=deployment;
  }
  @GetMapping("/api/cases/ai-capabilities")
  public ResponseEntity<Map<String,Object>> read(Authentication authentication) {
    if(!(authentication instanceof JwtAuthenticationToken token)||token.getToken().getClaimAsString("tenant_id")==null
        ||token.getToken().getClaimAsString("tenant_id").isBlank()) throw new AccessDeniedException("Verified tenant required");
    var doc=documents.status();
    boolean configured=chat.isPresent();
    String selected=provider.equals("ollama")?localModel:deployment;
    String publicDeployment=selected.matches("[a-zA-Z0-9_.:/-]{1,100}")&&!selected.contains("://")?selected:"not-reported";
    return ResponseEntity.ok().header("Cache-Control","no-store").body(Map.of(
        "scope","configuration-only", "automaticInference",false,
        "chat",Map.of("provider",configured?(provider.equals("ollama")?"ollama":"azure-openai"):"unavailable","modelId",configured?publicDeployment:"not-configured","configured",configured),
        "documents",Map.of("provider",doc.get("activeProvider"),"modelId",doc.get("modelId"),"mode",doc.get("mode"),"configured",!"unavailable".equals(doc.get("activeProvider"))),
        "retrieval",retrieval.configuration()));
  }
}
