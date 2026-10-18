package dev.creditlab.trust;

import static dev.creditlab.security.JwtIdentity.actor;
import static dev.creditlab.security.JwtIdentity.tenant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cases/{caseId}/trust")
@PreAuthorize("hasAnyRole('ADVISOR','REVIEWER','ADMIN')")
public class TrustController {
  private final TrustService trust;public TrustController(TrustService trust){this.trust=trust;}
  public record Feedback(@Pattern(regexp="[-a-zA-Z0-9]{1,80}") @NotBlank String answerId,@NotBlank @Size(max=40) String reason,@NotNull @Size(max=500) String note,@NotBlank @Pattern(regexp="[a-fA-F0-9-]{36}") String requestId,@Min(0) long caseVersion){}
  public record Correction(@NotBlank @Pattern(regexp="[-a-zA-Z0-9]{1,80}") String answerId,@NotBlank @Pattern(regexp="[a-fA-F0-9-]{36}") String feedbackId,@NotBlank @Pattern(regexp="en|de|vi") String locale,@Min(0) long caseVersion){}
  public record Task(@NotNull @Pattern(regexp="[-a-zA-Z0-9]{0,80}") String answerId,@NotBlank @Size(max=160) String title,@NotBlank @Size(max=500) String note,@NotBlank @Pattern(regexp="[a-fA-F0-9-]{36}") String requestId,@Min(0) long caseVersion){}
  public record Transition(@NotBlank @Pattern(regexp="CLAIM|RETURN|RESOLVE|REOPEN") String action,@NotNull @Size(max=500) String note,@Min(0) long version,@Min(0) long caseVersion){}
  public record Prompt(@NotBlank @Pattern(regexp=TrustCatalog.TASK_PATTERN) String taskId,@NotBlank @Pattern(regexp="en|de|vi") String locale,@Min(0) long caseVersion){}
  public record Feature(@NotBlank @Pattern(regexp="nova|"+TrustCatalog.TASK_PATTERN) String featureId,boolean enabled,@Min(0) long version,@Min(0) long caseVersion,@NotBlank @Size(max=300) String note){}
  @GetMapping public Object snapshot(@PathVariable String caseId,Authentication auth){return trust.snapshot(tenant(auth),caseId,actor(auth),admin(auth));}
  @PostMapping("/feedback") public Object feedback(@PathVariable String caseId,@Valid @RequestBody Feedback r,Authentication a){return trust.feedback(tenant(a),caseId,actor(a),r.answerId(),r.reason(),r.note(),r.requestId(),r.caseVersion());}
  @PostMapping("/correction") public Object correction(@PathVariable String caseId,@Valid @RequestBody Correction r,Authentication a){return trust.correction(tenant(a),caseId,actor(a),r.answerId(),r.feedbackId(),r.locale(),r.caseVersion());}
  @PostMapping("/prompt") public Object prompt(@PathVariable String caseId,@Valid @RequestBody Prompt r,Authentication a){return trust.taskPrompt(tenant(a),caseId,r.taskId(),r.locale(),r.caseVersion());}
  @PostMapping("/tasks") public Object create(@PathVariable String caseId,@Valid @RequestBody Task r,Authentication a){return trust.createTask(tenant(a),caseId,actor(a),r.answerId(),r.title(),r.note(),r.requestId(),r.caseVersion());}
  @PostMapping("/tasks/{taskId}") @PreAuthorize("hasAnyRole('REVIEWER','ADMIN')") public Object transition(@PathVariable String caseId,@PathVariable String taskId,@Valid @RequestBody Transition r,Authentication a){return trust.transition(tenant(a),caseId,actor(a),admin(a),taskId,r.action(),r.note(),r.version(),r.caseVersion());}
  @PostMapping("/features") @PreAuthorize("hasRole('ADMIN')") public Object configure(@PathVariable String caseId,@Valid @RequestBody Feature r,Authentication a){return trust.configure(tenant(a),caseId,actor(a),r.featureId(),r.enabled(),r.version(),r.caseVersion(),r.note());}
  private boolean admin(Authentication a){return a!=null&&a.getAuthorities().stream().anyMatch(r->r.getAuthority().equals("ROLE_ADMIN"));}
}
