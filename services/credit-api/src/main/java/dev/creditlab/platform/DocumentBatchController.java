package dev.creditlab.platform;

import static dev.creditlab.security.JwtIdentity.actor;
import static dev.creditlab.security.JwtIdentity.tenant;

import java.util.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/cases/{caseId}/platform/batches")
@PreAuthorize("hasAnyRole('ADVISOR','REVIEWER','ADMIN')")
public class DocumentBatchController {
  private final DocumentBatches batches;
  public DocumentBatchController(DocumentBatches batches){this.batches=batches;}
  @GetMapping public Map<String,Object> list(@PathVariable String caseId,Authentication auth){return batches.list(tenant(auth),caseId);}
  @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
  @PreAuthorize("hasAnyRole('ADVISOR','ADMIN')")
  public ResponseEntity<Map<String,Object>> submit(@PathVariable String caseId,@RequestParam("files") List<MultipartFile> files,@RequestParam String requestId,@RequestParam String name,@RequestParam String source,@RequestParam String profile,Authentication auth)throws java.io.IOException{
    if(files.isEmpty()||files.size()>4)throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Select one to four files");
    var input=new ArrayList<DocumentBatches.Input>();
    for(var file:files){if(file.getSize()>3_000_000)throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"File exceeds 3 MB");input.add(new DocumentBatches.Input(Objects.requireNonNullElse(file.getOriginalFilename(),"document.pdf"),Objects.requireNonNullElse(file.getContentType(),"application/octet-stream"),file.getBytes()));}
    return ResponseEntity.accepted().body(batches.submit(tenant(auth),caseId,actor(auth),requestId,name,source,profile,input));
  }
}
