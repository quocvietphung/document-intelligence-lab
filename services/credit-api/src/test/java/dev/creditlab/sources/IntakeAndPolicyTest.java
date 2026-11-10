package dev.creditlab.sources;

import static org.assertj.core.api.Assertions.*;

import dev.creditlab.sources.SourceContracts.ConnectorException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.Test;

/** Shared intake checks, the SSRF guard and the deterministic project assessment. */
class IntakeAndPolicyTest {
  static byte[] pdf(String body) { return ("%PDF-1.4\n" + body + "\n%%EOF\n").getBytes(StandardCharsets.ISO_8859_1); }

  @Test void filenamesAreReducedToSafePdfBaseNames() {
    assertThat(IntakeChecks.safeFilename("../../etc/Rechnung März.pdf")).isEqualTo("Rechnung März.pdf");
    assertThat(IntakeChecks.safeFilename("C:\\Users\\x\\scan.PDF")).isEqualTo("scan.PDF");
    assertThat(IntakeChecks.safeFilename("in\u202Egnp.pdf")).isEqualTo("ingnp.pdf");
    assertThat(IntakeChecks.safeFilename("a".repeat(300) + ".pdf")).hasSize(120).endsWith(".pdf");
    for (String bad : List.of("invoice.pdf.exe", "report.exe.pdf", "page.html.pdf", "notes.txt", "", "...", "evil.js.pdf"))
      assertThatThrownBy(() -> IntakeChecks.safeFilename(bad)).isInstanceOf(ConnectorException.class);
  }

  @Test void realContentDecidesTheTypeNotTheDeclaredMime() {
    IntakeChecks.requirePdf("application/pdf", pdf("1 0 obj"));
    IntakeChecks.requirePdf("application/octet-stream", pdf("1 0 obj"));
    assertThatThrownBy(() -> IntakeChecks.requirePdf("image/png", pdf("x"))).hasMessage("MIME_MISMATCH");
    assertThatThrownBy(() -> IntakeChecks.requirePdf("application/pdf", "MZ\u0090 executable".getBytes(StandardCharsets.ISO_8859_1))).hasMessage("MIME_MISMATCH");
    assertThatThrownBy(() -> IntakeChecks.requirePdf("application/pdf", "%PDF-1.4 no end".getBytes(StandardCharsets.ISO_8859_1))).hasMessage("TRUNCATED_PDF");
    assertThatThrownBy(() -> IntakeChecks.requirePdf("application/pdf", new byte[0])).hasMessage("EMPTY_FILE");
    byte[] big = new byte[IntakeChecks.MAX_BYTES + 1]; System.arraycopy("%PDF-".getBytes(), 0, big, 0, 5);
    assertThatThrownBy(() -> IntakeChecks.requirePdf("application/pdf", big)).hasMessage("FILE_TOO_LARGE");
    assertThatThrownBy(() -> IntakeChecks.requireSize(3_000_001)).hasMessage("FILE_TOO_LARGE");
    assertThat(IntakeChecks.displayText("Betreff\r\nBcc: x@y\u0000", 80)).isEqualTo("Betreff Bcc: x@y");
  }

  @Test void outboundUrlsMustMatchAnExactHttpsAllowlist() {
    var hosts = Set.of("gmail.googleapis.com");
    assertThat(OutboundPolicy.requireAllowed("https://gmail.googleapis.com/gmail/v1", hosts, Set.of(), false).getHost()).isEqualTo("gmail.googleapis.com");
    for (String bad : List.of("http://gmail.googleapis.com/gmail/v1", "https://evil.example/gmail", "https://user:pw@gmail.googleapis.com/",
        "https://gmail.googleapis.com/?x=1", "https://gmail.googleapis.com.evil.example/", "https://gmail.googleapis.com:8443/",
        "https://127.0.0.1/", "file:///etc/passwd", "gopher://gmail.googleapis.com/", "not a url"))
      assertThatThrownBy(() -> OutboundPolicy.requireAllowed(bad, hosts, Set.of(), false)).isInstanceOf(IllegalArgumentException.class);
    assertThat(OutboundPolicy.requireAllowed("http://127.0.0.1:9999/mock", hosts, Set.of(), true).getPort()).isEqualTo(9999);
    assertThat(OutboundPolicy.requireAllowed("http://m365-poc:8765", Set.of(), Set.of("m365-poc"), false).getHost()).isEqualTo("m365-poc");
    assertThatThrownBy(() -> OutboundPolicy.requireAllowed("http://169.254.169.254/latest", Set.of(), Set.of("m365-poc"), false)).isInstanceOf(IllegalArgumentException.class);
    for (String host : List.of("127.0.0.1", "10.0.0.7", "192.168.1.10", "172.16.0.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "0.0.0.0"))
      assertThatThrownBy(() -> OutboundPolicy.requirePublicAddresses(host)).isInstanceOf(IllegalArgumentException.class);
    assertThat(OutboundPolicy.join(java.net.URI.create("https://www.googleapis.com/drive/v3"), "/files", Map.of("q", "name contains 'a b'")))
        .isEqualTo("https://www.googleapis.com/drive/v3/files?q=name%20contains%20%27a%20b%27");
  }

  @Test void redirectUriMustBeTheExactCallbackPath() {
    GoogleClient.validateRedirectUri("http://localhost:3000/oauth/google/callback");
    GoogleClient.validateRedirectUri("https://lab.example.org/oauth/google/callback");
    for (String bad : List.of("http://lab.example.org/oauth/google/callback", "https://lab.example.org/other", "https://lab.example.org/oauth/google/callback?next=x",
        "https://lab.example.org/oauth/google/callback#frag", "javascript:alert(1)"))
      assertThatThrownBy(() -> GoogleClient.validateRedirectUri(bad)).isInstanceOf(IllegalArgumentException.class);
  }

  @Test void projectAssessmentIsExactAndFlagsOnlyForReview() {
    String csv = """
        type,name,planned,forecast
        cost,KG 300/400 Bauwerk,9800000.00,10450000.00
        cost,KG 700,1650000.00,
        area,Wohnfläche,6500,
        revenue,Basis,21450000.00,
        milestone,Fertigstellung,2027-09-30,2027-12-15
        """;
    var result = ProjectAssessment.assess(ProjectAssessment.parseCsv(csv));
    @SuppressWarnings("unchecked") var costs = (Map<String, Object>) result.get("costs");
    assertThat(costs).containsEntry("planned", "11450000.00").containsEntry("forecast", "12100000.00").containsEntry("variance", "650000.00").containsEntry("variancePercent", "5.68");
    assertThat(result.get("costPerSqm")).isEqualTo(Map.of("planned", "1761.54", "forecast", "1861.54"));
    assertThat(result).containsEntry("humanReviewRequired", true).containsEntry("method", ProjectAssessment.METHOD);
    assertThat(result.get("notice").toString()).contains("not an investment");
    for (String bad : List.of("", "a,b\n", "type,name,planned,forecast\ncost,=HYPERLINK(\"x\"),1.00,\n", "type,name,planned,forecast\ncost,X,1e9,\n",
        "type,name,planned,forecast\ncost,X,-5.00,\n", "type,name,planned,forecast\nmilestone,X,30.09.2027,\n", "type,name,planned,forecast\narea,A,5,\n"))
      assertThatThrownBy(() -> ProjectAssessment.parseCsv(bad)).isInstanceOf(ConnectorException.class);
  }
}
