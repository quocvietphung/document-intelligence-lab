package dev.creditlab.sources;

import static dev.creditlab.security.JwtIdentity.actor;
import static dev.creditlab.security.JwtIdentity.tenant;

import dev.creditlab.sources.SourceContracts.ConnectorException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Connector endpoints. Tokens are exchanged and stored only on the server; responses carry status, scopes,
 * counts and stable error codes. Every document operation is authorized for the verified tenant and dossier.
 */
@RestController
@PreAuthorize("hasAnyRole('ADVISOR','REVIEWER','ADMIN')")
public class ConnectorController {
  private final SourceIntake intake; private final ConnectorAccounts accounts; private final GoogleClient google;
  private final UseCaseCatalog catalog; private final Destinations.Report report; private final Destinations.GmailDraft drafts;
  private final UseCaseChecks checks;

  public ConnectorController(SourceIntake intake, ConnectorAccounts accounts, GoogleClient google, UseCaseCatalog catalog,
      Destinations.Report report, Destinations.GmailDraft drafts, UseCaseChecks checks) {
    this.intake = intake; this.accounts = accounts; this.google = google; this.catalog = catalog; this.report = report; this.drafts = drafts;
    this.checks = checks;
  }

  public record AuthorizeRequest(@NotEmpty @Size(max = 3) List<@Pattern(regexp = "gmail|google-drive|gmail-draft") String> features) {}
  public record CallbackRequest(@NotBlank @Size(max = 512) String code, @NotBlank @Size(max = 64) String state) {}
  public record PreviewRequest(@Size(max = 200) String query, @Min(1) @Max(20) Integer limit) {}
  public record ImportRequest(@NotBlank @Pattern(regexp = "[a-fA-F0-9-]{36}") String requestId, @Min(0) long caseVersion,
      @NotEmpty @Size(max = 4) List<@NotBlank @Size(max = 300) String> externalIds,
      @NotBlank @Pattern(regexp = "general|invoice|payroll|insurance-wording") String profile, @AssertTrue boolean consent) {}
  public record DraftPreviewRequest(@NotBlank @Size(max = 80) String documentId, @NotEmpty @Size(max = 20) List<@NotBlank @Size(max = 80) String> fieldLabels,
      @Size(max = 5) List<@NotBlank @Size(max = 254) String> recipients, @NotBlank @Size(max = 150) String subject, @Size(max = 1000) String note,
      boolean includeEvidenceExcerpts) {}
  public record DraftApproval(@NotBlank @Size(max = 80) String previewId, @NotBlank @Pattern(regexp = "[a-f0-9]{64}") String contentHash, @AssertTrue boolean confirmed) {}
  public record AssessmentRequest(@NotBlank @Size(max = 64_000) String csv) {}

  @GetMapping("/api/connectors")
  public Map<String, Object> overview(Authentication auth) { return intake.overview(tenant(auth), actor(auth)); }

  @GetMapping("/api/connectors/use-cases")
  @SuppressWarnings("unchecked")
  public Map<String, Object> useCases() {
    // Plain collections: the HTTP layer uses its own JSON library, not the catalog's tree model.
    return new com.fasterxml.jackson.databind.ObjectMapper().convertValue(catalog.catalog(), Map.class);
  }

  @PostMapping("/api/connectors/google/authorize") @PreAuthorize("hasAnyRole('ADVISOR','ADMIN')")
  public Map<String, Object> authorize(@Valid @RequestBody AuthorizeRequest body, Authentication auth) {
    if (!google.configured()) throw new ConnectorException("CONNECTOR_NOT_CONFIGURED", 503);
    var scopes = new TreeSet<String>();
    for (String feature : body.features()) scopes.add(switch (feature) {
      case "gmail" -> GoogleClient.GMAIL_READ; case "google-drive" -> GoogleClient.DRIVE_READ; default -> GoogleClient.GMAIL_COMPOSE;
    });
    String verifier = GoogleClient.newVerifier();
    String state = accounts.beginAuthorization(tenant(auth), actor(auth), GoogleClient.PROVIDER, verifier, List.copyOf(scopes));
    accounts.audit(tenant(auth), null, actor(auth), "OAUTH_STARTED", "google", Map.of("scopes", List.copyOf(scopes)));
    return Map.of("authorizationUrl", google.authorizationUrl(state, verifier, List.copyOf(scopes)), "scopes", List.copyOf(scopes), "expiresInSeconds", 600);
  }

  @PostMapping("/api/connectors/google/callback") @PreAuthorize("hasAnyRole('ADVISOR','ADMIN')")
  public Map<String, Object> callback(@Valid @RequestBody CallbackRequest body, Authentication auth) {
    var pending = accounts.completeAuthorization(tenant(auth), actor(auth), body.state());
    var grant = google.exchange(body.code(), pending.verifier());
    var granted = grant.scopes().stream().filter(pending.scopes()::contains).toList();
    if (granted.isEmpty()) throw new ConnectorException("SCOPE_NOT_GRANTED", 409);
    accounts.connect(tenant(auth), actor(auth), GoogleClient.PROVIDER, grant.refreshToken(), granted);
    accounts.audit(tenant(auth), null, actor(auth), "CONNECTED", "google", Map.of("scopes", granted, "requested", pending.scopes()));
    return Map.of("status", "CONNECTED", "scopes", granted);
  }

  @PostMapping("/api/connectors/google/disconnect")
  public Map<String, Object> disconnect(Authentication auth) {
    boolean revoked = accounts.credential(tenant(auth), actor(auth), GoogleClient.PROVIDER).map(ConnectorAccounts.Credential::connected).orElse(false)
        && google.revoke(tenant(auth), actor(auth));
    accounts.disconnect(tenant(auth), actor(auth), GoogleClient.PROVIDER);
    accounts.audit(tenant(auth), null, actor(auth), "DISCONNECTED", "google", Map.of("providerRevoked", revoked));
    return Map.of("status", "DISCONNECTED", "providerRevoked", revoked);
  }

  @PostMapping("/api/cases/{caseId}/platform/sources/{sourceId}/preview")
  public Map<String, Object> preview(@PathVariable String caseId, @PathVariable String sourceId, @Valid @RequestBody PreviewRequest body, Authentication auth) {
    return intake.preview(tenant(auth), caseId, actor(auth), sourceId, body.query(), body.limit() == null ? 10 : body.limit());
  }

  @PostMapping("/api/cases/{caseId}/platform/sources/{sourceId}/import") @PreAuthorize("hasAnyRole('ADVISOR','ADMIN')")
  public Map<String, Object> importItems(@PathVariable String caseId, @PathVariable String sourceId, @Valid @RequestBody ImportRequest body, Authentication auth) {
    return intake.importItems(tenant(auth), caseId, actor(auth),
        new SourceIntake.ImportCommand(sourceId, body.requestId(), body.caseVersion(), body.externalIds(), body.profile(), body.consent()));
  }

  @GetMapping("/api/cases/{caseId}/platform/sources/imports")
  public Map<String, Object> imports(@PathVariable String caseId, Authentication auth) { return intake.imports(tenant(auth), caseId); }

  @PostMapping("/api/cases/{caseId}/platform/destinations/report")
  public Map<String, Object> report(@PathVariable String caseId, Authentication auth) { return report.build(tenant(auth), caseId, actor(auth)); }

  @PostMapping("/api/cases/{caseId}/platform/destinations/gmail-draft/preview")
  public Map<String, Object> draftPreview(@PathVariable String caseId, @Valid @RequestBody DraftPreviewRequest body, Authentication auth) {
    return drafts.preview(tenant(auth), caseId, actor(auth), new Destinations.GmailDraft.DraftRequest(body.documentId(), body.fieldLabels(),
        body.recipients(), body.subject(), body.note(), body.includeEvidenceExcerpts()));
  }

  @PostMapping("/api/cases/{caseId}/platform/destinations/gmail-draft/approve")
  public Map<String, Object> draftApprove(@PathVariable String caseId, @Valid @RequestBody DraftApproval body, Authentication auth) {
    return drafts.approve(tenant(auth), caseId, actor(auth), body.previewId(), body.contentHash(), body.confirmed());
  }

  @PostMapping("/api/cases/{caseId}/platform/project-assessment")
  public Map<String, Object> assess(@PathVariable String caseId, @Valid @RequestBody AssessmentRequest body, Authentication auth) {
    intake.requireCase(tenant(auth), caseId);
    var result = ProjectAssessment.assess(ProjectAssessment.parseCsv(body.csv()));
    accounts.audit(tenant(auth), caseId, actor(auth), "PROJECT_ASSESSED", "csv-excel", Map.of("method", ProjectAssessment.METHOD));
    return result;
  }

  @PostMapping("/api/cases/{caseId}/platform/use-cases/{useCaseId}/check")
  public Map<String, Object> checkUseCase(@PathVariable String caseId, @PathVariable @Pattern(regexp = "[a-z-]{3,60}") String useCaseId, Authentication auth) {
    intake.requireCase(tenant(auth), caseId);
    var result = checks.run(useCaseId);
    accounts.audit(tenant(auth), caseId, actor(auth), "USE_CASE_CHECKED", "local", Map.of("useCase", useCaseId, "passed", result.get("passed")));
    return result;
  }

  @ExceptionHandler(ConnectorException.class)
  public ResponseEntity<Map<String, Object>> connectorError(ConnectorException error) {
    return ResponseEntity.status(error.status()).body(Map.of("error", error.code()));
  }
}
