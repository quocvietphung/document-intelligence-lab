package dev.creditlab.sources;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import dev.creditlab.casework.CreditCase;
import dev.creditlab.casework.CreditCaseService;
import dev.creditlab.platform.*;
import dev.creditlab.sources.SourceContracts.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

/** The eight offline use cases and the capability labels shown on the Integrations page. */
class UseCasesAndLabelsTest {
  final UseCaseCatalog catalog = new UseCaseCatalog();
  final UseCaseChecks checks = new UseCaseChecks(catalog);

  @Test void catalogHasEightLabelledUseCasesWithPinnedFixtures() {
    var ids = new ArrayList<String>();
    catalog.catalog().path("useCases").forEach(u -> ids.add(u.path("id").asText()));
    assertThat(ids).containsExactly("project-assessment", "email-intake", "classification-extraction", "project-status", "contract-risk",
        "order-change-invoice-acceptance", "esg-evidence", "knowledge-assistant");
    catalog.catalog().path("useCases").forEach(u -> {
      assertThat(u.path("fixtures").size()).isPositive();
      assertThat(u.path("fields").size()).isPositive();
      assertThat(u.path("expectedValidation").size()).isPositive();
      assertThat(u.path("answerable").path("evidence").path("quote").asText()).isNotBlank();
      assertThat(u.path("unanswerable").path("expected").asText()).isEqualTo("abstain");
      for (String locale : List.of("en", "de", "vi")) {
        assertThat(u.path("title").path(locale).asText()).isNotBlank();
        assertThat(u.path("boundary").path(locale).asText()).isNotBlank();
        assertThat(u.path("answerable").path("question").path(locale).asText()).isNotBlank();
      }
    });
    for (var fixture : catalog.fixtures()) assertThat(IntakeChecks.sha256(catalog.read(fixture))).isEqualTo(fixture.sha256());
    String text = catalog.catalog().toString().toLowerCase(Locale.ROOT);
    assertThat(text).doesNotContain("instone", "apobank");
  }

  @Test void everyUseCaseRunsOfflineWithDeterministicResults() {
    catalog.catalog().path("useCases").forEach(u -> {
      var result = checks.run(u.path("id").asText());
      assertThat(result).as(u.path("id").asText() + " " + result.get("checks")).containsEntry("passed", true).containsEntry("networkCalls", 0)
          .containsEntry("fixturesLabelledFictional", true);
    });
    @SuppressWarnings("unchecked") var assessment = (List<Map<String, Object>>) checks.run("project-assessment").get("checks");
    assertThat(assessment).anySatisfy(c -> assertThat(c).containsEntry("check", "marginPercent.Vorsichtig").containsEntry("actual", "7.97").containsEntry("passed", true));
    assertThatThrownBy(() -> checks.run("unknown")).hasMessage("UNKNOWN_USE_CASE");
  }

  @Test void localSourceServesOnlyCatalogFixturesWithVerifiedHashes() {
    var local = new LocalFileSource(catalog);
    var request = new SourceRequest("tenant", "case", "alice", "esg", 10);
    var items = local.preview(request);
    assertThat(items).extracting(SourceItem::externalId).contains("use-cases/esg-nachweise-musterquartier.pdf");
    assertThat(local.fetch(request, "use-cases/esg-nachweise-musterquartier.pdf").bytes()).startsWith("%PDF-".getBytes(StandardCharsets.US_ASCII));
    for (String bad : List.of("application.yml", "../application.yml", "use-cases/catalog.json", "db/migration/V1__platform_lab.sql"))
      assertThatThrownBy(() -> local.fetch(request, bad)).hasMessage("SOURCE_ITEM_NOT_FOUND");
  }

  @Test void labelsAreHonestAndFutureAdaptersStayDisabled() throws Exception {
    var accounts = new ConnectorAccounts(new LabStore(Optional.empty(), new ObjectMapper()), new TokenVault(""));
    var google = new GoogleClient(accounts, new TokenVault(""), "", "", "", "https://accounts.google.com/o/oauth2/v2/auth", "https://oauth2.googleapis.com/token",
        "https://oauth2.googleapis.com/revoke", "https://gmail.googleapis.com/gmail/v1", "https://www.googleapis.com/drive/v3", false);
    assertThat(google.configured()).isFalse();
    var future = new FutureAdapters();
    var sources = List.of(new LocalFileSource(catalog), new GmailSource(google, accounts), new GoogleDriveSource(google, accounts),
        new MicrosoftGraphSource("", false), future.webDavSource(), future.s3Source());
    var intake = new SourceIntake(sources, List.of(new Destinations.CsvBusinessData(), future.postgresBusinessData(), future.restBusinessData(), future.dataverseBusinessData()),
        List.of(future.webhookDestination(), future.crmWriteBack()), mock(CreditCaseService.class), mock(DocumentBatches.class),
        new LabStore(Optional.empty(), new ObjectMapper()), accounts, mock(DistributedLimits.class));
    var overview = intake.overview("tenant", "alice");
    @SuppressWarnings("unchecked") var providers = (List<Map<String, Object>>) overview.get("providers");
    assertThat(providers).extracting(p -> p.get("id")).containsExactly("local", "gmail", "google-drive", "microsoft-365", "webdav", "s3");
    assertThat(providers.getFirst()).containsEntry("label", "verified-local").containsEntry("live", false).containsEntry("enabled", true).containsEntry("connection", "NOT_REQUIRED");
    assertThat(providers.get(1)).containsEntry("label", "implemented-not-live-verified").containsEntry("enabled", false).containsEntry("connection", "DISCONNECTED");
    assertThat(providers.get(3)).containsEntry("label", "simulated").containsEntry("enabled", false).containsEntry("live", false);
    assertThat(providers.subList(4, 6)).allSatisfy(p -> assertThat(p).containsEntry("label", "future").containsEntry("enabled", false));
    assertThat(overview.toString()).doesNotContain("live-verified\"", "refresh_token", "sealed").contains("tokensInBrowser=false");
    assertThat(new ObjectMapper().writeValueAsString(overview)).doesNotContain("\"live-verified\"");
    assertThatThrownBy(() -> new Descriptor("x", Kind.DOCUMENT_SOURCE, "X", Label.FUTURE, true, false, true, List.of(), List.of(), "")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new Descriptor("x", Kind.DOCUMENT_SOURCE, "X", Label.SIMULATED, true, true, true, List.of(), List.of(), "")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> future.s3Source().preview(new SourceRequest("t", "c", "a", "", 1))).hasMessage("CONNECTOR_NOT_IMPLEMENTED");
  }

  @Test void microsoft365AdapterIsSimulatedWithTheMockProvider() throws Exception {
    byte[] pdf = catalog.read(catalog.fixture("use-cases/projektstatus-musterquartier.pdf").orElseThrow());
    var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/", exchange -> {
      String path = exchange.getRequestURI().getPath();
      byte[] body = switch (path) {
        case "/health" -> "{\"status\":\"ok\",\"provider\":\"mock\",\"auth_mode\":\"local-dev\",\"live\":false}".getBytes(StandardCharsets.UTF_8);
        case "/documents" -> "{\"results\":[{\"document_id\":\"project-status-001\",\"name\":\"Projektstatus\",\"location\":\"mock://fictional\",\"score\":0}]}".getBytes(StandardCharsets.UTF_8);
        case "/documents/project-status-001/content" -> pdf;
        default -> null;
      };
      exchange.sendResponseHeaders(body == null ? 404 : 200, body == null ? -1 : body.length);
      if (body != null) exchange.getResponseBody().write(body);
      exchange.close();
    });
    server.start();
    try {
      var m365 = new MicrosoftGraphSource("http://127.0.0.1:" + server.getAddress().getPort(), true);
      assertThat(m365.descriptor().label()).isEqualTo(Label.SIMULATED);
      assertThat(m365.descriptor().enabled()).isTrue();
      assertThat(m365.descriptor().live()).isFalse();
      var request = new SourceRequest("tenant", "case", "alice", "", 5);
      assertThat(m365.preview(request)).extracting(SourceItem::externalId).containsExactly("project-status-001");
      assertThat(m365.fetch(request, "project-status-001").bytes()).isEqualTo(pdf);
      assertThatThrownBy(() -> m365.fetch(request, "missing-doc")).hasMessage("SOURCE_ITEM_NOT_FOUND");
      assertThatThrownBy(() -> m365.fetch(request, "../health")).hasMessage("INVALID_SOURCE_ITEM");
    } finally { server.stop(0); }
    assertThatThrownBy(() -> new MicrosoftGraphSource("http://attacker.example:8765", false)).isInstanceOf(IllegalArgumentException.class);
  }

  @Test void microsoft365WorkspaceNeverCallsProtectedGraphDocumentRoutes() throws Exception {
    var calls = new AtomicInteger();
    var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/", exchange -> {
      if ("/health".equals(exchange.getRequestURI().getPath())) {
        byte[] body = "{\"status\":\"ok\",\"provider\":\"graph\",\"auth_mode\":\"entra\",\"live\":true}".getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(200, body.length);
        exchange.getResponseBody().write(body);
      } else {
        calls.incrementAndGet();
        exchange.sendResponseHeaders(401, -1);
      }
      exchange.close();
    });
    server.start();
    try {
      var source = new MicrosoftGraphSource("http://127.0.0.1:" + server.getAddress().getPort(), true);
      var request = new SourceRequest("tenant", "case", "alice", "", 5);
      assertThat(source.descriptor().enabled()).isFalse();
      assertThat(source.descriptor().live()).isFalse();
      assertThatThrownBy(() -> source.preview(request)).hasMessage("CONNECTOR_NOT_CONFIGURED");
      assertThatThrownBy(() -> source.fetch(request, "doc")).hasMessage("CONNECTOR_NOT_CONFIGURED");
      assertThat(calls.get()).isZero();
    } finally { server.stop(0); }
  }

  @Test void reportIncludesOnlyHumanReviewedFields() {
    var cases = mock(CreditCaseService.class);
    var dossier = mock(CreditCase.class);
    var store = mock(LabStore.class);
    var accounts = mock(ConnectorAccounts.class);
    var confirmed = new CreditCase.Document("approved", "approved.pdf", "invoice", "verified", null,
        List.of(new CreditCase.Field("total", "150", null, 1, "Approved total")), List.of(), true, null, null, "application/pdf");
    var pending = new CreditCase.Document("pending", "pending.pdf", "invoice", "review", null,
        List.of(new CreditCase.Field("total", "700", null, 1, "Pending total")), List.of(), true, null, null, "application/pdf");
    when(cases.require("tenant", "case")).thenReturn(dossier);
    when(dossier.documents()).thenReturn(List.of(confirmed, pending), List.of(pending));

    var destination = new Destinations.Report(cases, store, accounts);
    assertThat(destination.build("tenant", "case", "alice").get("documents").toString())
        .contains("approved.pdf", "150", "humanReviewed=true").doesNotContain("pending.pdf", "700", "Pending total");
    assertThatThrownBy(() -> destination.build("tenant", "case", "alice")).hasMessage("HUMAN_REVIEW_REQUIRED");
  }
}
