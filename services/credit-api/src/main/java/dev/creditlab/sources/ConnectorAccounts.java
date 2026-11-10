package dev.creditlab.sources;

import dev.creditlab.platform.LabStore;
import dev.creditlab.sources.SourceContracts.ConnectorException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;

/**
 * Per-tenant, per-user connector state: encrypted credentials, single-use OAuth state, sync statistics and
 * the connector audit trail. Nothing here is ever returned to the browser except status and counts.
 */
@Service
public class ConnectorAccounts {
  /** Reserved scope for tenant-level records that do not belong to a dossier. */
  public static final String TENANT_SCOPE = "__connectors__";
  private static final SecureRandom RANDOM = new SecureRandom();
  private final LabStore store;
  private final TokenVault vault;

  public ConnectorAccounts(LabStore store, TokenVault vault) { this.store = store; this.vault = vault; }

  public record Credential(String provider, String status, List<String> scopes, String connectedAt, String lastError) {
    public boolean connected() { return "CONNECTED".equals(status); }
    public boolean has(String scope) { return connected() && scopes.contains(scope); }
  }
  public record PendingAuthorization(String provider, String verifier, List<String> scopes) {}

  static String userKey(String actor) { return IntakeChecks.sha256("actor|" + actor).substring(0, 32); }
  private static String binding(String tenant, String actor, String provider) { return tenant + "|" + userKey(actor) + "|" + provider; }
  private static String credentialId(String actor, String provider) { return provider + ":" + userKey(actor); }

  public Optional<Credential> credential(String tenant, String actor, String provider) {
    return store.find(tenant, TENANT_SCOPE, "connector-credential", credentialId(actor, provider)).map(row -> new Credential(provider,
        String.valueOf(row.getOrDefault("status", "DISCONNECTED")), strings(row.get("scopes")),
        (String) row.get("connectedAt"), (String) row.get("lastError")));
  }

  /** Decrypts the refresh token only for a server-side token exchange; never logged or returned. */
  public String refreshToken(String tenant, String actor, String provider) {
    var row = store.find(tenant, TENANT_SCOPE, "connector-credential", credentialId(actor, provider))
        .orElseThrow(() -> new ConnectorException("CONNECTOR_NOT_CONNECTED", 409));
    if (!"CONNECTED".equals(row.get("status"))) throw new ConnectorException("CONNECTOR_REAUTH_REQUIRED", 409);
    return vault.open(String.valueOf(row.get("sealedRefreshToken")), binding(tenant, actor, provider));
  }

  public void connect(String tenant, String actor, String provider, String refreshToken, List<String> scopes) {
    if (refreshToken == null || refreshToken.isBlank()) throw new ConnectorException("CONNECTOR_NO_REFRESH_TOKEN", 422);
    var row = new LinkedHashMap<String, Object>();
    row.put("provider", provider); row.put("status", "CONNECTED"); row.put("scopes", List.copyOf(new TreeSet<>(scopes)));
    row.put("sealedRefreshToken", vault.seal(refreshToken, binding(tenant, actor, provider)));
    row.put("connectedAt", Instant.now().toString());
    upsert(tenant, TENANT_SCOPE, "connector-credential", credentialId(actor, provider), row);
  }

  public void markReauthRequired(String tenant, String actor, String provider, String code) {
    store.find(tenant, TENANT_SCOPE, "connector-credential", credentialId(actor, provider)).ifPresent(row -> {
      var next = new LinkedHashMap<>(row); next.put("status", "REAUTH_REQUIRED"); next.put("lastError", code);
      upsert(tenant, TENANT_SCOPE, "connector-credential", credentialId(actor, provider), next);
    });
  }

  /** Removes the stored secret. The caller revokes it at the provider first, best effort. */
  public void disconnect(String tenant, String actor, String provider) {
    var row = new LinkedHashMap<String, Object>();
    row.put("provider", provider); row.put("status", "DISCONNECTED"); row.put("scopes", List.of());
    upsert(tenant, TENANT_SCOPE, "connector-credential", credentialId(actor, provider), row);
  }

  /** Creates single-use OAuth state bound to this tenant and user; the PKCE verifier stays server-side. */
  public String beginAuthorization(String tenant, String actor, String provider, String verifier, List<String> scopes) {
    byte[] raw = new byte[32]; RANDOM.nextBytes(raw);
    String state = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
    var row = new LinkedHashMap<String, Object>();
    row.put("provider", provider); row.put("user", userKey(actor)); row.put("scopes", List.copyOf(scopes));
    row.put("sealedVerifier", vault.seal(verifier, binding(tenant, actor, provider) + "|pkce"));
    row.put("expiresAt", Instant.now().plusSeconds(600).toString()); row.put("used", false);
    if (!store.insert(tenant, TENANT_SCOPE, "oauth-state", IntakeChecks.sha256(state), row)) throw new IllegalStateException("State collision");
    return state;
  }

  public PendingAuthorization completeAuthorization(String tenant, String actor, String state) {
    if (state == null || !state.matches("[A-Za-z0-9_-]{40,64}")) throw new ConnectorException("OAUTH_STATE_INVALID", 422);
    String id = IntakeChecks.sha256(state);
    var row = store.find(tenant, TENANT_SCOPE, "oauth-state", id).orElseThrow(() -> new ConnectorException("OAUTH_STATE_INVALID", 422));
    if (!userKey(actor).equals(row.get("user"))) throw new ConnectorException("OAUTH_STATE_INVALID", 422);
    if (Boolean.TRUE.equals(row.get("used"))) throw new ConnectorException("OAUTH_STATE_REUSED", 422);
    if (Instant.parse(String.valueOf(row.get("expiresAt"))).isBefore(Instant.now())) throw new ConnectorException("OAUTH_STATE_EXPIRED", 422);
    var used = new LinkedHashMap<>(row); used.put("used", true);
    if (!store.replace(tenant, TENANT_SCOPE, "oauth-state", id, row, used)) throw new ConnectorException("OAUTH_STATE_REUSED", 422);
    String provider = String.valueOf(row.get("provider"));
    return new PendingAuthorization(provider, vault.open(String.valueOf(row.get("sealedVerifier")), binding(tenant, actor, provider) + "|pkce"), strings(row.get("scopes")));
  }

  /** Last explicit sync per user and source: counts and a stable error code, never document data. */
  public void recordSync(String tenant, String actor, String sourceId, Integer found, Integer imported, String errorCode) {
    String id = sourceId + ":" + userKey(actor);
    var previous = store.find(tenant, TENANT_SCOPE, "connector-stats", id).orElse(Map.of());
    var row = new LinkedHashMap<String, Object>(previous);
    if (errorCode == null) row.put("lastSuccessAt", Instant.now().toString());
    if (found != null) row.put("found", found);
    if (imported != null) row.put("imported", ((Number) previous.getOrDefault("imported", 0)).intValue() + imported);
    if (errorCode == null) row.remove("lastError");
    else { row.put("lastError", errorCode); row.put("lastErrorAt", Instant.now().toString()); }
    upsert(tenant, TENANT_SCOPE, "connector-stats", id, row);
  }

  public Map<String, Object> stats(String tenant, String actor, String sourceId) {
    return store.find(tenant, TENANT_SCOPE, "connector-stats", sourceId + ":" + userKey(actor)).orElse(Map.of());
  }

  /** Append-only audit event. Details carry identifiers, counts and codes, never tokens or document text. */
  public void audit(String tenant, String caseId, String actor, String event, String sourceId, Map<String, Object> details) {
    var row = new LinkedHashMap<String, Object>();
    row.put("id", "audit-" + UUID.randomUUID()); row.put("time", Instant.now().toString()); row.put("actor", actor);
    row.put("event", event); row.put("sourceId", Objects.requireNonNullElse(sourceId, "")); row.put("details", Map.copyOf(details));
    store.insert(tenant, caseId == null ? TENANT_SCOPE : caseId, "connector-audit", row.get("id").toString(), row);
  }

  public List<Map<String, Object>> auditTrail(String tenant, String caseId) {
    return store.list(tenant, caseId == null ? TENANT_SCOPE : caseId, "connector-audit");
  }

  private void upsert(String tenant, String scope, String kind, String id, Map<String, Object> next) {
    for (int attempt = 0; attempt < 5; attempt++) {
      var current = store.find(tenant, scope, kind, id);
      if (current.isEmpty() ? store.insert(tenant, scope, kind, id, next) : store.replace(tenant, scope, kind, id, current.get(), next)) return;
    }
    throw new ConnectorException("CONNECTOR_STATE_CONFLICT", 409);
  }

  @SuppressWarnings("unchecked")
  private static List<String> strings(Object value) {
    return value instanceof List<?> list ? list.stream().map(String::valueOf).toList() : List.of();
  }
}
