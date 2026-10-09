package dev.creditlab.casework;

import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class CreditCaseService {
  private final CreditCase demo = new CreditCase(
      "CR-2026-1048",
      "praxisbank-demo",
      "Dr. Lea Hoffmann",
      "Praxisübernahme",
      480_000,
      78,
      "HUMAN_REVIEW",
      List.of("Praxisbewertung"),
      List.of(new CreditCase.ValidationIssue(
          "MONTHLY_RATE_CONFLICT",
          "MEDIUM",
          "Kontoauszug: 1250 EUR; Selbstauskunft: 980 EUR",
          true)));

  public List<CreditCase> findAll(String tenantId) {
    return demo.tenantId().equals(tenantId) ? List.of(demo) : List.of();
  }

  public Optional<CreditCase> findById(String tenantId, String id) {
    return demo.tenantId().equals(tenantId) && demo.id().equals(id) ? Optional.of(demo) : Optional.empty();
  }
}
