package dev.creditlab.assistant;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/assistant")
public class CreditAssistantController {
  private final CreditAssistantService assistant;
  private final AssistantRuns runs;
  @Value("${app.security.enabled:true}") private boolean securityEnabled;
  public CreditAssistantController(CreditAssistantService assistant,AssistantRuns runs) { this.assistant=assistant;this.runs=runs; }

  @PostMapping("/chat")
  public CreditAssistantService.AssistantResponse chat(@Valid @RequestBody CreditAssistantService.AssistantRequest request,
      Authentication authentication,@RequestHeader(value="X-Nova-Request-Id",required=false) String requestId) {
    String tenant=tenant(authentication),actor=actor(authentication);
    return runs.execute(tenant,actor,request.caseId(),requestId,()->assistant.answer(tenant,actor,request));
  }
  private String tenant(Authentication authentication) {
    if(authentication instanceof JwtAuthenticationToken token) {
      String tenant=token.getToken().getClaimAsString("tenant_id");
      if(tenant==null||tenant.isBlank()) throw new AccessDeniedException("tenant_id claim is required");
      return tenant;
    }
    if(securityEnabled) throw new AccessDeniedException("Verified identity required");
    return "praxisbank-demo";
  }
  private String actor(Authentication authentication) {
    return authentication instanceof JwtAuthenticationToken token?token.getToken().getSubject():"local-demo";
  }
}
