package dev.creditlab.platform;

import static dev.creditlab.security.JwtIdentity.actor;
import static dev.creditlab.security.JwtIdentity.tenant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.Map;

@RestController
@RequestMapping("/api/cases/{caseId}/platform")
@PreAuthorize("hasAnyRole('ADVISOR','REVIEWER','ADMIN')")
public class PlatformController {
  private final PlatformService platform;private final DocumentJobs jobs;
  public PlatformController(PlatformService platform,DocumentJobs jobs){this.platform=platform;this.jobs=jobs;}
  @GetMapping public Map<String,Object> read(@PathVariable String caseId,Authentication auth){return platform.snapshot(tenant(auth),caseId);}
  public record Question(@NotBlank @Size(max=2000) String question) {}
  @PostMapping("/search")public Map<String,Object> search(@PathVariable String caseId,@Valid @RequestBody Question q,Authentication auth){return platform.search(tenant(auth),caseId,actor(auth),q.question());}
  @PostMapping("/evaluate")public Map<String,Object> evaluate(@PathVariable String caseId,Authentication auth){return platform.evaluate(tenant(auth),caseId,actor(auth));}
  @PostMapping(value="/jobs",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)@PreAuthorize("hasAnyRole('ADVISOR','ADMIN')")
  public ResponseEntity<Map<String,Object>> upload(@PathVariable String caseId,@RequestParam("file") MultipartFile file,Authentication auth)throws java.io.IOException {
    return ResponseEntity.accepted().body(jobs.enqueue(tenant(auth),caseId,actor(auth),java.util.Objects.requireNonNullElse(file.getOriginalFilename(),"document.pdf"),java.util.Objects.requireNonNullElse(file.getContentType(),"application/octet-stream"),file.getBytes()));
  }
  public record Review(@NotBlank @Size(max=160) String alertId,@NotBlank @Size(max=500) String note) {}
  @PostMapping("/jobs/{jobId}/retry")@PreAuthorize("hasAnyRole('ADVISOR','ADMIN')")
  public ResponseEntity<Map<String,Object>> retry(@PathVariable String caseId,@PathVariable String jobId,Authentication auth){
    return ResponseEntity.accepted().body(jobs.retry(tenant(auth),caseId,actor(auth),jobId));
  }
  @PostMapping("/jobs/{jobId}/cancel")@PreAuthorize("hasAnyRole('ADVISOR','ADMIN')")
  public Map<String,Object> cancel(@PathVariable String caseId,@PathVariable String jobId,Authentication auth){return jobs.cancel(tenant(auth),caseId,actor(auth),jobId);}
  @PostMapping("/reviews")@PreAuthorize("hasAnyRole('REVIEWER','ADMIN')")
  public Map<String,Object> review(@PathVariable String caseId,@Valid @RequestBody Review r,Authentication auth){return platform.review(tenant(auth),caseId,actor(auth),r.alertId(),r.note());}
}
