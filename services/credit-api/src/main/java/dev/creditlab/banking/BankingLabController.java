package dev.creditlab.banking;

import dev.creditlab.casework.CreditCaseService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.access.prepost.PreAuthorize;
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
  private String actor(Authentication auth) { return ((JwtAuthenticationToken)auth).getToken().getSubject(); }
  @GetMapping public BankingSnapshot read(@PathVariable String caseId,Authentication auth) { return service.snapshot(tenant(auth),caseId); }
  public record Draft(@NotBlank @Pattern(regexp="[-a-zA-Z0-9]{1,80}") String accountId,
      @NotBlank @Pattern(regexp="[-a-zA-Z0-9]{1,80}") String invoiceId,
      @NotBlank @Pattern(regexp="[a-fA-F0-9-]{36}") String requestId,@Min(0) long version,boolean sourceChecked) {}
  @PostMapping("/payments") @PreAuthorize("hasAnyRole('ADVISOR','ADMIN')")
  public BankingSnapshot draft(@PathVariable String caseId,@Valid @RequestBody Draft request,Authentication auth) {
    return service.draft(tenant(auth),caseId,actor(auth),request.accountId(),request.invoiceId(),request.requestId(),request.version(),request.sourceChecked());
  }
  public record Confirmation(@Min(0) long version,boolean confirmed) {}
  @PostMapping("/payments/{paymentId}/confirm") @PreAuthorize("hasAnyRole('REVIEWER','ADMIN')")
  public BankingSnapshot confirm(@PathVariable String caseId,@PathVariable String paymentId,@Valid @RequestBody Confirmation request,Authentication auth) {
    return service.confirm(tenant(auth),caseId,actor(auth),paymentId,request.version(),request.confirmed());
  }
}
