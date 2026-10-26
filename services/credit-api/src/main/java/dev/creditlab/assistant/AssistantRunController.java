package dev.creditlab.assistant;
import static dev.creditlab.security.JwtIdentity.*;
import dev.creditlab.casework.CreditCaseService;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cases/{caseId}/platform/nova-runs/{requestId}")
@PreAuthorize("hasAnyRole('ADVISOR','REVIEWER','ADMIN')")
public class AssistantRunController {
  private final AssistantRuns runs;private final CreditCaseService cases;
  public AssistantRunController(AssistantRuns runs,CreditCaseService cases){this.runs=runs;this.cases=cases;}
  @GetMapping public Map<String,Object> read(@PathVariable String caseId,@PathVariable UUID requestId,JwtAuthenticationToken auth){cases.require(tenant(auth),caseId);return runs.read(tenant(auth),actor(auth),caseId,requestId.toString());}
  @PostMapping("/cancel") public Map<String,Object> cancel(@PathVariable String caseId,@PathVariable UUID requestId,JwtAuthenticationToken auth){cases.require(tenant(auth),caseId);return runs.cancel(tenant(auth),actor(auth),caseId,requestId.toString());}
}
