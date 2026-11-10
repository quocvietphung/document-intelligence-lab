package dev.creditlab.sources;

import dev.creditlab.casework.CreditCase;
import dev.creditlab.casework.CreditCaseService;
import dev.creditlab.platform.LabStore;
import dev.creditlab.sources.SourceContracts.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Component;

/** Result destinations. Each one delivers only content a person reviewed; none sends anything by itself. */
public final class Destinations {
  private Destinations() {}
  static final String NOTICE = "Research support only. Not a legal, financial, payment, investment or compliance decision.";

  /** Downloadable JSON report of reviewed fields, evidence pages and provenance. No network call. */
  @Component
  public static class Report implements ResultDestination {
    private final CreditCaseService cases; private final LabStore store; private final ConnectorAccounts accounts;
    public Report(CreditCaseService cases, LabStore store, ConnectorAccounts accounts) { this.cases = cases; this.store = store; this.accounts = accounts; }

    @Override public Descriptor descriptor() {
      return new Descriptor("download-report", Kind.DESTINATION, "Download report", Label.VERIFIED_LOCAL, true, false, false, List.of(),
          List.of("Download reviewed fields, evidence pages and source provenance as JSON"), "Generated locally; nothing leaves the workspace.");
    }

    public Map<String, Object> build(String tenant, String caseId, String actor) {
      var item = cases.require(tenant, caseId);
      var documents = item.documents().stream().map(doc -> {
        var row = new LinkedHashMap<String, Object>();
        row.put("id", doc.id()); row.put("name", doc.name()); row.put("type", doc.type());
        row.put("reviewStatus", doc.status()); row.put("humanReviewed", "verified".equals(doc.status()));
        row.put("provider", Objects.requireNonNullElse(doc.analysisProvider(), "unknown"));
        row.put("fields", doc.fields().stream().map(f -> Map.of("label", f.label(), "value", f.value(), "page", f.page(),
            "confidence", f.confidence() == null ? "unknown" : f.confidence(),
            "evidence", IntakeChecks.displayText(f.evidence(), 200))).toList());
        return row;
      }).toList();
      accounts.audit(tenant, caseId, actor, "REPORT_EXPORTED", "download-report", Map.of("documents", documents.size()));
      return Map.of("schemaVersion", "document-report-v1", "caseId", caseId, "generatedAt", Instant.now().toString(), "generatedBy", actor,
          "documents", documents, "provenance", store.list(tenant, caseId, "source-import"), "notice", NOTICE);
    }
  }

  /**
   * Gmail draft after explicit preview and approval. gmail.compose technically allows sending; this class
   * only ever calls drafts.create. Document text is included only for fields the user selected, and evidence
   * excerpts only when the user opts in.
   */
  @Component
  public static class GmailDraft implements ResultDestination {
    private static final String EMAIL = "[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\\.[A-Za-z]{2,24}";
    private final CreditCaseService cases; private final LabStore store; private final ConnectorAccounts accounts; private final GoogleClient google;
    public GmailDraft(CreditCaseService cases, LabStore store, ConnectorAccounts accounts, GoogleClient google) {
      this.cases = cases; this.store = store; this.accounts = accounts; this.google = google;
    }
    public record DraftRequest(String documentId, List<String> fieldLabels, List<String> recipients, String subject, String note, boolean includeEvidenceExcerpts) {}

    @Override public Descriptor descriptor() {
      return new Descriptor("gmail-draft", Kind.DESTINATION, "Gmail draft", Label.IMPLEMENTED_NOT_LIVE_VERIFIED, google.configured(), google.configured(), true,
          List.of(GoogleClient.GMAIL_COMPOSE),
          List.of("Create a draft only after you preview and approve its exact content", "Never sends email. The Google scope also allows sending; this app never calls send"),
          "Tested with a mocked Gmail API only. Connect separately; reading mail does not grant draft creation.");
    }

    public Map<String, Object> preview(String tenant, String caseId, String actor, DraftRequest request) {
      var item = cases.require(tenant, caseId);
      var doc = item.documents().stream().filter(d -> d.id().equals(request.documentId())).findFirst()
          .orElseThrow(() -> new ConnectorException("DOCUMENT_NOT_FOUND", 404));
      if (!"verified".equals(doc.status())) throw new ConnectorException("HUMAN_REVIEW_REQUIRED", 409);
      var labels = List.copyOf(new LinkedHashSet<>(Objects.requireNonNullElse(request.fieldLabels(), List.<String>of())));
      if (labels.isEmpty() || labels.size() > 20) throw new ConnectorException("SELECT_FIELDS", 422);
      var recipients = Objects.requireNonNullElse(request.recipients(), List.<String>of());
      if (recipients.size() > 5 || recipients.stream().anyMatch(r -> r == null || !r.matches(EMAIL))) throw new ConnectorException("RECIPIENT_INVALID", 422);
      String subject = Objects.requireNonNullElse(request.subject(), "").strip();
      if (subject.isEmpty() || subject.length() > 150 || subject.chars().anyMatch(Character::isISOControl)) throw new ConnectorException("SUBJECT_INVALID", 422);
      String note = Objects.requireNonNullElse(request.note(), "").strip();
      if (note.length() > 1000 || note.chars().anyMatch(c -> Character.isISOControl(c) && c != '\n')) throw new ConnectorException("NOTE_INVALID", 422);
      var body = new StringBuilder();
      if (!note.isEmpty()) body.append(note).append("\n\n");
      body.append("Reviewed fields from ").append(IntakeChecks.displayText(doc.name(), 120)).append(":\n");
      for (String label : labels) {
        CreditCase.Field field = doc.fields().stream().filter(f -> f.label().equals(label)).findFirst()
            .orElseThrow(() -> new ConnectorException("FIELD_NOT_FOUND", 422));
        body.append("- ").append(label).append(": ").append(IntakeChecks.displayText(field.value(), 200)).append(" (page ").append(field.page()).append(")\n");
        if (request.includeEvidenceExcerpts()) body.append("  Evidence: \"").append(IntakeChecks.displayText(field.evidence(), 200)).append("\"\n");
      }
      body.append("\n").append(NOTICE).append(" This is a draft; nothing was sent.");
      String text = body.toString(), hash = IntakeChecks.sha256(String.join(",", recipients) + "\n" + subject + "\n" + text);
      String id = "draft-" + UUID.randomUUID();
      var row = new LinkedHashMap<String, Object>();
      row.put("id", id); row.put("status", "PENDING"); row.put("actor", actor); row.put("documentId", doc.id()); row.put("fields", labels);
      row.put("recipients", List.copyOf(recipients)); row.put("subject", subject); row.put("body", text); row.put("contentHash", hash);
      row.put("includeEvidenceExcerpts", request.includeEvidenceExcerpts()); row.put("time", Instant.now().toString());
      row.put("expiresAt", Instant.now().plusSeconds(900).toString());
      store.insert(tenant, caseId, "destination-preview", id, row);
      accounts.audit(tenant, caseId, actor, "DRAFT_PREVIEWED", "gmail-draft", Map.of("previewId", id, "fields", labels.size(), "evidenceExcerpts", request.includeEvidenceExcerpts()));
      return Map.of("previewId", id, "contentHash", hash, "recipients", recipients, "subject", subject, "body", text, "expiresAt", row.get("expiresAt"), "sends", false);
    }

    public Map<String, Object> approve(String tenant, String caseId, String approver, String previewId, String contentHash, boolean confirmed) {
      if (!confirmed) throw new ConnectorException("APPROVAL_REQUIRED", 422);
      cases.require(tenant, caseId);
      var preview = store.find(tenant, caseId, "destination-preview", Objects.requireNonNullElse(previewId, ""))
          .orElseThrow(() -> new ConnectorException("PREVIEW_NOT_FOUND", 404));
      if (!"PENDING".equals(preview.get("status"))) throw new ConnectorException("PREVIEW_ALREADY_PROCESSED", 409);
      if (Instant.parse(String.valueOf(preview.get("expiresAt"))).isBefore(Instant.now())) throw new ConnectorException("PREVIEW_EXPIRED", 410);
      if (!String.valueOf(preview.get("contentHash")).equals(contentHash)) throw new ConnectorException("PREVIEW_CHANGED", 409);
      var credential = accounts.credential(tenant, approver, GoogleClient.PROVIDER).orElseThrow(() -> new ConnectorException("CONNECTOR_NOT_CONNECTED", 409));
      if (!credential.has(GoogleClient.GMAIL_COMPOSE)) throw new ConnectorException("SCOPE_NOT_GRANTED", 409);
      var claimed = new LinkedHashMap<>(preview); claimed.put("status", "CREATING"); claimed.put("approvedBy", approver); claimed.put("approvedAt", Instant.now().toString());
      if (!store.replace(tenant, caseId, "destination-preview", previewId, preview, claimed)) throw new ConnectorException("PREVIEW_ALREADY_PROCESSED", 409);
      try {
        @SuppressWarnings("unchecked") var recipients = (List<String>) preview.get("recipients");
        String raw = rawMessage(recipients, String.valueOf(preview.get("subject")), String.valueOf(preview.get("body")));
        var created = google.postJson(tenant, approver, OutboundPolicy.join(google.gmailBase(), "/users/me/drafts", Map.of()), Map.of("message", Map.of("raw", raw)));
        String draftId = created.path("id").asText("");
        var done = new LinkedHashMap<>(claimed); done.put("status", "DRAFT_CREATED"); done.put("draftId", draftId);
        store.replace(tenant, caseId, "destination-preview", previewId, claimed, done);
        accounts.audit(tenant, caseId, approver, "DRAFT_CREATED", "gmail-draft", Map.of("previewId", previewId, "draftId", draftId, "contentHash", contentHash, "approvedBy", approver));
        return Map.of("status", "DRAFT_CREATED", "draftId", draftId, "sent", false);
      } catch (ConnectorException e) {
        var failed = new LinkedHashMap<>(claimed); failed.put("status", "FAILED"); failed.put("errorCode", e.code());
        store.replace(tenant, caseId, "destination-preview", previewId, claimed, failed);
        accounts.audit(tenant, caseId, approver, "DRAFT_FAILED", "gmail-draft", Map.of("previewId", previewId, "code", e.code()));
        throw e;
      }
    }

    /** RFC 5322 message with encoded headers; recipients and subject were already checked for CR/LF. */
    static String rawMessage(List<String> recipients, String subject, String body) {
      var message = new StringBuilder();
      if (!recipients.isEmpty()) message.append("To: ").append(String.join(", ", recipients)).append("\r\n");
      message.append("Subject: =?UTF-8?B?").append(Base64.getEncoder().encodeToString(subject.getBytes(StandardCharsets.UTF_8))).append("?=\r\n");
      message.append("MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n");
      message.append(Base64.getMimeEncoder(76, "\r\n".getBytes(StandardCharsets.US_ASCII)).encodeToString(body.getBytes(StandardCharsets.UTF_8))).append("\r\n");
      return Base64.getUrlEncoder().withoutPadding().encodeToString(message.toString().getBytes(StandardCharsets.UTF_8));
    }
  }

  /** CSV business data for the deterministic project assessment. Parsed locally; no network call. */
  @Component
  public static class CsvBusinessData implements BusinessDataSource {
    @Override public Descriptor descriptor() {
      return new Descriptor("csv-excel", Kind.BUSINESS_DATA, "CSV (Excel export)", Label.VERIFIED_LOCAL, true, false, false, List.of(),
          List.of("Parse an uploaded CSV with cost, area, revenue and milestone rows"), "Excel files: export as CSV first; .xlsx parsing is not implemented.");
    }
  }
}
