package dev.creditlab.sources;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * The bundled use-case catalog: fictional or licensed PDFs, fields to extract, expected deterministic
 * results and one answerable plus one unanswerable question per use case. Only paths listed here can be
 * read by the local fixture source; arbitrary classpath paths are never served.
 */
@Component
public class UseCaseCatalog {
  public static final String RESOURCE = "use-cases/catalog.json";
  public record Fixture(String path, String name, String useCase, String sha256, String label) {}

  private final JsonNode catalog;
  private final List<Fixture> fixtures;

  public UseCaseCatalog() {
    JsonNode node;
    try (var input = new ClassPathResource(RESOURCE).getInputStream()) { node = new ObjectMapper().readTree(input); }
    catch (IOException e) { node = new ObjectMapper().createObjectNode(); }
    catalog = node;
    var seen = new LinkedHashMap<String, Fixture>();
    for (JsonNode useCase : node.path("useCases")) for (JsonNode fixture : useCase.path("fixtures")) {
      String path = fixture.path("path").asText("");
      if (!path.matches("(use-cases|real-estate|classification)/[a-z0-9-]{1,80}\\.pdf")) throw new IllegalStateException("Invalid fixture path in catalog");
      seen.putIfAbsent(path, new Fixture(path, path.substring(path.lastIndexOf('/') + 1), useCase.path("id").asText(),
          fixture.path("sha256").asText(""), fixture.path("label").asText("FICTIONAL")));
    }
    fixtures = List.copyOf(seen.values());
  }

  public JsonNode catalog() { return catalog; }
  public List<Fixture> fixtures() { return fixtures; }

  public Optional<Fixture> fixture(String path) { return fixtures.stream().filter(f -> f.path().equals(path)).findFirst(); }

  /** Reads a catalog fixture and verifies its pinned hash; changed bytes are refused rather than served. */
  public byte[] read(Fixture fixture) {
    try (var input = new ClassPathResource(fixture.path()).getInputStream()) {
      byte[] bytes = input.readNBytes(IntakeChecks.MAX_BYTES + 1);
      if (bytes.length > IntakeChecks.MAX_BYTES || !IntakeChecks.sha256(bytes).equals(fixture.sha256()))
        throw new SourceContracts.ConnectorException("FIXTURE_INTEGRITY_FAILED", 500);
      return bytes;
    } catch (IOException e) { throw new SourceContracts.ConnectorException("FIXTURE_UNAVAILABLE", 404); }
  }
}
