package dev.creditlab.platform;

import static dev.creditlab.security.JwtIdentity.tenant;

import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cases/{caseId}/platform/research")
@PreAuthorize("hasAnyRole('ADVISOR','REVIEWER','ADMIN')")
public class DocumentResearchController {
  private final DocumentResearch research;
  public DocumentResearchController(DocumentResearch research){this.research=research;}
  @GetMapping public Map<String,Object> read(@PathVariable String caseId,JwtAuthenticationToken auth){return research.read(tenant(auth),caseId);}
  @PostMapping("/datasets") public Map<String,Object> save(@PathVariable String caseId,@Valid @RequestBody DocumentResearch.DatasetRequest body,JwtAuthenticationToken auth){return research.save(tenant(auth),caseId,auth.getName(),body);}
  @PostMapping("/runs") @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
  public Map<String,Object> run(@PathVariable String caseId,@Valid @RequestBody DocumentResearch.RunRequest body,JwtAuthenticationToken auth){return research.enqueue(tenant(auth),caseId,auth.getName(),body);}
  @PostMapping("/export") public Map<String,Object> export(@PathVariable String caseId,@Valid @RequestBody DocumentResearch.ExportRequest body,JwtAuthenticationToken auth){return research.export(tenant(auth),caseId,auth.getName(),body.caseVersion());}
}
