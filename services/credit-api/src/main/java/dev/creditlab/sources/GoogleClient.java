package dev.creditlab.sources;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.sources.SourceContracts.ConnectorException;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Server-side Google OAuth 2.0 (authorization code + PKCE + single-use state) and a bounded API client.
 * Refresh tokens are stored encrypted; access tokens live only in memory. Tokens never reach the browser,
 * logs or error messages. Every endpoint is validated against an exact HTTPS host allowlist.
 */
@Component
public class GoogleClient {
  public static final String GMAIL_READ = "https://www.googleapis.com/auth/gmail.readonly";
  public static final String GMAIL_COMPOSE = "https://www.googleapis.com/auth/gmail.compose";
  public static final String DRIVE_READ = "https://www.googleapis.com/auth/drive.readonly";
  public static final String PROVIDER = "google";
  static final Set<String> HOSTS = Set.of("accounts.google.com", "oauth2.googleapis.com", "gmail.googleapis.com", "www.googleapis.com");
  private static final int MAX_JSON = 6_000_000;

  interface Sleeper { void sleep(long millis) throws InterruptedException; }
  record Cached(String token, Instant expiresAt) {}
  public record TokenGrant(String accessToken, String refreshToken, long expiresIn, List<String> scopes) {
    @Override public String toString() { return "TokenGrant[scopes=" + scopes + ", tokens=" + TokenVault.redact(accessToken) + "]"; }
  }

  private final String clientId, clientSecret, redirectUri;
  private final URI authUrl, tokenUrl, revokeUrl, gmailBase, driveBase;
  private final ConnectorAccounts accounts;
  private final TokenVault vault;
  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NEVER).build();
  private final ObjectMapper json = new ObjectMapper();
  private final Map<String, Cached> accessTokens = new ConcurrentHashMap<>();
  Sleeper sleeper = Thread::sleep;

  public GoogleClient(ConnectorAccounts accounts, TokenVault vault,
      @Value("${app.connectors.google.client-id:}") String clientId,
      @Value("${app.connectors.google.client-secret:}") String clientSecret,
      @Value("${app.connectors.google.redirect-uri:}") String redirectUri,
      @Value("${app.connectors.google.auth-url:https://accounts.google.com/o/oauth2/v2/auth}") String authUrl,
      @Value("${app.connectors.google.token-url:https://oauth2.googleapis.com/token}") String tokenUrl,
      @Value("${app.connectors.google.revoke-url:https://oauth2.googleapis.com/revoke}") String revokeUrl,
      @Value("${app.connectors.google.gmail-base:https://gmail.googleapis.com/gmail/v1}") String gmailBase,
      @Value("${app.connectors.google.drive-base:https://www.googleapis.com/drive/v3}") String driveBase,
      @Value("${app.connectors.google.allow-loopback-test-endpoints:false}") boolean allowLoopback) {
    this.accounts = accounts; this.vault = vault;
    this.clientId = clientId.strip(); this.clientSecret = clientSecret.strip(); this.redirectUri = redirectUri.strip();
    this.authUrl = OutboundPolicy.requireAllowed(authUrl, HOSTS, Set.of(), allowLoopback);
    this.tokenUrl = OutboundPolicy.requireAllowed(tokenUrl, HOSTS, Set.of(), allowLoopback);
    this.revokeUrl = OutboundPolicy.requireAllowed(revokeUrl, HOSTS, Set.of(), allowLoopback);
    this.gmailBase = OutboundPolicy.requireAllowed(gmailBase, HOSTS, Set.of(), allowLoopback);
    this.driveBase = OutboundPolicy.requireAllowed(driveBase, HOSTS, Set.of(), allowLoopback);
    if (!this.redirectUri.isEmpty()) validateRedirectUri(this.redirectUri);
  }

  /** Google requires an exact match; this app accepts only HTTPS or a loopback development callback. */
  static void validateRedirectUri(String value) {
    URI uri = URI.create(value);
    String host = Objects.requireNonNullElse(uri.getHost(), "");
    boolean loopback = Set.of("localhost", "127.0.0.1").contains(host) && "http".equals(uri.getScheme());
    if (!(loopback || "https".equals(uri.getScheme())) || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
        || !Objects.requireNonNullElse(uri.getPath(), "").equals("/oauth/google/callback"))
      throw new IllegalArgumentException("GOOGLE_OAUTH_REDIRECT_URI must be https://<host>/oauth/google/callback or a loopback development URL");
  }

  public boolean configured() { return !clientId.isEmpty() && !clientSecret.isEmpty() && !redirectUri.isEmpty() && vault.configured(); }
  public URI gmailBase() { return gmailBase; }
  public URI driveBase() { return driveBase; }

  public String authorizationUrl(String state, String verifier, List<String> scopes) {
    requireConfigured();
    var query = new LinkedHashMap<String, String>();
    query.put("client_id", clientId); query.put("redirect_uri", redirectUri); query.put("response_type", "code");
    query.put("scope", String.join(" ", scopes)); query.put("state", state);
    query.put("code_challenge", challenge(verifier)); query.put("code_challenge_method", "S256");
    query.put("access_type", "offline"); query.put("prompt", "consent"); query.put("include_granted_scopes", "false");
    return authUrl + "?" + form(query);
  }

  public static String newVerifier() {
    byte[] raw = new byte[48]; new java.security.SecureRandom().nextBytes(raw);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
  }

  static String challenge(String verifier) {
    try { return Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII))); }
    catch (Exception e) { throw new IllegalStateException(e); }
  }

  public TokenGrant exchange(String code, String verifier) {
    requireConfigured();
    if (code == null || code.isBlank() || code.length() > 512 || code.chars().anyMatch(Character::isISOControl)) throw new ConnectorException("OAUTH_CODE_INVALID", 422);
    var body = new LinkedHashMap<String, String>();
    body.put("code", code); body.put("client_id", clientId); body.put("client_secret", clientSecret);
    body.put("redirect_uri", redirectUri); body.put("grant_type", "authorization_code"); body.put("code_verifier", verifier);
    JsonNode node = tokenRequest(body, "OAUTH_EXCHANGE_FAILED");
    return grant(node);
  }

  /** Best effort: a failed revocation still removes the local secret; the user can also revoke in their Google account. */
  public boolean revoke(String tenant, String actor) {
    try {
      String token = accounts.refreshToken(tenant, actor, PROVIDER);
      var request = HttpRequest.newBuilder(revokeUrl).timeout(Duration.ofSeconds(15)).header("Content-Type", "application/x-www-form-urlencoded")
          .POST(HttpRequest.BodyPublishers.ofString(form(Map.of("token", token)))).build();
      return http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode() == 200;
    } catch (Exception e) { return false; }
    finally { accessTokens.remove(tenant + "|" + actor); }
  }

  public JsonNode getJson(String tenant, String actor, String url) {
    return parse(send(tenant, actor, token -> HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(30))
        .header("Authorization", "Bearer " + token).header("Accept", "application/json").GET().build(), MAX_JSON));
  }

  public byte[] download(String tenant, String actor, String url, int maxBytes) {
    return send(tenant, actor, token -> HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(60))
        .header("Authorization", "Bearer " + token).GET().build(), maxBytes);
  }

  public JsonNode postJson(String tenant, String actor, String url, Object body) {
    final String payload;
    try { payload = json.writeValueAsString(body); } catch (Exception e) { throw new IllegalStateException(e); }
    // A POST is not repeated after an uncertain network failure, so a draft is never created twice.
    return parse(send(tenant, actor, token -> HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(30))
        .header("Authorization", "Bearer " + token).header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(payload)).build(), MAX_JSON, false));
  }

  private byte[] send(String tenant, String actor, Function<String, HttpRequest> build, int maxBytes) { return send(tenant, actor, build, maxBytes, true); }

  private byte[] send(String tenant, String actor, Function<String, HttpRequest> build, int maxBytes, boolean idempotent) {
    boolean refreshed = false;
    for (int attempt = 1; ; attempt++) {
      HttpResponse<java.io.InputStream> response;
      try { response = http.send(build.apply(accessToken(tenant, actor)), HttpResponse.BodyHandlers.ofInputStream()); }
      catch (IOException e) {
        if (idempotent && attempt < 3) { pause(attempt, null); continue; }
        throw new ConnectorException("SOURCE_UNAVAILABLE", 503);
      } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new ConnectorException("SOURCE_UNAVAILABLE", 503); }
      int status = response.statusCode();
      byte[] body = read(response, maxBytes);
      if (status >= 200 && status < 300) return body;
      if (status == 401 && !refreshed) { accessTokens.remove(tenant + "|" + actor); refreshed = true; attempt--; continue; }
      if (status == 401) { accounts.markReauthRequired(tenant, actor, PROVIDER, "TOKEN_EXPIRED_OR_REVOKED"); throw new ConnectorException("CONNECTOR_REAUTH_REQUIRED", 409); }
      String reason = errorReason(body);
      boolean rate = status == 429 || (status == 403 && reason.contains("ratelimitexceeded"));
      if ((rate || status >= 500) && idempotent && attempt < 3) { pause(attempt, response.headers().firstValue("Retry-After").orElse(null)); continue; }
      if (rate) throw new ConnectorException("SOURCE_RATE_LIMITED", 429);
      if (status == 403 && (reason.contains("insufficient") || reason.contains("scope"))) throw new ConnectorException("SCOPE_NOT_GRANTED", 409);
      if (status == 403) throw new ConnectorException("SOURCE_ACCESS_DENIED", 403);
      if (status == 404) throw new ConnectorException("SOURCE_ITEM_NOT_FOUND", 404);
      throw new ConnectorException("SOURCE_UNAVAILABLE", status >= 500 ? 503 : 502);
    }
  }

  private String accessToken(String tenant, String actor) {
    String key = tenant + "|" + actor;
    var cached = accessTokens.get(key);
    if (cached != null && cached.expiresAt().isAfter(Instant.now().plusSeconds(60))) return cached.token();
    var body = new LinkedHashMap<String, String>();
    body.put("client_id", clientId); body.put("client_secret", clientSecret); body.put("grant_type", "refresh_token");
    body.put("refresh_token", accounts.refreshToken(tenant, actor, PROVIDER));
    final JsonNode node;
    try { node = tokenRequest(body, "TOKEN_REFRESH_FAILED"); }
    catch (ConnectorException e) {
      if ("TOKEN_EXPIRED_OR_REVOKED".equals(e.code())) { accounts.markReauthRequired(tenant, actor, PROVIDER, e.code()); throw new ConnectorException("CONNECTOR_REAUTH_REQUIRED", 409); }
      throw e;
    }
    var grant = grant(node);
    accessTokens.put(key, new Cached(grant.accessToken(), Instant.now().plusSeconds(Math.max(60, grant.expiresIn()))));
    return grant.accessToken();
  }

  private JsonNode tokenRequest(Map<String, String> body, String failure) {
    try {
      var request = HttpRequest.newBuilder(tokenUrl).timeout(Duration.ofSeconds(20)).header("Content-Type", "application/x-www-form-urlencoded")
          .header("Accept", "application/json").POST(HttpRequest.BodyPublishers.ofString(form(body))).build();
      var response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
      byte[] data = read(response, 100_000);
      if (response.statusCode() == 200) return parse(data);
      if (response.statusCode() == 400 && errorReason(data).contains("invalid_grant")) throw new ConnectorException("TOKEN_EXPIRED_OR_REVOKED", 409);
      throw new ConnectorException(failure, response.statusCode() >= 500 ? 503 : 502);
    } catch (IOException e) { throw new ConnectorException("SOURCE_UNAVAILABLE", 503); }
    catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new ConnectorException("SOURCE_UNAVAILABLE", 503); }
  }

  private static TokenGrant grant(JsonNode node) {
    String access = node.path("access_token").asText("");
    if (access.isBlank()) throw new ConnectorException("OAUTH_EXCHANGE_FAILED", 502);
    List<String> scopes = Arrays.stream(node.path("scope").asText("").split("\\s+")).filter(s -> !s.isBlank()).toList();
    String refresh = node.path("refresh_token").asText("");
    return new TokenGrant(access, refresh.isBlank() ? null : refresh, node.path("expires_in").asLong(3600), scopes);
  }

  private void pause(int attempt, String retryAfter) {
    long millis = Math.min(8_000, 500L * (1L << (attempt - 1)));
    if (retryAfter != null && retryAfter.matches("\\d{1,4}")) millis = Math.min(8_000, Long.parseLong(retryAfter) * 1000);
    try { sleeper.sleep(millis); } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new ConnectorException("SOURCE_UNAVAILABLE", 503); }
  }

  private static byte[] read(HttpResponse<java.io.InputStream> response, int maxBytes) {
    try (var input = response.body()) {
      byte[] data = input.readNBytes(maxBytes + 1);
      if (data.length > maxBytes) throw new ConnectorException("FILE_TOO_LARGE", 422);
      return data;
    } catch (IOException e) { throw new ConnectorException("SOURCE_UNAVAILABLE", 503); }
  }

  private JsonNode parse(byte[] data) {
    try { return json.readTree(data); } catch (IOException e) { throw new ConnectorException("SOURCE_RESPONSE_INVALID", 502); }
  }

  private String errorReason(byte[] body) {
    try {
      JsonNode node = json.readTree(body);
      var text = new StringBuilder(node.path("error").isTextual() ? node.path("error").asText() : "");
      node.path("error").path("errors").forEach(e -> text.append(' ').append(e.path("reason").asText()));
      text.append(' ').append(node.path("error").path("status").asText(""));
      return text.toString().toLowerCase(Locale.ROOT);
    } catch (Exception e) { return ""; }
  }

  private void requireConfigured() { if (!configured()) throw new ConnectorException("CONNECTOR_NOT_CONFIGURED", 503); }

  private static String form(Map<String, String> values) {
    var out = new StringJoiner("&");
    values.forEach((k, v) -> out.add(URLEncoder.encode(k, StandardCharsets.UTF_8) + "=" + URLEncoder.encode(v, StandardCharsets.UTF_8)));
    return out.toString();
  }
}
