package dev.creditlab.sources;

import dev.creditlab.sources.SourceContracts.*;
import java.util.*;
import org.springframework.stereotype.Component;

/**
 * The default source: needs no Google, Microsoft or Azure credential. Direct uploads keep using the existing
 * Documents & review flow; this adapter exposes the bundled fictional use-case PDFs through the same contract
 * so every use case can run offline through the shared pipeline.
 */
@Component
public class LocalFileSource implements DocumentSource {
  public static final String ID = "local";
  private final UseCaseCatalog catalog;

  public LocalFileSource(UseCaseCatalog catalog) { this.catalog = catalog; }

  @Override public Descriptor descriptor() {
    return new Descriptor(ID, Kind.DOCUMENT_SOURCE, "Local files and fictional fixtures", Label.VERIFIED_LOCAL, true, false, false, List.of(),
        List.of("Upload your own permitted PDFs in Documents & review", "Import bundled fictional use-case PDFs; no network call"),
        "Default mode. Works without any cloud credential.");
  }

  @Override public List<SourceItem> preview(SourceRequest request) {
    String query = request.query().toLowerCase(Locale.ROOT);
    return catalog.fixtures().stream()
        .filter(f -> query.isEmpty() || f.name().contains(query) || f.useCase().contains(query))
        .limit(request.limit()).map(LocalFileSource::item).toList();
  }

  @Override public SourceContent fetch(SourceRequest request, String externalId) {
    var fixture = catalog.fixture(Objects.requireNonNullElse(externalId, "")).orElseThrow(() -> new ConnectorException("SOURCE_ITEM_NOT_FOUND", 404));
    return new SourceContent(item(fixture), catalog.read(fixture));
  }

  private static SourceItem item(UseCaseCatalog.Fixture fixture) {
    return new SourceItem(ID, fixture.path(), fixture.sha256().substring(0, Math.min(12, fixture.sha256().length())), fixture.name(),
        "application/pdf", -1, true, "", Map.of("useCase", fixture.useCase(), "label", fixture.label()));
  }
}
