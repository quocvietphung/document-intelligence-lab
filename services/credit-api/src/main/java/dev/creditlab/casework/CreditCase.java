package dev.creditlab.casework;

import java.util.List;

public record CreditCase(
    String id,
    String tenantId,
    String applicant,
    String purpose,
    long amountEuro,
    int completeness,
    String status,
    List<String> missingDocuments,
    List<ValidationIssue> validationIssues) {
  public record ValidationIssue(String code, String severity, String message, boolean humanReviewRequired) {}
}
