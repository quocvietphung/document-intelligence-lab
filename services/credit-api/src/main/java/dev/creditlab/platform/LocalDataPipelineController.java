package dev.creditlab.platform;

import static dev.creditlab.security.JwtIdentity.*;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cases/{caseId}/platform/etl")
@PreAuthorize("hasAnyRole('ADVISOR','REVIEWER','ADMIN')")
public class LocalDataPipelineController {
  private final LocalDataPipeline pipeline;
  public LocalDataPipelineController(LocalDataPipeline pipeline){this.pipeline=pipeline;}
  @GetMapping public Map<String,Object> read(@PathVariable String caseId,JwtAuthenticationToken auth){return pipeline.read(tenant(auth),caseId);}
  @PostMapping @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
  @PreAuthorize("hasAnyRole('ADVISOR','ADMIN')")
  public Map<String,Object> run(@PathVariable String caseId,@Valid @RequestBody LocalDataPipeline.Request body,JwtAuthenticationToken auth){return pipeline.enqueue(tenant(auth),caseId,actor(auth),body);}
  @GetMapping("/{runId}/{layer}")
  public org.springframework.http.ResponseEntity<byte[]> download(@PathVariable String caseId,@PathVariable String runId,@PathVariable String layer,JwtAuthenticationToken auth){
    byte[] data=pipeline.artifact(tenant(auth),caseId,runId,layer);
    return org.springframework.http.ResponseEntity.ok().header("Cache-Control","no-store").header("X-Content-Type-Options","nosniff")
        .header("Content-Disposition","attachment; filename=\""+layer+".parquet\"").contentType(org.springframework.http.MediaType.APPLICATION_OCTET_STREAM).body(data);
  }
}
