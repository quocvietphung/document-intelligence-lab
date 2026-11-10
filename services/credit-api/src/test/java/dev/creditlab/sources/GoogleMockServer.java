package dev.creditlab.sources;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/** Loopback mock of the Google OAuth, Gmail and Drive endpoints used by the connectors. No real Google call. */
final class GoogleMockServer implements AutoCloseable {
  final HttpServer server;
  final String base;
  final List<String> requests = new CopyOnWriteArrayList<>();
  final List<String> draftBodies = new CopyOnWriteArrayList<>();
  final Map<String, Deque<Integer>> forced = new ConcurrentHashMap<>();
  final Map<String, String> forcedBody = new ConcurrentHashMap<>();
  final Map<String, JsonNode> messages = new ConcurrentHashMap<>();
  final Map<String, byte[]> attachments = new ConcurrentHashMap<>();
  final Map<String, Map<String, Object>> driveFiles = new ConcurrentHashMap<>();
  final Map<String, byte[]> driveContent = new ConcurrentHashMap<>();
  volatile int refreshStatus = 200;
  volatile String refreshBody = "{\"access_token\":\"at-refreshed\",\"expires_in\":3600,\"token_type\":\"Bearer\"}";
  volatile String grantedScopes = GoogleClient.GMAIL_READ + " " + GoogleClient.DRIVE_READ + " " + GoogleClient.GMAIL_COMPOSE;
  volatile String lastTokenForm = "";
  private final ObjectMapper json = new ObjectMapper();

  GoogleMockServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/", this::handle);
    server.setExecutor(Executors.newFixedThreadPool(4));
    server.start();
    base = "http://127.0.0.1:" + server.getAddress().getPort();
  }

  GoogleClient client(ConnectorAccounts accounts, TokenVault vault) {
    var client = new GoogleClient(accounts, vault, "test-client-id", "test-client-secret", "http://localhost:3000/oauth/google/callback",
        base + "/auth", base + "/token", base + "/revoke", base + "/gmail/v1", base + "/drive/v3", true);
    client.sleeper = millis -> {};
    return client;
  }

  void force(String pathPrefix, String body, Integer... statuses) {
    forced.put(pathPrefix, new ArrayDeque<>(List.of(statuses)));
    forcedBody.put(pathPrefix, body);
  }

  long sends() { return requests.stream().filter(r -> r.contains("/send")).count(); }

  private void handle(HttpExchange exchange) throws IOException {
    String method = exchange.getRequestMethod(), path = exchange.getRequestURI().getPath(), query = Objects.requireNonNullElse(exchange.getRequestURI().getRawQuery(), "");
    byte[] requestBody = exchange.getRequestBody().readAllBytes();
    requests.add(method + " " + path + (query.isEmpty() ? "" : "?" + query));
    for (var entry : forced.entrySet()) {
      if (path.startsWith(entry.getKey()) && !entry.getValue().isEmpty()) { respond(exchange, entry.getValue().poll(), forcedBody.getOrDefault(entry.getKey(), "{}")); return; }
    }
    if (path.equals("/token")) { token(exchange, new String(requestBody, StandardCharsets.UTF_8)); return; }
    if (path.equals("/revoke")) { respond(exchange, 200, "{}"); return; }
    String auth = Objects.requireNonNullElse(exchange.getRequestHeaders().getFirst("Authorization"), "");
    if (!auth.startsWith("Bearer at-")) { respond(exchange, 401, "{\"error\":{\"status\":\"UNAUTHENTICATED\"}}"); return; }
    if (path.contains("/send")) { respond(exchange, 500, "{\"error\":\"sending is never expected\"}"); return; }
    if (method.equals("GET") && path.equals("/gmail/v1/users/me/messages")) {
      var ids = messages.keySet().stream().sorted().map(id -> Map.of("id", id)).toList();
      respond(exchange, 200, json.writeValueAsString(Map.of("messages", ids, "resultSizeEstimate", ids.size()))); return;
    }
    if (method.equals("GET") && path.matches("/gmail/v1/users/me/messages/[^/]+")) {
      var message = messages.get(path.substring(path.lastIndexOf('/') + 1));
      if (message == null) respond(exchange, 404, "{\"error\":{\"status\":\"NOT_FOUND\"}}"); else respond(exchange, 200, json.writeValueAsString(message));
      return;
    }
    if (method.equals("GET") && path.matches("/gmail/v1/users/me/messages/[^/]+/attachments/[^/]+")) {
      var data = attachments.get(path.substring(path.lastIndexOf('/') + 1));
      if (data == null) { respond(exchange, 404, "{}"); return; }
      respond(exchange, 200, json.writeValueAsString(Map.of("size", data.length, "data", Base64.getUrlEncoder().withoutPadding().encodeToString(data)))); return;
    }
    if (method.equals("POST") && path.equals("/gmail/v1/users/me/drafts")) {
      draftBodies.add(new String(requestBody, StandardCharsets.UTF_8));
      respond(exchange, 200, "{\"id\":\"r-draft-0001\",\"message\":{\"id\":\"m-draft\"}}"); return;
    }
    if (method.equals("GET") && path.equals("/drive/v3/files")) {
      respond(exchange, 200, json.writeValueAsString(Map.of("files", new ArrayList<>(driveFiles.values())))); return;
    }
    if (method.equals("GET") && path.matches("/drive/v3/files/[^/]+")) {
      String id = path.substring(path.lastIndexOf('/') + 1);
      if (!driveFiles.containsKey(id)) { respond(exchange, 404, "{}"); return; }
      if (query.contains("alt=media")) { exchange.sendResponseHeaders(200, driveContent.get(id).length); exchange.getResponseBody().write(driveContent.get(id)); exchange.close(); return; }
      respond(exchange, 200, json.writeValueAsString(driveFiles.get(id))); return;
    }
    respond(exchange, 404, "{}");
  }

  private void token(HttpExchange exchange, String form) throws IOException {
    lastTokenForm = form;
    var values = new HashMap<String, String>();
    for (String pair : form.split("&")) { int i = pair.indexOf('='); if (i > 0) values.put(pair.substring(0, i), URLDecoder.decode(pair.substring(i + 1), StandardCharsets.UTF_8)); }
    if ("refresh_token".equals(values.get("grant_type"))) { respond(exchange, refreshStatus, refreshBody); return; }
    if ("authorization_code".equals(values.get("grant_type")) && values.getOrDefault("code_verifier", "").length() >= 43 && "good-code".equals(values.get("code"))) {
      respond(exchange, 200, json.writeValueAsString(Map.of("access_token", "at-initial", "refresh_token", "rt-initial", "expires_in", 3600, "scope", grantedScopes)));
      return;
    }
    respond(exchange, 400, "{\"error\":\"invalid_grant\"}");
  }

  private static void respond(HttpExchange exchange, int status, String body) throws IOException {
    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add("Content-Type", "application/json");
    exchange.sendResponseHeaders(status, bytes.length == 0 ? -1 : bytes.length);
    if (bytes.length > 0) exchange.getResponseBody().write(bytes);
    exchange.close();
  }

  @Override public void close() { server.stop(0); }
}
