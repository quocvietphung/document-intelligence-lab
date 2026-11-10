package dev.creditlab.sources;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.sources.SourceContracts.*;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Microsoft 365 (SharePoint/OneDrive) through the existing M365 evidence service, which owns the Graph
 * provider, its ACL checks and its capability labels. With the PoC's mock provider this adapter is
 * {@code simulated}; with the Graph provider it is {@code implemented-not-live-verified}. It is never
 * labelled live-verified here, because no live tenant test has been recorded.
 */
@Component
public class MicrosoftGraphSource implements DocumentSource {
  public static final String ID = "microsoft-365";
  private final URI base;
  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).followRedirects(HttpClient.Redirect.NEVER).build();
  private final ObjectMapper json = new ObjectMapper();
  private volatile JsonNode health; private volatile Instant healthAt = Instant.EPOCH;

  public MicrosoftGraphSource(@Value("${app.connectors.m365.base-url:}") String baseUrl,
      @Value("${app.connectors.m365.allow-loopback-test-endpoints:false}") boolean allowLoopback) {
    this.base = baseUrl.isBlank() ? null : OutboundPolicy.requireAllowed(baseUrl, Set.of(), Set.of("m365-poc"), allowLoopback);
  }

  @Override public Descriptor descriptor() {
    JsonNode status = health();
    boolean reachable = status != null;
    String provider = reachable ? status.path("provider").asText("") : "";
    boolean graph = provider.equals("graph");
    return new Descriptor(ID, Kind.DOCUMENT_SOURCE, "Microsoft 365 (SharePoint / OneDrive)",
        graph ? Label.IMPLEMENTED_NOT_LIVE_VERIFIED : Label.SIMULATED, reachable, graph && status.path("live").asBoolean(false), false,
        graph ? List.of("Files.Read (delegated, via the M365 service)") : List.of(),
        List.of("Read-only listing and download through the M365 evidence service", "The service applies its own tenant and ACL checks"),
        !reachable ? "M365 service not configured or not reachable." : graph ? "Graph provider configured in the M365 service; not live-verified."
            : "Mock provider with fictional documents; not a Microsoft 365 connection.");
  }

  @Override public List<SourceItem> preview(SourceRequest request) {
    requireReachable();
    String path = request.query().isBlank() ? "/documents" : "/documents/search";
    var query = new LinkedHashMap<String, String>();
    if (!request.query().isBlank()) query.put("q", request.query());
    query.put("max_results", String.valueOf(Math.min(request.limit(), 10)));
    var items = new ArrayList<SourceItem>();
    for (JsonNode hit : get(OutboundPolicy.join(base, path, query)).path("results")) {
      String id = hit.path("document_id").asText("");
      if (!id.matches("[A-Za-z0-9_.-]{1,120}")) continue;
      items.add(new SourceItem(ID, id, "unversioned", IntakeChecks.displayText(hit.path("name").asText("document.pdf"), 120), "application/pdf", -1, true, "",
          Map.of("location", IntakeChecks.displayText(hit.path("location").asText(""), 160), "mode", descriptor().label().value())));
    }
    return items;
  }

  @Override public SourceContent fetch(SourceRequest request, String externalId) {
    requireReachable();
    if (externalId == null || !externalId.matches("[A-Za-z0-9_.-]{1,120}")) throw new ConnectorException("INVALID_SOURCE_ITEM", 422);
    byte[] bytes = send(OutboundPolicy.join(base, "/documents/" + OutboundPolicy.segment(externalId) + "/content", Map.of()), IntakeChecks.MAX_BYTES);
    var item = new SourceItem(ID, externalId, "sha256:" + IntakeChecks.sha256(bytes).substring(0, 12), externalId + ".pdf", "application/pdf", bytes.length, true, "",
        Map.of("mode", descriptor().label().value()));
    return new SourceContent(item, bytes);
  }

  private JsonNode health() {
    if (base == null) return null;
    if (Duration.between(healthAt, Instant.now()).getSeconds() < 60) return health;
    try { health = json.readTree(send(OutboundPolicy.join(base, "/health", Map.of()), 100_000)); }
    catch (RuntimeException | java.io.IOException e) { health = null; }
    healthAt = Instant.now();
    return health;
  }

  private JsonNode get(String url) {
    try { return json.readTree(send(url, 1_000_000)); } catch (java.io.IOException e) { throw new ConnectorException("SOURCE_RESPONSE_INVALID", 502); }
  }

  private byte[] send(String url, int maxBytes) {
    try {
      var response = http.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(20)).GET().build(), HttpResponse.BodyHandlers.ofInputStream());
      byte[] body;
      try (var input = response.body()) { body = input.readNBytes(maxBytes + 1); }
      if (body.length > maxBytes) throw new ConnectorException("FILE_TOO_LARGE", 422);
      return switch (response.statusCode()) {
        case 200 -> body;
        case 401, 403 -> throw new ConnectorException("SOURCE_ACCESS_DENIED", 403);
        case 404 -> throw new ConnectorException("SOURCE_ITEM_NOT_FOUND", 404);
        case 429 -> throw new ConnectorException("SOURCE_RATE_LIMITED", 429);
        default -> throw new ConnectorException("SOURCE_UNAVAILABLE", 503);
      };
    } catch (java.io.IOException e) { throw new ConnectorException("SOURCE_UNAVAILABLE", 503); }
    catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new ConnectorException("SOURCE_UNAVAILABLE", 503); }
  }

  private void requireReachable() { if (base == null) throw new ConnectorException("CONNECTOR_NOT_CONFIGURED", 503); }
}
