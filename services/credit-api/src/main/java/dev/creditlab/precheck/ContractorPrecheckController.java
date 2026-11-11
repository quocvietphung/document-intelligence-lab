package dev.creditlab.precheck;

import static dev.creditlab.security.JwtIdentity.actor;
import static dev.creditlab.security.JwtIdentity.tenant;

import dev.creditlab.casework.CreditCaseService;
import dev.creditlab.platform.DistributedLimits;
import dev.creditlab.platform.RagEngine;
import io.micrometer.observation.Observation;
import io.micrometer.observation.ObservationRegistry;
import io.micrometer.tracing.Tracer;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Read-only pre-accounting check. GET only: it reads the dossier and the derived search index, writes no dossier,
 * review, approval or email state, and returns a draft for a person. Each step is an Observation, so with
 * OTEL_ENABLED=true the spans precheck.extract/search/reconcile/draft reach the configured OTLP collector. Span
 * attributes carry only the step name and dossier domain, never document text or amounts.
 */
@RestController
@RequestMapping("/api/cases/{caseId}/platform/contractor-precheck")
@PreAuthorize("hasAnyRole('ADVISOR','REVIEWER','ADMIN')")
public class ContractorPrecheckController {
  private final CreditCaseService cases;
  private final RagEngine rag;
  private final DistributedLimits limits;
  private final ObservationRegistry observations;
  private final ObjectProvider<Tracer> tracer;

  public ContractorPrecheckController(CreditCaseService cases, RagEngine rag, DistributedLimits limits,
      ObjectProvider<ObservationRegistry> observations, ObjectProvider<Tracer> tracer) {
    this.cases = cases; this.rag = rag; this.limits = limits;
    this.observations = observations.getIfAvailable(() -> ObservationRegistry.NOOP); this.tracer = tracer;
  }

  @GetMapping
  public Map<String, Object> run(@PathVariable String caseId, @RequestParam(defaultValue = "en") String locale, Authentication auth) {
    if (!locale.matches("en|de|vi")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported locale");
    String tenant = tenant(auth);
    limits.reserve(tenant, actor(auth), "contractor-precheck", 20);
    var item = cases.require(tenant, caseId);
    return Observation.createNotStarted("lab.contractor.precheck", observations).contextualName("contractor-precheck")
        .lowCardinalityKeyValue("domain", item.domain()).observe(() -> {
          ContractorPrecheck.Steps steps = new ContractorPrecheck.Steps() {
            @Override public <T> T step(String name, Supplier<T> body) {
              return Observation.createNotStarted("lab.contractor.precheck.step", observations).contextualName("precheck." + name)
                  .lowCardinalityKeyValue("step", name).observe(body);
            }
          };
          var result = new LinkedHashMap<>(ContractorPrecheck.run(item, question -> {
            var search = rag.search(item, question, 5);
            return new ContractorPrecheck.Retrieval(search.backend(), search.hits().stream()
                .map(hit -> new ContractorPrecheck.Hit(hit.id(), hit.documentId(), hit.page(), hit.score(), hit.text())).toList());
          }, steps, locale));
          var active = tracer.getIfAvailable();
          var span = active == null ? null : active.currentSpan();
          result.put("traceId", span == null ? null : span.context().traceId());
          return result;
        });
  }
}
