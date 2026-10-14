package dev.creditlab.banking;

import java.util.List;

/** Read-only synthetic evidence; integer cents. Legacy payment records are retained for compatibility only. */
public record BankingSnapshot(String caseId, String tenantId, boolean synthetic, boolean persistent,
    long version, List<Account> accounts, List<Movement> transactions, List<Beneficiary> beneficiaries,
    List<Invoice> invoices, List<Payment> payments, List<Event> events) {
  public record Account(String id, String label, String maskedReference, long openingCents, String currency) {}
  public record Movement(String id, String accountId, String date, String counterparty, String reference,
      String category, long amountCents, String invoiceId) {}
  public record Beneficiary(String id, String name, String maskedReference, boolean verified) {}
  public record Invoice(String id, String beneficiaryId, String number, String dueDate, long amountCents,
      String currency, String description, String status, String evidence) {}
  public record Payment(String id, String requestId, String accountId, String invoiceId, long amountCents,
      String status, String createdBy, String confirmedBy, String createdAt) {}
  public record Event(String id, String time, String action, String actor, String reference) {}
}
