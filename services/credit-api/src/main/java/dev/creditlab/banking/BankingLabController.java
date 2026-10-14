package dev.creditlab.banking;

import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cases/{caseId}/banking")
public class BankingLabController {
  private final BankingLabService service;
  public BankingLabController(BankingLabService service) { this.service=service; }
  private String tenant(Authentication auth) {
    if(auth instanceof JwtAuthenticationToken token) {
      String tenant=token.getToken().getClaimAsString("tenant_id");
      if(tenant!=null&&!tenant.isBlank()) return tenant;
    }
    throw new AccessDeniedException("Verified tenant required");
  }
  @GetMapping public BankingSnapshot read(@PathVariable String caseId,Authentication auth) { return service.snapshot(tenant(auth),caseId); }
}
