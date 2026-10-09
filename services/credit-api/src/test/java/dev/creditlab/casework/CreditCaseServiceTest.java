package dev.creditlab.casework;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CreditCaseServiceTest {
  private final CreditCaseService service = new CreditCaseService();

  @Test
  void isolatesCasesByTenant() {
    assertThat(service.findAll("praxisbank-demo"))
        .extracting(CreditCase::id)
        .containsExactly("CR-2026-1048");
    assertThat(service.findAll("other-tenant")).isEmpty();
  }

  @Test
  void doesNotReturnCaseAcrossTenantBoundary() {
    assertThat(service.findById("other-tenant", "CR-2026-1048")).isEmpty();
  }
}
