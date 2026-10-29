package dev.creditlab.platform;

import static dev.creditlab.security.JwtIdentity.*;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cases/{caseId}/platform/analytics")
@PreAuthorize("hasAnyRole('ADVISOR','REVIEWER','ADMIN')")
public class DocumentAnalyticsController {
  private final DocumentAnalytics analytics;
  public DocumentAnalyticsController(DocumentAnalytics analytics){this.analytics=analytics;}
  @GetMapping public Map<String,Object> read(@PathVariable String caseId,JwtAuthenticationToken auth){return analytics.read(tenant(auth),caseId);}
  @PostMapping @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
  @PreAuthorize("hasAnyRole('ADVISOR','ADMIN')")
  public Map<String,Object> run(@PathVariable String caseId,@Valid @RequestBody DocumentAnalytics.Request body,JwtAuthenticationToken auth){return analytics.enqueue(tenant(auth),caseId,actor(auth),body);}
  @PostMapping("/reviews") @PreAuthorize("hasAnyRole('REVIEWER','ADMIN')")
  public Map<String,Object> review(@PathVariable String caseId,@Valid @RequestBody DocumentAnalytics.Review body,JwtAuthenticationToken auth){return analytics.review(tenant(auth),caseId,actor(auth),body);}
}
