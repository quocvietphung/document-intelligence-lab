package dev.creditlab.platform;

import static dev.creditlab.security.JwtIdentity.*;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cases/{caseId}/platform/classification")
@PreAuthorize("hasAnyRole('ADVISOR','REVIEWER','ADMIN')")
public class DocumentClassificationController {
  private final DocumentClassification classification;
  public DocumentClassificationController(DocumentClassification classification){this.classification=classification;}
  @GetMapping public Map<String,Object> read(@PathVariable String caseId,JwtAuthenticationToken auth){return classification.read(tenant(auth),caseId);}
  @GetMapping("/input") public Map<String,Object> input(@PathVariable String caseId,JwtAuthenticationToken auth){return classification.benchmarkInput(tenant(auth),caseId);}
  @GetMapping("/documents/{sample}") public ResponseEntity<byte[]> pdf(@PathVariable String caseId,@PathVariable String sample,JwtAuthenticationToken auth){
    return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).cacheControl(CacheControl.noStore())
      .header("X-Content-Type-Options","nosniff").header("Content-Disposition",ContentDisposition.attachment().filename(sample+".pdf").build().toString())
      .body(classification.pdf(tenant(auth),caseId,sample));
  }
  @PostMapping @ResponseStatus(HttpStatus.ACCEPTED) @PreAuthorize("hasAnyRole('ADVISOR','ADMIN')")
  public Map<String,Object> run(@PathVariable String caseId,@Valid @RequestBody DocumentClassification.Request request,JwtAuthenticationToken auth){
    return classification.enqueue(tenant(auth),caseId,actor(auth),request);
  }
}
