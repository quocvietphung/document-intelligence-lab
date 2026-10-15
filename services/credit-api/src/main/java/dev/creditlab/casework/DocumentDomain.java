package dev.creditlab.casework;

import java.util.List;
import java.util.Locale;

/** Explicit dossier scope; document classification never silently moves an original. */
public final class DocumentDomain {
  private DocumentDomain() {}
  public static String normalize(String domain) {
    if(domain==null||domain.isBlank()) return "banking";
    String value=domain.toLowerCase(Locale.ROOT);
    if(!List.of("banking","insurance","general").contains(value))
      throw new IllegalArgumentException("Unsupported document domain");
    return value;
  }
  public static List<String> required(String domain) {
    return switch(normalize(domain)) {
      case "banking" -> List.of("income","statement");
      case "insurance" -> List.of("insurance-policy");
      default -> List.of();
    };
  }
}
