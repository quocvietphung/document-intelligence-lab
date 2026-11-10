package dev.creditlab.sources;

import com.fasterxml.jackson.annotation.JsonValue;
import java.util.*;

/**
 * Provider-neutral contracts. Adapters only list and fetch documents, read business data, or deliver an
 * approved result. Every fetched document then enters the shared pipeline (checks, hash, ClamAV, queue,
 * extraction, evidence, review, audit); no adapter carries its own OCR, RAG, queue or review logic.
 */
public final class SourceContracts {
  private SourceContracts() {}

  /** Honest capability labels. Configuration alone never upgrades a label. */
  public enum Label {
    VERIFIED_LOCAL("verified-local"), SIMULATED("simulated"),
    IMPLEMENTED_NOT_LIVE_VERIFIED("implemented-not-live-verified"), LIVE_VERIFIED("live-verified"), FUTURE("future");
    private final String value;
    Label(String value) { this.value = value; }
    @JsonValue public String value() { return value; }
  }

  public enum Kind {
    DOCUMENT_SOURCE("document-source"), BUSINESS_DATA("business-data"), DESTINATION("destination");
    private final String value;
    Kind(String value) { this.value = value; }
    @JsonValue public String value() { return value; }
  }

  /**
   * What the UI may show about an adapter. {@code live} is true only for a real provider connection, never
   * for fixtures or mocks. Scopes and permissions describe what is requested, not what was granted.
   */
  public record Descriptor(String id, Kind kind, String provider, Label label, boolean enabled, boolean live,
      boolean requiresConnection, List<String> scopes, List<String> permissions, String note) {
    public Descriptor {
      scopes = List.copyOf(scopes); permissions = List.copyOf(permissions);
      if (label == Label.FUTURE && enabled) throw new IllegalArgumentException("Future adapters stay disabled");
      if (live && label != Label.LIVE_VERIFIED && label != Label.IMPLEMENTED_NOT_LIVE_VERIFIED)
        throw new IllegalArgumentException("Simulated or local adapters are never live");
    }
    public Map<String, Object> toMap() {
      var map = new LinkedHashMap<String, Object>();
      map.put("id", id); map.put("kind", kind.value()); map.put("provider", provider); map.put("label", label.value());
      map.put("enabled", enabled); map.put("live", live); map.put("requiresConnection", requiresConnection);
      map.put("scopes", scopes); map.put("permissions", permissions); map.put("note", note);
      return map;
    }
  }

  /** A bounded, explicit request made by an authenticated user for one dossier. */
  public record SourceRequest(String tenant, String caseId, String actor, String query, int limit) {
    public SourceRequest {
      Objects.requireNonNull(tenant); Objects.requireNonNull(caseId); Objects.requireNonNull(actor);
      query = query == null ? "" : query.strip();
      if (query.length() > 200 || query.chars().anyMatch(Character::isISOControl)) throw new ConnectorException("INVALID_QUERY", 422);
      limit = Math.max(1, Math.min(20, limit));
    }
  }

  /**
   * A document seen at the source. {@code externalId} is stable for the provider object; {@code revision}
   * changes when the content may have changed. Names and metadata are untrusted provider data.
   */
  public record SourceItem(String sourceId, String externalId, String revision, String name, String declaredMime, long size,
      boolean canDownload, String link, Map<String, String> metadata) {
    public SourceItem { metadata = Map.copyOf(metadata); }
    public Map<String, Object> toMap() {
      var map = new LinkedHashMap<String, Object>();
      map.put("sourceId", sourceId); map.put("externalId", externalId); map.put("revision", revision); map.put("name", name);
      map.put("declaredMime", declaredMime); map.put("size", size); map.put("canDownload", canDownload);
      map.put("link", link); map.put("metadata", metadata);
      return map;
    }
  }

  public record SourceContent(SourceItem item, byte[] bytes) {}

  public interface DocumentSource {
    Descriptor descriptor();
    List<SourceItem> preview(SourceRequest request);
    SourceContent fetch(SourceRequest request, String externalId);
  }

  /** Structured business data used by deterministic calculations, never by a model as ground truth. */
  public interface BusinessDataSource {
    Descriptor descriptor();
  }

  /** A destination delivers only content that a person previewed and approved. */
  public interface ResultDestination {
    Descriptor descriptor();
  }

  /** A stable, user-facing failure code. Provider responses, tokens and document text never appear in it. */
  public static final class ConnectorException extends RuntimeException {
    private final String code; private final int status;
    public ConnectorException(String code, int status) { super(code); this.code = code; this.status = status; }
    public String code() { return code; }
    public int status() { return status; }
  }
}
