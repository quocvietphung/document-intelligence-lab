package dev.creditlab.platform;

import dev.creditlab.casework.CreditCase;
import java.util.*;

/**
 * One rule for what may reach model context. A page is quarantined when any text the model could read from it is
 * untrusted: the page text, one of its regions, a field on it, or a table cell on it. A quarantined page loses all of
 * its text, fields, regions and table cells from model context; the other pages of the same document stay available,
 * and the original PDF stays open for the person who reviews it.
 */
public final class PageIsolation {
  private PageIsolation() {}

  public static String key(String documentId, int page) { return documentId + ":p" + page; }

  /** Keys "documentId:pN" of every page that is quarantined from model context. */
  public static Set<String> quarantinedPages(CreditCase item) {
    var out = new TreeSet<String>();
    for (var document : item.documents()) for (var page : document.pages()) if (quarantined(document, page)) out.add(key(document.id(), page.number()));
    return Collections.unmodifiableSet(out);
  }

  /** True when the page itself, or anything extracted from it, is untrusted. */
  static boolean quarantined(CreditCase.Document document, CreditCase.Page page) {
    if (EvidenceGuard.untrustedForModel(page.text())) return true;
    if (page.regions().stream().anyMatch(region -> EvidenceGuard.untrustedForModel(region.text()))) return true;
    if (document.fields().stream().anyMatch(field -> field.page() == page.number()
        && EvidenceGuard.untrustedForModel(field.label() + " " + field.value() + " " + Objects.requireNonNullElse(field.evidence(), "")))) return true;
    return document.tables().stream().anyMatch(table -> table.page() == page.number()
        && table.cells().stream().anyMatch(cell -> EvidenceGuard.untrustedForModel(cell.text())));
  }

  public static boolean isolated(Set<String> quarantined, String documentId, int page) {
    return quarantined.contains(key(documentId, page));
  }
}
