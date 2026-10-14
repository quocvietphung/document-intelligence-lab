package dev.creditlab.platform;

import dev.creditlab.casework.CreditCaseService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.Map;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@RestController
@org.springframework.context.annotation.Profile("research-fixtures")
@RequestMapping("/api/cases/{caseId}/platform/experiments")
@PreAuthorize("hasAnyRole('ADVISOR','REVIEWER','ADMIN')")
public class ResearchController {
  private final CreditCaseService cases;private final ResearchLab lab;private final DistributedLimits limits;
  public ResearchController(CreditCaseService cases,ResearchLab lab,DistributedLimits limits){this.cases=cases;this.lab=lab;this.limits=limits;}
  private String tenant(JwtAuthenticationToken auth){String tenant=auth.getToken().getClaimAsString("tenant_id");if(tenant==null||tenant.isBlank())throw new AccessDeniedException("Verified tenant required");return tenant;}
  public record Request(@NotNull ResearchLab.Suite suite){}
  @GetMapping public Map<String,Object> read(@PathVariable String caseId,JwtAuthenticationToken auth){return lab.catalog(cases.require(tenant(auth),caseId));}
  @PostMapping public Map<String,Object> run(@PathVariable String caseId,@Valid @RequestBody Request request,JwtAuthenticationToken auth){
    String tenant=tenant(auth);var item=cases.require(tenant,caseId);limits.reserve(tenant,auth.getToken().getSubject(),"research-experiment",6);
    return lab.run(item,auth.getToken().getSubject(),request.suite());
  }
}
