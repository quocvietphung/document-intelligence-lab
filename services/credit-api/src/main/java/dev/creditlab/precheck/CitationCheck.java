package dev.creditlab.precheck;

import dev.creditlab.casework.CreditCase;
import java.text.Normalizer;
import java.util.*;

/**
 * Claim-level citation check. A citation supports a claim only when the cited page of the dossier contains the
 * literal the claim states (an amount, an invoice line, an acceptance result, a dated payment confirmation). A page
 * that exists but holds other text is NOT_SUPPORTED; a missing document or page, or nothing to compare, is UNKNOWN.
 * UNKNOWN is never turned into a guess: the rule-based draft stays and the person sees the missing evidence.
 */
final class CitationCheck {
  private CitationCheck() {}

  record Claim(String name, String documentId, int page, String literal) {}

  static Map<String, Object> verify(CreditCase item, Claim claim) {
    var row = new LinkedHashMap<String, Object>();
    row.put("claim", claim.name());
    row.put("ref", "[" + claim.documentId() + ":p" + claim.page() + "]");
    row.put("literal", claim.literal());
    var document = item.documents().stream().filter(d -> d.id().equals(claim.documentId())).findFirst();
    if (document.isEmpty()) return unknown(row, "document is not in the dossier");
    row.put("documentName", document.get().name());
    var page = document.get().pages().stream().filter(p -> p.number() == claim.page()).findFirst();
    if (page.isEmpty()) return unknown(row, "the cited page does not exist");
    if (claim.literal() == null || claim.literal().isBlank()) return unknown(row, "the claim has no literal to compare");
    boolean supported = normalize(page.get().text()).contains(normalize(claim.literal()));
    row.put("status", supported ? "SUPPORTED" : "NOT_SUPPORTED");
    row.put("reason", supported ? "the literal is on the cited page" : "the cited page exists but does not contain the literal");
    return row;
  }

  static String normalize(String text) {
    return Normalizer.normalize(text, Normalizer.Form.NFKC).replaceAll("\\p{Cf}", "").replaceAll("\\s+", " ").strip().toLowerCase(Locale.ROOT);
  }

  private static Map<String, Object> unknown(Map<String, Object> row, String reason) {
    row.put("status", "UNKNOWN");
    row.put("reason", reason);
    return row;
  }
}
