package dev.creditlab.platform;

import static dev.creditlab.security.JwtIdentity.*;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cases/{caseId}/platform/inspection")
@PreAuthorize("hasAnyRole('ADVISOR','REVIEWER','ADMIN')")
public class LocalEvidenceInspectionController {
  private final LocalEvidenceInspection inspection;
  public LocalEvidenceInspectionController(LocalEvidenceInspection inspection){this.inspection=inspection;}
  @GetMapping public Map<String,Object> read(@PathVariable String caseId,JwtAuthenticationToken auth){return inspection.read(tenant(auth),caseId);}
  @PostMapping @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
  public Map<String,Object> run(@PathVariable String caseId,@Valid @RequestBody LocalEvidenceInspection.Request body,JwtAuthenticationToken auth){return inspection.enqueue(tenant(auth),caseId,actor(auth),body);}
  @GetMapping("/{runId}/report") public org.springframework.http.ResponseEntity<Map<String,Object>> report(@PathVariable String caseId,@PathVariable String runId,JwtAuthenticationToken auth){
    return org.springframework.http.ResponseEntity.ok().header("Cache-Control","no-store").header("Content-Disposition","attachment; filename=\"private-evidence-report.json\"").body(inspection.report(tenant(auth),caseId,runId));
  }
}
