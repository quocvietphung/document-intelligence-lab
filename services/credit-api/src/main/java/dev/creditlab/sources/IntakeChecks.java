package dev.creditlab.sources;

import dev.creditlab.sources.SourceContracts.ConnectorException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.util.*;

/**
 * Checks shared by every connector before a file reaches the existing queue. The queue repeats its own
 * checks (size, extension, active content, ClamAV); this layer adds real MIME detection and a safe name.
 */
public final class IntakeChecks {
  private IntakeChecks() {}
  public static final int MAX_BYTES = 3_000_000;
  private static final Set<String> DECLARED_PDF_TYPES = Set.of("application/pdf", "application/x-pdf", "application/octet-stream", "");

  /** Keeps only a short base name; path parts, control/format characters and executable names are rejected. */
  public static String safeFilename(String raw) {
    String name = Normalizer.normalize(Objects.requireNonNullElse(raw, ""), Normalizer.Form.NFKC)
        .replaceAll("\\p{Cf}", "").replaceAll("\\p{Cntrl}", "");
    name = name.substring(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1).strip();
    name = name.replaceAll("[^\\p{L}\\p{N}._ -]", "_").replaceAll("\\.{2,}", ".").replaceAll("^[._ -]+", "");
    if (name.isBlank()) throw new ConnectorException("INVALID_FILENAME", 422);
    String lower = name.toLowerCase(Locale.ROOT);
    if (!lower.endsWith(".pdf")) throw new ConnectorException("UNSUPPORTED_FILE_TYPE", 422);
    String stem = lower.substring(0, lower.length() - 4);
    if (stem.matches(".*\\.(exe|js|jse|vbs|bat|cmd|com|scr|ps1|sh|jar|msi|html?|svg|zip|docm|xlsm)$"))
      throw new ConnectorException("UNSUPPORTED_FILE_TYPE", 422);
    if (name.length() > 120) name = name.substring(0, 116) + ".pdf";
    return name;
  }

  /** The declared type is advisory provider metadata; the bytes decide. */
  public static void requirePdf(String declaredMime, byte[] bytes) {
    if (bytes == null || bytes.length == 0) throw new ConnectorException("EMPTY_FILE", 422);
    if (bytes.length > MAX_BYTES) throw new ConnectorException("FILE_TOO_LARGE", 422);
    String declared = Objects.requireNonNullElse(declaredMime, "").toLowerCase(Locale.ROOT).strip();
    if (!DECLARED_PDF_TYPES.contains(declared)) throw new ConnectorException("MIME_MISMATCH", 422);
    if (!startsWith(bytes, "%PDF-")) throw new ConnectorException("MIME_MISMATCH", 422);
    String tail = new String(bytes, Math.max(0, bytes.length - 2048), Math.min(bytes.length, 2048), StandardCharsets.ISO_8859_1);
    if (!tail.contains("%%EOF")) throw new ConnectorException("TRUNCATED_PDF", 422);
  }

  public static void requireSize(long declaredSize) {
    if (declaredSize < 1) throw new ConnectorException("EMPTY_FILE", 422);
    if (declaredSize > MAX_BYTES) throw new ConnectorException("FILE_TOO_LARGE", 422);
  }

  public static String sha256(byte[] bytes) {
    try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
    catch (Exception e) { throw new IllegalStateException(e); }
  }

  public static String sha256(String text) { return sha256(text.getBytes(StandardCharsets.UTF_8)); }

  /** Untrusted provider text for display only: no control characters, bounded length. */
  public static String displayText(String raw, int max) {
    String value = Normalizer.normalize(Objects.requireNonNullElse(raw, ""), Normalizer.Form.NFKC)
        .replaceAll("\\p{Cf}", "").replaceAll("[\\p{Cntrl}]", " ").replaceAll("\\s+", " ").strip();
    return value.length() > max ? value.substring(0, max - 1) + "…" : value;
  }

  private static boolean startsWith(byte[] bytes, String prefix) {
    byte[] expected = prefix.getBytes(StandardCharsets.US_ASCII);
    if (bytes.length < expected.length) return false;
    for (int i = 0; i < expected.length; i++) if (bytes[i] != expected[i]) return false;
    return true;
  }
}
