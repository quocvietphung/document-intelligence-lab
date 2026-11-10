package dev.creditlab.sources;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import dev.creditlab.platform.LabStore;
import dev.creditlab.sources.SourceContracts.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.core.io.ClassPathResource;

/** OAuth, Gmail and Drive adapters against a loopback mock. CI needs no Google credential. */
class GoogleConnectorsTest {
  static final String KEY = Base64.getEncoder().encodeToString("0123456789abcdef0123456789abcdef".getBytes());
  final ObjectMapper json = new ObjectMapper();
  LabStore store; TokenVault vault; ConnectorAccounts accounts; GoogleMockServer mock; GoogleClient google; GmailSource gmail; GoogleDriveSource drive;
  byte[] pdf;

  @BeforeEach void setup() throws Exception {
    store = new LabStore(Optional.empty(), json); vault = new TokenVault(KEY); accounts = new ConnectorAccounts(store, vault);
    mock = new GoogleMockServer(); google = mock.client(accounts, vault);
    gmail = new GmailSource(google, accounts); drive = new GoogleDriveSource(google, accounts);
    pdf = new ClassPathResource("use-cases/email-nachtragsangebot-musterquartier.pdf").getInputStream().readAllBytes();
    JsonNode message = json.readTree(new ClassPathResource("use-cases/email-intake-message.json").getInputStream());
    mock.messages.put("18c2f0a1b2c3d4e5", message);
    mock.attachments.put("ANGjdJ-fixture-attachment-001", pdf);
  }
  @AfterEach void close() { mock.close(); }

  private void connect(String tenant, String actor, String... scopes) { accounts.connect(tenant, actor, GoogleClient.PROVIDER, "rt-" + actor, List.of(scopes)); }
  private SourceRequest request(String actor) { return new SourceRequest("tenant", "case", actor, "", 10); }

  @Test void oauthUsesPkceAndSingleUseStateAndKeepsTokensServerSide() {
    String verifier = GoogleClient.newVerifier();
    var scopes = List.of(GoogleClient.GMAIL_READ);
    String state = accounts.beginAuthorization("tenant", "alice", GoogleClient.PROVIDER, verifier, scopes);
    String url = google.authorizationUrl(state, verifier, scopes);
    assertThat(url).contains("code_challenge=" + GoogleClient.challenge(verifier), "code_challenge_method=S256", "state=" + state,
        "access_type=offline", "response_type=code", "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Foauth%2Fgoogle%2Fcallback");
    assertThat(url).doesNotContain("test-client-secret", verifier);
    assertThatThrownBy(() -> accounts.completeAuthorization("tenant", "bob", state)).hasMessage("OAUTH_STATE_INVALID");
    assertThatThrownBy(() -> accounts.completeAuthorization("other-tenant", "alice", state)).hasMessage("OAUTH_STATE_INVALID");
    var pending = accounts.completeAuthorization("tenant", "alice", state);
    assertThat(pending.verifier()).isEqualTo(verifier);
    assertThatThrownBy(() -> accounts.completeAuthorization("tenant", "alice", state)).hasMessage("OAUTH_STATE_REUSED");
    var grant = google.exchange("good-code", verifier);
    assertThat(mock.lastTokenForm).contains("code_verifier=" + verifier, "grant_type=authorization_code");
    assertThat(grant.toString()).doesNotContain("at-initial", "rt-initial");
    assertThatThrownBy(() -> google.exchange("stolen-code", verifier)).isInstanceOf(ConnectorException.class);
    accounts.connect("tenant", "alice", GoogleClient.PROVIDER, grant.refreshToken(), grant.scopes());
    var row = store.find("tenant", ConnectorAccounts.TENANT_SCOPE, "connector-credential", "google:" + ConnectorAccounts.userKey("alice")).orElseThrow();
    assertThat(json.valueToTree(row).toString()).doesNotContain("rt-initial").contains("v1:");
    assertThat(accounts.refreshToken("tenant", "alice", GoogleClient.PROVIDER)).isEqualTo("rt-initial");
  }

  @Test void gmailListsPdfAttachmentsWithStableIdsAndDownloadsReadOnly() {
    connect("tenant", "alice", GoogleClient.GMAIL_READ);
    var items = gmail.preview(new SourceRequest("tenant", "case", "alice", "label:Nachtraege", 10));
    assertThat(items).hasSize(1);
    var item = items.getFirst();
    assertThat(item.externalId()).isEqualTo("18c2f0a1b2c3d4e5/1");
    assertThat(item.revision()).isEqualTo("1793001600000");
    assertThat(item.name()).isEqualTo("Nachtragsangebot-NA-2026-007.pdf");
    assertThat(item.metadata()).containsEntry("threadId", "18c2f0a1b2c3d4e5").containsEntry("fromDomain", "musterbau.example");
    assertThat(item.metadata().get("subject")).contains("NA-2026-007");
    assertThat(item.canDownload()).isTrue();
    assertThat(gmail.fetch(request("alice"), item.externalId()).bytes()).isEqualTo(pdf);
    assertThat(mock.requests).allMatch(r -> r.startsWith("GET ") || r.startsWith("POST /token"));
    assertThat(mock.requests.stream().filter(r -> r.startsWith("GET /gmail/v1/users/me/messages?")).findFirst().orElseThrow())
        .contains("q=has%3Aattachment%20filename%3Apdf%20label%3ANachtraege");
    assertThatThrownBy(() -> gmail.fetch(request("alice"), "../../etc/passwd")).hasMessage("INVALID_SOURCE_ITEM");
  }

  @Test void oversizedAttachmentIsRejectedBeforeDownload() throws Exception {
    connect("tenant", "alice", GoogleClient.GMAIL_READ);
    var big = (ObjectNode) mock.messages.get("18c2f0a1b2c3d4e5").deepCopy();
    ((ObjectNode) big.path("payload").path("parts").get(1).path("body")).put("size", 3_500_000);
    mock.messages.put("18c2f0a1b2c3d4e5", big);
    var item = gmail.preview(request("alice")).getFirst();
    assertThat(item.canDownload()).isFalse();
    assertThatThrownBy(() -> gmail.fetch(request("alice"), item.externalId())).hasMessage("FILE_TOO_LARGE");
    assertThat(mock.requests).noneMatch(r -> r.contains("/attachments/"));
  }

  @Test void driveHonoursCanDownloadMimeAndSharedDrives() {
    connect("tenant", "alice", GoogleClient.DRIVE_READ);
    mock.driveFiles.put("fileAAAAAAAAAA", file("fileAAAAAAAAAA", "Bauvertrag.pdf", "application/pdf", true, "0ADriveShared"));
    mock.driveFiles.put("fileBBBBBBBBBB", file("fileBBBBBBBBBB", "Restricted.pdf", "application/pdf", false, null));
    mock.driveFiles.put("fileCCCCCCCCCC", file("fileCCCCCCCCCC", "Notes", "application/vnd.google-apps.document", true, null));
    mock.driveContent.put("fileAAAAAAAAAA", pdf);
    var items = drive.preview(new SourceRequest("tenant", "case", "alice", "folder:1AbCdEfGhIjKlMnOp", 10));
    assertThat(items).extracting(SourceItem::externalId).contains("fileAAAAAAAAAA", "fileBBBBBBBBBB");
    var shared = items.stream().filter(i -> i.externalId().equals("fileAAAAAAAAAA")).findFirst().orElseThrow();
    assertThat(shared.metadata()).containsEntry("drive", "shared-drive");
    assertThat(shared.revision()).isEqualTo("rev-fileAAAAAAAAAA");
    assertThat(items.stream().filter(i -> i.externalId().equals("fileBBBBBBBBBB")).findFirst().orElseThrow().canDownload()).isFalse();
    assertThat(drive.fetch(request("alice"), "fileAAAAAAAAAA").bytes()).isEqualTo(pdf);
    assertThatThrownBy(() -> drive.fetch(request("alice"), "fileBBBBBBBBBB")).hasMessage("SOURCE_DOWNLOAD_NOT_ALLOWED");
    assertThatThrownBy(() -> drive.fetch(request("alice"), "fileCCCCCCCCCC")).hasMessage("MIME_MISMATCH");
    assertThat(mock.requests.stream().filter(r -> r.startsWith("GET /drive/v3/files?")).findFirst().orElseThrow())
        .contains("supportsAllDrives=true", "includeItemsFromAllDrives=true", "in%20parents");
    assertThat(mock.requests).allMatch(r -> r.startsWith("GET ") || r.startsWith("POST /token"));
  }

  @Test void driveQueryEscapesUserTextAndValidatesFolders() {
    assertThat(GoogleDriveSource.driveQuery("o'brien\\x")).isEqualTo("mimeType='application/pdf' and trashed=false and name contains 'o\\'brien\\\\x'");
    assertThat(GoogleDriveSource.driveQuery("folder:1AbCdEfGhIjKlMnOp")).endsWith("'1AbCdEfGhIjKlMnOp' in parents");
    assertThatThrownBy(() -> GoogleDriveSource.driveQuery("folder:x' or '1'='1")).hasMessage("INVALID_QUERY");
  }

  @Test void expiredOrRevokedRefreshTokenRequiresReconnect() {
    connect("tenant", "alice", GoogleClient.GMAIL_READ);
    mock.refreshStatus = 400; mock.refreshBody = "{\"error\":\"invalid_grant\",\"error_description\":\"Token has been expired or revoked.\"}";
    assertThatThrownBy(() -> gmail.preview(request("alice"))).hasMessage("CONNECTOR_REAUTH_REQUIRED");
    assertThat(accounts.credential("tenant", "alice", GoogleClient.PROVIDER).orElseThrow().status()).isEqualTo("REAUTH_REQUIRED");
    assertThatThrownBy(() -> gmail.preview(request("alice"))).hasMessage("CONNECTOR_REAUTH_REQUIRED");
  }

  @Test void rejectedAccessTokenIsRefreshedOnceThenRetried() {
    connect("tenant", "alice", GoogleClient.GMAIL_READ);
    mock.force("/gmail/v1/users/me/messages", "{\"error\":{\"status\":\"UNAUTHENTICATED\"}}", 401);
    assertThat(gmail.preview(request("alice"))).hasSize(1);
    assertThat(mock.requests.stream().filter(r -> r.equals("POST /token")).count()).isEqualTo(2);
  }

  @Test void accessDeniedScopeAndRateLimitsAreDistinguished() {
    connect("tenant", "alice", GoogleClient.GMAIL_READ);
    mock.force("/gmail/v1/users/me/messages", "{\"error\":{\"errors\":[{\"reason\":\"forbidden\"}]}}", 403);
    assertThatThrownBy(() -> gmail.preview(request("alice"))).hasMessage("SOURCE_ACCESS_DENIED");
    mock.force("/gmail/v1/users/me/messages", "{\"error\":{\"errors\":[{\"reason\":\"insufficientPermissions\"}]}}", 403);
    assertThatThrownBy(() -> gmail.preview(request("alice"))).hasMessage("SCOPE_NOT_GRANTED");
    mock.force("/gmail/v1/users/me/messages", "{}", 429);
    assertThat(gmail.preview(request("alice"))).hasSize(1);
    mock.force("/gmail/v1/users/me/messages", "{}", 429, 429, 429);
    assertThatThrownBy(() -> gmail.preview(request("alice"))).hasMessage("SOURCE_RATE_LIMITED");
    mock.force("/gmail/v1/users/me/messages", "{}", 503, 503, 503);
    assertThatThrownBy(() -> gmail.preview(request("alice"))).hasMessage("SOURCE_UNAVAILABLE");
  }

  @Test void connectionsAreIsolatedByTenantUserAndScope() {
    assertThatThrownBy(() -> gmail.preview(request("alice"))).hasMessage("CONNECTOR_NOT_CONNECTED");
    connect("tenant", "alice", GoogleClient.DRIVE_READ);
    assertThatThrownBy(() -> gmail.preview(request("alice"))).hasMessage("SCOPE_NOT_GRANTED");
    assertThatThrownBy(() -> drive.preview(request("bob"))).hasMessage("CONNECTOR_NOT_CONNECTED");
    assertThatThrownBy(() -> drive.preview(new SourceRequest("other-tenant", "case", "alice", "", 5))).hasMessage("CONNECTOR_NOT_CONNECTED");
    accounts.disconnect("tenant", "alice", GoogleClient.PROVIDER);
    assertThat(accounts.credential("tenant", "alice", GoogleClient.PROVIDER).orElseThrow().status()).isEqualTo("DISCONNECTED");
    assertThatThrownBy(() -> accounts.refreshToken("tenant", "alice", GoogleClient.PROVIDER)).hasMessage("CONNECTOR_REAUTH_REQUIRED");
  }

  @Test void ciphertextIsBoundToTenantUserAndProvider() {
    String sealed = vault.seal("secret-refresh-token", "tenant|user|google");
    assertThat(sealed).doesNotContain("secret-refresh-token");
    assertThat(vault.open(sealed, "tenant|user|google")).isEqualTo("secret-refresh-token");
    assertThatThrownBy(() -> vault.open(sealed, "tenant|other-user|google")).isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> new TokenVault("c2hvcnQ=")).hasMessageContaining("32 bytes");
    assertThat(new TokenVault("").configured()).isFalse();
    assertThat(TokenVault.redact("ya29.secret")).isEqualTo("[redacted]");
  }

  private static Map<String, Object> file(String id, String name, String mime, boolean canDownload, String driveId) {
    var file = new LinkedHashMap<String, Object>();
    file.put("id", id); file.put("name", name); file.put("mimeType", mime); file.put("size", "2577");
    file.put("headRevisionId", "rev-" + id); file.put("modifiedTime", "2026-10-26T09:30:00Z"); file.put("ownedByMe", false);
    file.put("webViewLink", "https://drive.google.com/file/d/" + id + "/view"); file.put("capabilities", Map.of("canDownload", canDownload));
    if (driveId != null) file.put("driveId", driveId);
    return file;
  }
}
