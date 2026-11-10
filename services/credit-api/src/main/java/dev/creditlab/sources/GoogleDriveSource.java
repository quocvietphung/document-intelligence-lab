package dev.creditlab.sources;

import com.fasterxml.jackson.databind.JsonNode;
import dev.creditlab.sources.SourceContracts.*;
import java.util.*;
import org.springframework.stereotype.Component;

/**
 * Read-only Google Drive source (scope drive.readonly). Lists PDFs in a folder or by name across My Drive
 * and shared drives the user can access, honours {@code capabilities.canDownload}, and records file ID and
 * revision. It never edits, moves, deletes, copies or shares a file.
 */
@Component
public class GoogleDriveSource implements DocumentSource {
  public static final String ID = "google-drive";
  private static final String FIELDS = "id,name,mimeType,size,headRevisionId,version,modifiedTime,driveId,ownedByMe,webViewLink,capabilities/canDownload";
  private final GoogleClient google;
  private final ConnectorAccounts accounts;

  public GoogleDriveSource(GoogleClient google, ConnectorAccounts accounts) { this.google = google; this.accounts = accounts; }

  @Override public Descriptor descriptor() {
    return new Descriptor(ID, Kind.DOCUMENT_SOURCE, "Google Drive", Label.IMPLEMENTED_NOT_LIVE_VERIFIED, google.configured(), google.configured(), true,
        List.of(GoogleClient.DRIVE_READ),
        List.of("Read PDF metadata and content in My Drive and shared drives you can access", "Never edits, moves, deletes or shares files"),
        "Tested with a mocked Drive API only. drive.readonly is broader than drive.file; see the connector guide.");
  }

  /** Query forms: {@code folder:<folderId>} or free text matched against the file name. */
  static String driveQuery(String query) {
    var clauses = new ArrayList<>(List.of("mimeType='application/pdf'", "trashed=false"));
    String value = Objects.requireNonNullElse(query, "").strip();
    if (value.startsWith("folder:")) {
      String folder = value.substring(7).strip();
      if (!folder.matches("[A-Za-z0-9_-]{10,128}")) throw new ConnectorException("INVALID_QUERY", 422);
      clauses.add("'" + folder + "' in parents");
    } else if (!value.isEmpty()) {
      clauses.add("name contains '" + value.replace("\\", "\\\\").replace("'", "\\'") + "'");
    }
    return String.join(" and ", clauses);
  }

  @Override public List<SourceItem> preview(SourceRequest request) {
    requireScope(request);
    var query = new LinkedHashMap<String, String>();
    query.put("q", driveQuery(request.query())); query.put("pageSize", String.valueOf(request.limit()));
    query.put("supportsAllDrives", "true"); query.put("includeItemsFromAllDrives", "true"); query.put("corpora", "allDrives");
    query.put("fields", "files(" + FIELDS + ")");
    JsonNode files = google.getJson(request.tenant(), request.actor(), OutboundPolicy.join(google.driveBase(), "/files", query)).path("files");
    var items = new ArrayList<SourceItem>();
    for (JsonNode file : files) if (items.size() < request.limit() && file.path("id").asText("").matches("[A-Za-z0-9_-]{10,128}")) items.add(item(file));
    return items;
  }

  @Override public SourceContent fetch(SourceRequest request, String externalId) {
    requireScope(request);
    if (externalId == null || !externalId.matches("[A-Za-z0-9_-]{10,128}")) throw new ConnectorException("INVALID_SOURCE_ITEM", 422);
    String path = "/files/" + OutboundPolicy.segment(externalId);
    JsonNode file = google.getJson(request.tenant(), request.actor(), OutboundPolicy.join(google.driveBase(), path, Map.of("supportsAllDrives", "true", "fields", FIELDS)));
    var item = item(file);
    if (!"application/pdf".equals(item.declaredMime())) throw new ConnectorException("MIME_MISMATCH", 422);
    if (!file.path("capabilities").path("canDownload").asBoolean(false)) throw new ConnectorException("SOURCE_DOWNLOAD_NOT_ALLOWED", 403);
    IntakeChecks.requireSize(item.size());
    byte[] bytes = google.download(request.tenant(), request.actor(), OutboundPolicy.join(google.driveBase(), path,
        Map.of("alt", "media", "supportsAllDrives", "true")), IntakeChecks.MAX_BYTES);
    return new SourceContent(item, bytes);
  }

  static SourceItem item(JsonNode file) {
    long size = file.path("size").asLong(0);
    boolean canDownload = file.path("capabilities").path("canDownload").asBoolean(false);
    String revision = file.path("headRevisionId").asText("");
    if (revision.isBlank()) revision = "v" + file.path("version").asText("0");
    String link = file.path("webViewLink").asText("");
    var metadata = new LinkedHashMap<String, String>();
    metadata.put("modifiedTime", IntakeChecks.displayText(file.path("modifiedTime").asText(""), 40));
    metadata.put("drive", file.path("driveId").asText("").isBlank() ? "my-drive" : "shared-drive");
    metadata.put("ownedByMe", String.valueOf(file.path("ownedByMe").asBoolean(false)));
    metadata.put("canDownload", String.valueOf(canDownload));
    return new SourceItem(ID, file.path("id").asText(), revision, IntakeChecks.displayText(file.path("name").asText("document.pdf"), 120),
        file.path("mimeType").asText(""), size, canDownload && size > 0 && size <= IntakeChecks.MAX_BYTES,
        link.startsWith("https://drive.google.com/") ? link : "", metadata);
  }

  private void requireScope(SourceRequest request) {
    if (!google.configured()) throw new ConnectorException("CONNECTOR_NOT_CONFIGURED", 503);
    var credential = accounts.credential(request.tenant(), request.actor(), GoogleClient.PROVIDER)
        .orElseThrow(() -> new ConnectorException("CONNECTOR_NOT_CONNECTED", 409));
    if ("REAUTH_REQUIRED".equals(credential.status())) throw new ConnectorException("CONNECTOR_REAUTH_REQUIRED", 409);
    if (!credential.connected()) throw new ConnectorException("CONNECTOR_NOT_CONNECTED", 409);
    if (!credential.has(GoogleClient.DRIVE_READ)) throw new ConnectorException("SCOPE_NOT_GRANTED", 409);
  }
}
