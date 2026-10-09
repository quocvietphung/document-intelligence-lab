package dev.creditlab.casework;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cases")
public class CreditCaseController {
  private final CreditCaseService service;
  public CreditCaseController(CreditCaseService service) { this.service = service; }

  @GetMapping
  public List<CreditCase> list(Authentication authentication, @RequestHeader(value = "X-Demo-Tenant", required = false) String demoTenant) {
    return service.findAll(resolveTenant(authentication, demoTenant));
  }

  @GetMapping("/{id}")
  public ResponseEntity<CreditCase> get(@PathVariable String id, Authentication authentication, @RequestHeader(value = "X-Demo-Tenant", required = false) String demoTenant) {
    return service.findById(resolveTenant(authentication, demoTenant), id)
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  private String resolveTenant(Authentication authentication, String demoTenant) {
    if (authentication instanceof JwtAuthenticationToken token) {
      String tenant = token.getToken().getClaimAsString("tenant_id");
      if (tenant == null || tenant.isBlank()) throw new IllegalArgumentException("tenant_id claim is required");
      return tenant;
    }
    return demoTenant == null || demoTenant.isBlank() ? "praxisbank-demo" : demoTenant;
  }
}
