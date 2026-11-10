package dev.creditlab.sources;

import dev.creditlab.sources.SourceContracts.*;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Planned adapters, registered only as disabled descriptors. They contain no network code and no fake
 * integration; enabling one requires a reviewed implementation with its own tests.
 */
@Configuration
public class FutureAdapters {
  static Descriptor future(String id, Kind kind, String provider, String note) {
    return new Descriptor(id, kind, provider, Label.FUTURE, false, false, true, List.of(), List.of(), note);
  }

  static DocumentSource disabledSource(Descriptor descriptor) {
    return new DocumentSource() {
      @Override public Descriptor descriptor() { return descriptor; }
      @Override public List<SourceItem> preview(SourceRequest request) { throw new ConnectorException("CONNECTOR_NOT_IMPLEMENTED", 501); }
      @Override public SourceContent fetch(SourceRequest request, String externalId) { throw new ConnectorException("CONNECTOR_NOT_IMPLEMENTED", 501); }
    };
  }

  @Bean DocumentSource webDavSource() {
    return disabledSource(future("webdav", Kind.DOCUMENT_SOURCE, "Nextcloud / WebDAV", "Planned read-only PROPFIND/GET with per-user app passwords."));
  }
  @Bean DocumentSource s3Source() {
    return disabledSource(future("s3", Kind.DOCUMENT_SOURCE, "S3 / MinIO", "Planned read-only GetObject with a scoped bucket policy."));
  }
  @Bean BusinessDataSource postgresBusinessData() {
    return () -> future("postgresql", Kind.BUSINESS_DATA, "PostgreSQL", "Planned read-only views with a dedicated role.");
  }
  @Bean BusinessDataSource restBusinessData() {
    return () -> future("generic-rest", Kind.BUSINESS_DATA, "Generic REST API", "Planned allowlisted HTTPS endpoints only.");
  }
  @Bean BusinessDataSource dataverseBusinessData() {
    return () -> future("dynamics-dataverse", Kind.BUSINESS_DATA, "Dynamics 365 / Dataverse", "Planned read-only Web API access; optional, never required.");
  }
  @Bean ResultDestination webhookDestination() {
    return () -> future("webhook", Kind.DESTINATION, "Webhook", "Planned HTTPS-only delivery after approval, with public-address checks.");
  }
  @Bean ResultDestination crmWriteBack() {
    return () -> future("crm-write-back", Kind.DESTINATION, "CRM write-back", "Planned; requires human approval for every write.");
  }
}
