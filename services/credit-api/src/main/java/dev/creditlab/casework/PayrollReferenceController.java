package dev.creditlab.casework;

import dev.creditlab.platform.ApprovedDatevSamples;
import java.nio.file.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Only the operator-approved fictional references. Never an arbitrary file browser. */
@RestController
@PreAuthorize("hasAnyRole('ADVISOR','REVIEWER','ADMIN')")
public class PayrollReferenceController {
  private static final Map<String,String> FILES=Map.of(
      "robert","datev-lodas-2025-robert-muster.pdf",
      "melanie","datev-lodas-2025-melanie-muster.pdf");
  private final Path folder;
  public PayrollReferenceController(@Value("${PAYROLL_REFERENCE_ROOT:}") String root) {
    folder=root.isBlank()?null:Path.of(root).toAbsolutePath().normalize();
  }
  private byte[] bytes(String id) {
    String name=FILES.get(id);
    if(name==null)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Unknown reference");
    try {
      if(folder==null)throw new IllegalStateException();
      Path file=folder.resolve(name);
      if(!Files.isRegularFile(file,LinkOption.NOFOLLOW_LINKS)||Files.size(file)>3_000_000)throw new IllegalStateException();
      byte[] content=Files.readAllBytes(file);
      if(!ApprovedDatevSamples.matches(name,content))throw new IllegalStateException();
      return content;
    } catch(Exception error) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Private reference unavailable"); }
  }
  @GetMapping("/api/cases/payroll-references")
  public ResponseEntity<?> read(@RequestParam(required=false) String sample,Authentication authentication) {
    if(!(authentication instanceof JwtAuthenticationToken token)
        ||token.getToken().getClaimAsString("tenant_id")==null
        ||token.getToken().getClaimAsString("tenant_id").isBlank())throw new AccessDeniedException("Verified tenant required");
    var response=ResponseEntity.ok().header("Cache-Control","private, no-store").header("X-Content-Type-Options","nosniff");
    if(sample!=null) {
      byte[] content=bytes(sample);
      return response.contentType(MediaType.APPLICATION_PDF)
          .header("Content-Disposition","inline; filename=\""+FILES.get(sample)+"\"").body(content);
    }
    var references=new ArrayList<Map<String,Object>>();
    for(String id:List.of("robert","melanie")) {
      boolean available;
      try { bytes(id);available=true; } catch(ResponseStatusException unavailable) { available=false; }
      references.add(Map.of("id",id,"available",available));
    }
    return response.body(Map.of("references",references));
  }
}
