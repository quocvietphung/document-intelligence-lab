package dev.creditlab.sources;

import dev.creditlab.casework.CreditCaseService;
import dev.creditlab.platform.DistributedLimits;
import dev.creditlab.platform.DocumentBatches;
import dev.creditlab.platform.LabStore;
import dev.creditlab.sources.SourceContracts.*;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;

/**
 * One intake path for every document source: case authorization, explicit consent, real MIME detection,
 * a safe name, provenance de-duplication (source, external ID, revision), then the existing durable batch
 * and queue (content hash, ClamAV, extraction, injection quarantine, human review) and the audit trail.
 */
@Service
public class SourceIntake {
  public static final int MAX_ITEMS = 4;
  private final Map<String, DocumentSource> sources = new LinkedHashMap<>();
  private final List<BusinessDataSource> businessData;
  private final List<ResultDestination> destinations;
  private final CreditCaseService cases;
  private final DocumentBatches batches;
  private final LabStore store;
  private final ConnectorAccounts accounts;
  private final DistributedLimits limits;

  public record ImportCommand(String sourceId, String requestId, long caseVersion, List<String> externalIds, String profile, boolean consent) {}

  public SourceIntake(List<DocumentSource> sources, List<BusinessDataSource> businessData, List<ResultDestination> destinations,
      CreditCaseService cases, DocumentBatches batches, LabStore store, ConnectorAccounts accounts, DistributedLimits limits) {
    for (var source : sources) if (sources.stream().filter(s -> s.descriptor().id().equals(source.descriptor().id())).count() > 1)
      throw new IllegalStateException("Duplicate source id " + source.descriptor().id());
    sources.stream().sorted(Comparator.comparingInt(SourceIntake::order)).forEach(s -> this.sources.put(s.descriptor().id(), s));
    this.businessData = List.copyOf(businessData); this.destinations = List.copyOf(destinations);
    this.cases = cases; this.batches = batches; this.store = store; this.accounts = accounts; this.limits = limits;
  }

  private static int order(DocumentSource source) {
    return switch (source.descriptor().id()) {
      case LocalFileSource.ID -> 0; case GmailSource.ID -> 1; case GoogleDriveSource.ID -> 2; case MicrosoftGraphSource.ID -> 3; default -> 9;
    };
  }

  /** Status for the Integrations page. Contains no token, refresh token or document content. */
  public Map<String, Object> overview(String tenant, String actor) {
    var google = accounts.credential(tenant, actor, GoogleClient.PROVIDER);
    var providers = new ArrayList<Map<String, Object>>();
    for (var source : sources.values()) {
      var descriptor = source.descriptor();
      var row = new LinkedHashMap<>(descriptor.toMap());
      if (descriptor.id().equals(GmailSource.ID) || descriptor.id().equals(GoogleDriveSource.ID)) {
        String scope = descriptor.scopes().getFirst();
        row.put("connection", google.map(c -> c.connected() && !c.has(scope) ? "SCOPE_NOT_GRANTED" : c.status()).orElse("DISCONNECTED"));
        row.put("grantedScopes", google.map(c -> c.scopes()).orElse(List.of()));
        row.put("connectedAt", google.map(c -> c.connectedAt()).orElse(null));
      } else row.put("connection", descriptor.requiresConnection() ? "DISCONNECTED" : "NOT_REQUIRED");
      row.put("sync", accounts.stats(tenant, actor, descriptor.id()));
      providers.add(row);
    }
    var result = new LinkedHashMap<String, Object>();
    result.put("tokensInBrowser", false); result.put("automaticSync", false);
    result.put("providers", providers);
    result.put("businessData", businessData.stream().map(d -> d.descriptor().toMap()).toList());
    result.put("destinations", destinations.stream().map(d -> d.descriptor().toMap()).toList());
    return result;
  }

  public Map<String, Object> preview(String tenant, String caseId, String actor, String sourceId, String query, int limit) {
    var source = enabled(sourceId);
    cases.require(tenant, caseId);
    limits.reserve(tenant, actor, "source-preview", 10);
    var request = new SourceRequest(tenant, caseId, actor, query, limit);
    try {
      var items = source.preview(request).stream().map(item -> {
        var row = new LinkedHashMap<>(item.toMap());
        row.put("alreadyImported", store.find(tenant, caseId, "source-import", provenanceId(item.sourceId(), item.externalId(), item.revision())).isPresent());
        return row;
      }).toList();
      accounts.recordSync(tenant, actor, sourceId, items.size(), null, null);
      accounts.audit(tenant, caseId, actor, "SOURCE_PREVIEWED", sourceId, Map.of("items", items.size()));
      return Map.of("sourceId", sourceId, "label", source.descriptor().label().value(), "items", items, "automaticImport", false);
    } catch (ConnectorException e) {
      accounts.recordSync(tenant, actor, sourceId, null, null, e.code());
      throw e;
    }
  }

  public Map<String, Object> importItems(String tenant, String caseId, String actor, ImportCommand command) {
    cases.allowWrite();
    if (cases.require(tenant, caseId).version() != command.caseVersion()) throw new ConnectorException("STALE_CASE", 409);
    if (!command.consent()) throw new ConnectorException("EXPLICIT_PROCESSING_CONSENT_REQUIRED", 422);
    var ids = List.copyOf(new LinkedHashSet<>(Objects.requireNonNullElse(command.externalIds(), List.<String>of())));
    if (ids.isEmpty() || ids.size() > MAX_ITEMS) throw new ConnectorException("SELECT_ONE_TO_FOUR_ITEMS", 422);
    var source = enabled(command.sourceId());
    limits.reserve(tenant, actor, "source-import", 6);
    var request = new SourceRequest(tenant, caseId, actor, "", 20);
    var results = new ArrayList<Map<String, Object>>();
    var inputs = new ArrayList<DocumentBatches.Input>();
    var accepted = new ArrayList<Map<String, Object>>();
    for (String id : ids) {
      var result = new LinkedHashMap<String, Object>(); result.put("externalId", id);
      try {
        var content = source.fetch(request, id);
        String name = IntakeChecks.safeFilename(content.item().name());
        IntakeChecks.requirePdf(content.item().declaredMime(), content.bytes());
        String provenance = provenanceId(content.item().sourceId(), content.item().externalId(), content.item().revision());
        result.put("name", name); result.put("revision", content.item().revision()); result.put("sha256", IntakeChecks.sha256(content.bytes()));
        if (store.find(tenant, caseId, "source-import", provenance).isPresent()) { result.put("state", "DUPLICATE"); result.put("code", "ALREADY_IMPORTED"); }
        else {
          result.put("state", "PENDING"); result.put("provenanceId", provenance);
          result.put("_item", content.item());
          inputs.add(new DocumentBatches.Input(name, "application/pdf", content.bytes()));
          accepted.add(result);
        }
      } catch (ConnectorException e) { result.put("state", "REJECTED"); result.put("code", e.code()); }
      results.add(result);
    }
    Map<String, Object> receipt = null;
    if (!inputs.isEmpty()) {
      String provider = IntakeChecks.displayText(source.descriptor().provider(), 60);
      receipt = batches.submit(tenant, caseId, actor, command.requestId(), provider + " intake",
          provider + " · " + inputs.size() + " item(s) · provenance recorded", command.profile(), inputs);
      @SuppressWarnings("unchecked") var items = (List<Map<String, Object>>) receipt.get("items");
      for (int i = 0; i < accepted.size(); i++) {
        var result = accepted.get(i); var receiptItem = items.get(i);
        String state = String.valueOf(receiptItem.get("state"));
        result.put("state", state);
        if (receiptItem.get("jobId") != null) result.put("jobId", receiptItem.get("jobId"));
        if (receiptItem.get("errorCode") != null) result.put("code", receiptItem.get("errorCode"));
        var item = (SourceItem) result.remove("_item");
        if ("ACCEPTED".equals(state)) recordProvenance(tenant, caseId, actor, item, result, String.valueOf(receipt.get("id")));
      }
    }
    accepted.forEach(r -> r.remove("_item"));
    int acceptedCount = (int) results.stream().filter(r -> "ACCEPTED".equals(r.get("state"))).count();
    String firstError = results.stream().map(r -> (String) r.get("code")).filter(Objects::nonNull).filter(c -> !c.equals("ALREADY_IMPORTED")).findFirst().orElse(null);
    accounts.recordSync(tenant, actor, command.sourceId(), null, acceptedCount, firstError);
    accounts.audit(tenant, caseId, actor, "SOURCE_IMPORTED", command.sourceId(), Map.of("requested", ids.size(), "accepted", acceptedCount,
        "duplicate", results.stream().filter(r -> "DUPLICATE".equals(r.get("state"))).count(),
        "rejected", results.stream().filter(r -> "REJECTED".equals(r.get("state"))).count(),
        "batchId", receipt == null ? "" : String.valueOf(receipt.get("id"))));
    var response = new LinkedHashMap<String, Object>();
    response.put("sourceId", command.sourceId()); response.put("items", results);
    response.put("batchId", receipt == null ? null : receipt.get("id"));
    response.put("next", "Follow the jobs in Data Pipelines, then review fields and evidence in Documents & review.");
    return response;
  }

  public Map<String, Object> imports(String tenant, String caseId) {
    cases.require(tenant, caseId);
    return Map.of("imports", store.list(tenant, caseId, "source-import"), "audit", accounts.auditTrail(tenant, caseId));
  }

  static String provenanceId(String sourceId, String externalId, String revision) {
    return "src-" + IntakeChecks.sha256(sourceId + "|" + externalId + "|" + revision).substring(0, 48);
  }

  private void recordProvenance(String tenant, String caseId, String actor, SourceItem item, Map<String, Object> result, String batchId) {
    var row = new LinkedHashMap<String, Object>();
    row.put("id", result.get("provenanceId")); row.put("time", Instant.now().toString()); row.put("actor", actor);
    row.put("sourceId", item.sourceId()); row.put("externalId", item.externalId()); row.put("revision", item.revision());
    row.put("sha256", result.get("sha256")); row.put("name", result.get("name")); row.put("link", item.link());
    row.put("metadata", item.metadata()); row.put("batchId", batchId); row.put("jobId", result.getOrDefault("jobId", ""));
    row.put("label", sources.get(item.sourceId()).descriptor().label().value());
    store.insert(tenant, caseId, "source-import", String.valueOf(result.get("provenanceId")), row);
  }

  private DocumentSource enabled(String sourceId) {
    var source = sources.get(Objects.requireNonNullElse(sourceId, ""));
    if (source == null) throw new ConnectorException("UNKNOWN_SOURCE", 404);
    if (source.descriptor().label() == Label.FUTURE) throw new ConnectorException("CONNECTOR_NOT_IMPLEMENTED", 501);
    if (!source.descriptor().enabled()) throw new ConnectorException("CONNECTOR_NOT_CONFIGURED", 503);
    return source;
  }

  public Collection<DocumentSource> sources() { return sources.values(); }

  public void requireCase(String tenant, String caseId) { cases.require(tenant, caseId); }
}
