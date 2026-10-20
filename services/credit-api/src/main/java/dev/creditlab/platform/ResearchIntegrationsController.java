package dev.creditlab.platform;

import static dev.creditlab.security.JwtIdentity.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cases/{caseId}/platform/integrations")
@PreAuthorize("hasAnyRole('ADVISOR','REVIEWER','ADMIN')")
public class ResearchIntegrationsController {
  private final ResearchIntegrations integrations;private final BlobSources blob;private final DistributedLimits limits;private final DocumentVision vision;
  public ResearchIntegrationsController(ResearchIntegrations integrations,BlobSources blob,DistributedLimits limits,DocumentVision vision){this.integrations=integrations;this.blob=blob;this.limits=limits;this.vision=vision;}
  public record ImportRequest(@NotBlank @Pattern(regexp="[a-fA-F0-9-]{36}") String requestId,@Min(0) long caseVersion,
      @NotBlank @Size(max=300) String name,@NotBlank @Size(max=160) String etag,@NotBlank @Pattern(regexp="general|invoice|payroll|insurance-wording") String profile,@AssertTrue boolean consent){}
  public record ExportRequest(@NotBlank @Pattern(regexp="[-a-zA-Z0-9]{1,80}") String answerId,@Min(0) long caseVersion,@AssertTrue boolean consent){}
  public record VisionRequest(@NotBlank @Pattern(regexp="[-a-zA-Z0-9]{1,80}") String documentId,@Min(1) @Max(4) int page,@NotBlank @Size(max=2000) String question,@Min(0) long caseVersion,@AssertTrue boolean consent){}
  @GetMapping public Map<String,Object> status(@PathVariable String caseId,Authentication auth){return integrations.status(tenant(auth),caseId);}
  @PostMapping("/sources") public Map<String,Object> sources(@PathVariable String caseId,Authentication auth){limits.reserve(tenant(auth),actor(auth),"blob-list",6);return blob.list(tenant(auth),caseId);}
  @PostMapping("/import") @PreAuthorize("hasAnyRole('ADVISOR','ADMIN')")
  public Map<String,Object> ingest(@PathVariable String caseId,@Valid @RequestBody ImportRequest body,Authentication auth){return blob.ingest(tenant(auth),caseId,actor(auth),body.requestId(),body.caseVersion(),body.name(),body.etag(),body.profile(),body.consent());}
  @PostMapping("/evaluation-export") public Map<String,Object> export(@PathVariable String caseId,@Valid @RequestBody ExportRequest body,Authentication auth){return integrations.export(tenant(auth),caseId,actor(auth),body.answerId(),body.caseVersion(),body.consent());}
  @PostMapping("/vision") public Map<String,Object> vision(@PathVariable String caseId,@Valid @RequestBody VisionRequest body,Authentication auth){return vision.ask(tenant(auth),caseId,actor(auth),body.documentId(),body.page(),body.question(),body.caseVersion(),body.consent());}
}
