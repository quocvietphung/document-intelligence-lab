package dev.creditlab.casework;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import jakarta.validation.Valid;
import org.springframework.http.*;

@RestController
@RequestMapping("/api/cases")
public class CreditCaseController {
  private final CreditCaseService service;
  private final DocumentAnalysisService documentAnalysis;
  private final dev.creditlab.platform.DocumentScanner scanner;
  private final dev.creditlab.platform.DistributedLimits limits;
  @Value("${app.security.enabled:true}") private boolean securityEnabled;
  public CreditCaseController(CreditCaseService service,DocumentAnalysisService documentAnalysis,dev.creditlab.platform.DocumentScanner scanner,dev.creditlab.platform.DistributedLimits limits) {
    this.service = service; this.documentAnalysis = documentAnalysis; this.scanner=scanner; this.limits=limits;
  }

  private String actor(Authentication auth) { return auth instanceof JwtAuthenticationToken token ? token.getToken().getSubject() : "local-demo"; }
  @PostMapping public ResponseEntity<CreditCase> create(@Valid @RequestBody CreditCaseService.Draft draft,Authentication auth) {
    return ResponseEntity.status(201).body(service.create(resolveTenant(auth,null),actor(auth),draft));
  }
  @PatchMapping("/{id}") public CreditCase edit(@PathVariable String id,@Valid @RequestBody CreditCaseService.Draft draft,Authentication auth) {
    return service.edit(resolveTenant(auth,null),id,actor(auth),draft);
  }
  @PostMapping(value="/{id}/documents",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
  public CreditCase upload(@PathVariable String id,@RequestParam("file") MultipartFile file,@RequestParam long version,Authentication auth) throws java.io.IOException {
    String tenant=resolveTenant(auth,null); service.allowWrite(); var current=service.require(tenant,id);
    if(current.version()!=version)throw new org.springframework.web.server.ResponseStatusException(HttpStatus.CONFLICT,"Document case version changed");
    String name=java.util.Objects.requireNonNullElse(file.getOriginalFilename(),"document").replaceAll("[^\\p{L}\\p{N}._ -]","_");
    if(name.length()>120) name=name.substring(name.length()-120);
    byte[] bytes=file.getBytes();
    if(bytes.length==0||bytes.length>3_000_000)throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Use a file between 1 byte and 3 MB");
    limits.reserve(tenant,actor(auth),"document-upload",12);
    try{scanner.scan(bytes);}
    catch(IllegalArgumentException error){throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Document failed safety checks");}
    catch(IllegalStateException error){throw new org.springframework.web.server.ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Document scanner unavailable");}
    String contentType=java.util.Objects.requireNonNullElse(file.getContentType(),"application/octet-stream");
    var document=documentAnalysis.analyze(name,contentType,bytes);
    if(document.pages().stream().anyMatch(page->dev.creditlab.platform.EvidenceGuard.suspicious(page.text())))
      throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Document instruction override quarantined");
    return service.attach(tenant,id,actor(auth),bytes,document,version);
  }
  @GetMapping("/document-analysis/status") public java.util.Map<String,Object> documentAnalysisStatus() {
    return documentAnalysis.status();
  }
  @PostMapping("/{id}/documents/{doc}/review") public CreditCase review(@PathVariable String id,@PathVariable String doc,@Valid @RequestBody CreditCaseService.Review review,Authentication auth) {
    return service.review(resolveTenant(auth,null),id,doc,actor(auth),review);
  }
  @GetMapping("/{id}/documents/{doc}/original") public ResponseEntity<byte[]> original(@PathVariable String id,@PathVariable String doc,Authentication auth) {
    return service.file(resolveTenant(auth,null),id,doc).map(bytes->ResponseEntity.ok()
      .header("Content-Disposition","attachment; filename=\"source-document\"").header("X-Content-Type-Options","nosniff")
      .header("Cache-Control","no-store").contentType(MediaType.APPLICATION_OCTET_STREAM).body(bytes)).orElseGet(()->ResponseEntity.notFound().build());
  }
  public record Reservation(@jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(30000) int tokens) {}
  @PostMapping("/{id}/ai-reservations") public java.util.Map<String,Object> reserve(@PathVariable String id,@Valid @RequestBody Reservation reservation,Authentication auth) {
    service.reserve(resolveTenant(auth,null),id,actor(auth),reservation.tokens()); return java.util.Map.of("reservedTokens",reservation.tokens(),"dailyUserBudget",30000,"requestsPerMinute",6);
  }

  @GetMapping
  public List<CreditCase> list(Authentication authentication, @RequestHeader(value = "X-Demo-Tenant", required = false) String demoTenant) {
    return service.findAll(resolveTenant(authentication, demoTenant));
  }

  @GetMapping("/{id}")
  public ResponseEntity<CreditCase> get(@PathVariable String id, Authentication authentication, @RequestHeader(value = "X-Demo-Tenant", required = false) String demoTenant) {
    return service.findById(resolveTenant(authentication, demoTenant), id)
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  private String resolveTenant(Authentication authentication, String demoTenant) {
    if (authentication instanceof JwtAuthenticationToken token) {
      String tenant = token.getToken().getClaimAsString("tenant_id");
      if (tenant == null || tenant.isBlank()) throw new AccessDeniedException("tenant_id claim is required");
      return tenant;
    }
    if (securityEnabled) throw new AccessDeniedException("Verified identity required");
    return "praxisbank-demo";
  }
}
