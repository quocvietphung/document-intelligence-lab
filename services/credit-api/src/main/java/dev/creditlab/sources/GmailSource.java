package dev.creditlab.sources;

import com.fasterxml.jackson.databind.JsonNode;
import dev.creditlab.sources.SourceContracts.*;
import java.util.*;
import org.springframework.stereotype.Component;

/**
 * Read-only Gmail attachment source (scope gmail.readonly). It searches messages by a Gmail query or label,
 * lists PDF attachments with message/thread metadata and downloads one attachment on explicit import.
 * It never sends, modifies, labels or deletes mail. Subjects and file names are untrusted display text.
 */
@Component
public class GmailSource implements DocumentSource {
  public static final String ID = "gmail";
  private static final String ID_PATTERN = "[A-Za-z0-9]{6,64}/[0-9]{1,3}(?:\\.[0-9]{1,3}){0,6}";
  private final GoogleClient google;
  private final ConnectorAccounts accounts;

  public GmailSource(GoogleClient google, ConnectorAccounts accounts) { this.google = google; this.accounts = accounts; }

  @Override public Descriptor descriptor() {
    return new Descriptor(ID, Kind.DOCUMENT_SOURCE, "Gmail", Label.IMPLEMENTED_NOT_LIVE_VERIFIED, google.configured(), google.configured(), true,
        List.of(GoogleClient.GMAIL_READ),
        List.of("Read messages and their PDF attachments", "Never sends, modifies, labels or deletes mail"),
        "Tested with a mocked Gmail API only. Connect with your own Google OAuth client to use real mail.");
  }

  @Override public List<SourceItem> preview(SourceRequest request) {
    requireScope(request, GoogleClient.GMAIL_READ);
    String query = ("has:attachment filename:pdf " + request.query()).strip();
    JsonNode list = google.getJson(request.tenant(), request.actor(), OutboundPolicy.join(google.gmailBase(), "/users/me/messages",
        Map.of("q", query, "maxResults", String.valueOf(request.limit()))));
    var items = new ArrayList<SourceItem>();
    for (JsonNode ref : list.path("messages")) {
      if (items.size() >= request.limit()) break;
      String id = ref.path("id").asText("");
      if (!id.matches("[A-Za-z0-9]{6,64}")) continue;
      items.addAll(attachments(message(request, id)).stream().limit(request.limit() - items.size()).toList());
    }
    return items;
  }

  @Override public SourceContent fetch(SourceRequest request, String externalId) {
    requireScope(request, GoogleClient.GMAIL_READ);
    if (externalId == null || !externalId.matches(ID_PATTERN)) throw new ConnectorException("INVALID_SOURCE_ITEM", 422);
    String messageId = externalId.substring(0, externalId.indexOf('/')), partId = externalId.substring(externalId.indexOf('/') + 1);
    JsonNode message = message(request, messageId);
    var item = attachments(message).stream().filter(a -> a.externalId().equals(externalId)).findFirst()
        .orElseThrow(() -> new ConnectorException("SOURCE_ITEM_NOT_FOUND", 404));
    IntakeChecks.requireSize(item.size());
    String attachmentId = findPart(message.path("payload"), partId).map(p -> p.path("body").path("attachmentId").asText("")).orElse("");
    if (!attachmentId.matches("[A-Za-z0-9_-]{1,2048}")) throw new ConnectorException("SOURCE_ITEM_NOT_FOUND", 404);
    JsonNode body = google.getJson(request.tenant(), request.actor(), OutboundPolicy.join(google.gmailBase(),
        "/users/me/messages/" + OutboundPolicy.segment(messageId) + "/attachments/" + OutboundPolicy.segment(attachmentId), Map.of()));
    String data = body.path("data").asText("");
    if (data.length() > (IntakeChecks.MAX_BYTES / 3 + 2) * 4) throw new ConnectorException("FILE_TOO_LARGE", 422);
    final byte[] bytes;
    try { bytes = Base64.getUrlDecoder().decode(data.replace("=", "")); }
    catch (IllegalArgumentException e) { throw new ConnectorException("SOURCE_RESPONSE_INVALID", 502); }
    return new SourceContent(item, bytes);
  }

  private JsonNode message(SourceRequest request, String id) {
    return google.getJson(request.tenant(), request.actor(), OutboundPolicy.join(google.gmailBase(), "/users/me/messages/" + OutboundPolicy.segment(id),
        Map.of("format", "full")));
  }

  /** Lists PDF attachments of one message. A part counts when its name ends in .pdf or it declares application/pdf. */
  static List<SourceItem> attachments(JsonNode message) {
    String id = message.path("id").asText(""), thread = message.path("threadId").asText("");
    var headers = new HashMap<String, String>();
    for (JsonNode header : message.path("payload").path("headers")) headers.putIfAbsent(header.path("name").asText("").toLowerCase(Locale.ROOT), header.path("value").asText(""));
    var labels = new ArrayList<String>();
    message.path("labelIds").forEach(label -> labels.add(label.asText()));
    var result = new ArrayList<SourceItem>();
    collect(message.path("payload"), part -> {
      String filename = part.path("filename").asText(""), mime = part.path("mimeType").asText("").toLowerCase(Locale.ROOT);
      String partId = part.path("partId").asText("");
      if (part.path("body").path("attachmentId").asText("").isBlank() || !partId.matches("[0-9]{1,3}(?:\\.[0-9]{1,3}){0,6}")) return;
      if (!filename.toLowerCase(Locale.ROOT).endsWith(".pdf") && !mime.equals("application/pdf")) return;
      long size = part.path("body").path("size").asLong(0);
      var metadata = new LinkedHashMap<String, String>();
      metadata.put("threadId", thread);
      metadata.put("subject", IntakeChecks.displayText(headers.get("subject"), 140));
      metadata.put("fromDomain", domain(headers.get("from")));
      metadata.put("date", IntakeChecks.displayText(headers.get("date"), 60));
      metadata.put("labels", String.join(",", labels.stream().limit(8).toList()));
      result.add(new SourceItem(ID, id + "/" + partId, message.path("internalDate").asText("0"),
          IntakeChecks.displayText(filename.isBlank() ? "attachment.pdf" : filename, 120), mime, size,
          size > 0 && size <= IntakeChecks.MAX_BYTES, "https://mail.google.com/mail/u/0/#all/" + id, metadata));
    });
    return result;
  }

  private static void collect(JsonNode part, java.util.function.Consumer<JsonNode> visitor) {
    visitor.accept(part);
    for (JsonNode child : part.path("parts")) collect(child, visitor);
  }

  private static Optional<JsonNode> findPart(JsonNode part, String partId) {
    if (partId.equals(part.path("partId").asText())) return Optional.of(part);
    for (JsonNode child : part.path("parts")) { var found = findPart(child, partId); if (found.isPresent()) return found; }
    return Optional.empty();
  }

  /** Only the sender's domain is kept as provenance; full addresses stay in the mailbox. */
  static String domain(String from) {
    var matcher = java.util.regex.Pattern.compile("@([A-Za-z0-9.-]{1,120})").matcher(Objects.requireNonNullElse(from, ""));
    return matcher.find() ? matcher.group(1).toLowerCase(Locale.ROOT) : "";
  }

  private void requireScope(SourceRequest request, String scope) {
    if (!google.configured()) throw new ConnectorException("CONNECTOR_NOT_CONFIGURED", 503);
    var credential = accounts.credential(request.tenant(), request.actor(), GoogleClient.PROVIDER)
        .orElseThrow(() -> new ConnectorException("CONNECTOR_NOT_CONNECTED", 409));
    if ("REAUTH_REQUIRED".equals(credential.status())) throw new ConnectorException("CONNECTOR_REAUTH_REQUIRED", 409);
    if (!credential.connected()) throw new ConnectorException("CONNECTOR_NOT_CONNECTED", 409);
    if (!credential.has(scope)) throw new ConnectorException("SCOPE_NOT_GRANTED", 409);
  }
}
