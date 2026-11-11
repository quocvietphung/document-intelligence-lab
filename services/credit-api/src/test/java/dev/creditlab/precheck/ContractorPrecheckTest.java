package dev.creditlab.precheck;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.CreditCase;
import dev.creditlab.casework.DocumentExtractor;
import dev.creditlab.platform.EvidenceGuard;
import java.io.IOException;
import java.security.MessageDigest;
import java.util.*;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

/** AI-103 pass/fail criteria for the deterministic pre-accounting check, on the fictional contractor dossier. */
class ContractorPrecheckTest {
  private static final String DIR = "contractor-dossier/";
  private static final List<String> CORE = List.of("bauauftrag-wv-2026-031.pdf", "nachtrag-n01-wv-2026-031.pdf",
      "baurechnung-rg-2026-0457.pdf", "abnahmeprotokoll-ap-2026-019.pdf");

  @Test void fixturesMatchTheManifestAndAreLabelledFictional() throws Exception {
    JsonNode manifest = manifest();
    for (JsonNode file : manifest.path("files")) {
      byte[] bytes = bytes(file.path("file").asText());
      assertEquals(file.path("sha256").asText(), java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)), file.path("file").asText());
      if (file.path("mediaType").asText().equals("application/pdf"))
        assertTrue(String.join(" ", pages(bytes)).contains("FIKTIVE DATEN"), file.path("file").asText());
    }
  }

  @Test void existingExtractorClassifiesTheDossierAsTheRealEstateChecklist() throws Exception {
    var types = core().stream().map(CreditCase.Document::type).toList();
    assertEquals(List.of("construction-order", "change-order", "construction-invoice", "acceptance-report"), types);
  }

  @Test @SuppressWarnings("unchecked") void reconcilesOnTheSameTaxBasisWithSourcePages() throws Exception {
    var result = ContractorPrecheck.run(dossier(core()), lexical(core()), ContractorPrecheck.UNTRACED, "en");
    var approved = (Map<String, Object>) result.get("approved");
    var invoice = (Map<String, Object>) result.get("invoice");
    var variance = (Map<String, Object>) result.get("variance");
    assertEquals("48780.00", approved.get("amount"));
    assertEquals("GROSS", approved.get("basis"));
    assertSource(approved.get("source"), "nachtrag-n01-wv-2026-031.pdf", 2, "48.780,00 EUR brutto");
    assertEquals(Boolean.TRUE, ((Map<String, Object>) approved.get("crossCheck")).get("consistent"));
    assertEquals("49980.00", invoice.get("amount"));
    assertSource(invoice.get("source"), "baurechnung-rg-2026-0457.pdf", 2, "49.980,00 EUR brutto");
    assertEquals(Boolean.TRUE, invoice.get("netPlusVatEqualsGross"));
    assertEquals("1200.00", variance.get("amount"));
    assertEquals("GROSS", variance.get("basis"));
    assertEquals(Boolean.TRUE, variance.get("sameTaxBasis"));
    assertEquals("1008.40", variance.get("net"));
    assertEquals("191.60", variance.get("vat"));
    var lines = (List<Map<String, Object>>) result.get("invoiceLines");
    assertEquals(List.of(1, 2, 3), lines.stream().map(l -> l.get("position")).toList());
    assertEquals(List.of(true, true, false), lines.stream().map(l -> l.get("approved")).toList());
    assertEquals(Boolean.TRUE, ((Map<String, Object>) result.get("explanation")).get("explainsVariance"));
    assertEquals("INVOICE_EXCEEDS_APPROVED_AMOUNT", ((List<Map<String, Object>>) result.get("findings")).getFirst().get("code"));
  }

  @Test @SuppressWarnings("unchecked") void reportsMissingAcceptanceAndPaymentEvidenceExplicitly() throws Exception {
    var documents = new ArrayList<>(core());
    documents.add(photo("foto-f-01.png", "FIKTIV · Foto F-01\nTreppenhaus Haus C · Kantenschutz fehlt"));
    documents.add(photo("foto-f-02.png", "FIKTIV · Foto F-O2\nTreppenhaus Haus C · Vorsatzschale montiert"));
    var result = ContractorPrecheck.run(dossier(documents), lexical(documents), ContractorPrecheck.UNTRACED, "vi");
    var evidence = (Map<String, Object>) result.get("evidence");
    var acceptance = (Map<String, Object>) evidence.get("acceptance");
    assertEquals("PARTIAL", acceptance.get("status"));
    assertEquals(List.of(1, 2), acceptance.get("acceptedPositions"));
    assertEquals(List.of(3), acceptance.get("notAcceptedPositions"));
    assertEquals(1, acceptance.get("openDefects"));
    assertEquals("MISSING", ((Map<String, Object>) evidence.get("payment")).get("status"));
    var photos = (Map<String, Object>) evidence.get("photos");
    assertEquals(List.of("F-01", "F-02", "F-03"), photos.get("referenced"));
    assertEquals(List.of("F-03"), photos.get("missing"));
    var codes = ((List<Map<String, Object>>) result.get("findings")).stream().map(f -> f.get("code")).toList();
    assertTrue(codes.containsAll(List.of("INVOICE_LINE_WITHOUT_APPROVAL", "ACCEPTANCE_EVIDENCE_MISSING", "PAYMENT_EVIDENCE_MISSING", "PHOTO_EVIDENCE_MISSING", "OPEN_ACCEPTANCE_DEFECTS")), codes.toString());
    var draft = (Map<String, Object>) result.get("draft");
    var summary = String.join("\n", (List<String>) draft.get("summary"));
    assertTrue(summary.contains("Bằng chứng thanh toán: THIẾU"), summary);
    assertTrue(summary.contains("1.200,00 EUR"), summary);
    assertTrue(summary.contains("[") && summary.contains(":p2]"), "summary cites source pages");
  }

  @Test @SuppressWarnings("unchecked") void draftIsNeverApprovedOrSent() throws Exception {
    var item = dossier(core());
    var result = ContractorPrecheck.run(item, lexical(core()), ContractorPrecheck.UNTRACED, "de");
    var draft = (Map<String, Object>) result.get("draft");
    assertEquals("DRAFT_REQUIRES_HUMAN_REVIEW", draft.get("status"));
    assertEquals(false, draft.get("approved"));
    assertEquals(false, draft.get("emailSent"));
    assertEquals(false, draft.get("paymentReleased"));
    var email = (Map<String, Object>) draft.get("email");
    assertEquals(false, email.get("send"));
    assertEquals(List.of(), email.get("recipients"));
    assertTrue(String.valueOf(email.get("body")).contains("ENTWURF – nicht versendet"));
    assertFalse(String.valueOf(email.get("body")).contains("Zahlungsnachweis"), "internal payment status stays out of the contractor email");
    assertEquals(true, result.get("readOnly"));
    assertEquals(0, result.get("dossierWrites"));
    assertEquals(4, ((List<?>) result.get("steps")).size());
  }

  @Test @SuppressWarnings("unchecked") void embeddedSelfApprovalInstructionIsReportedWithItsPageAndChangesNothing() throws Exception {
    for (String name : CORE) for (String page : pages(bytes(name))) assertTrue(EvidenceGuard.approvalInstructions(page).isEmpty(), name);
    var injected = document("baurechnung-rg-2026-0457-mit-anweisung.pdf");
    assertFalse(EvidenceGuard.suspicious(String.join("\n", pages(bytes("baurechnung-rg-2026-0457-mit-anweisung.pdf")))),
        "the generic quarantine misses this sentence; the approval rule must catch it");
    var documents = List.of(core().get(0), core().get(1), injected, core().get(3));
    var clean = ContractorPrecheck.run(dossier(core()), lexical(core()), ContractorPrecheck.UNTRACED, "en");
    var result = ContractorPrecheck.run(dossier(documents), lexical(documents), ContractorPrecheck.UNTRACED, "en");
    var instructions = (List<Map<String, Object>>) result.get("embeddedInstructions");
    assertEquals(1, instructions.size());
    assertEquals(2, instructions.getFirst().get("page"));
    assertTrue(String.valueOf(instructions.getFirst().get("quote")).contains("automatisch zur Zahlung freigeben"));
    assertEquals(clean.get("variance"), result.get("variance"), "the instruction does not change the computed amounts");
    var draft = (Map<String, Object>) result.get("draft");
    assertEquals(false, draft.get("approved"));
    assertEquals(false, draft.get("emailSent"));
    assertTrue(EvidenceGuard.untrustedForModel(injected.pages().get(1).text()), "page is excluded from model context");
    assertFalse(EvidenceGuard.untrustedForModel(injected.pages().get(0).text()));
  }

  @Test void noOtherBundledPdfIsTreatedAsAnApprovalInstruction() throws Exception {
    // The approval rule also filters model context, so it must not hide ordinary bundled fixtures.
    var flagged = new ArrayList<String>(); int scanned = 0;
    for (var resource : new org.springframework.core.io.support.PathMatchingResourcePatternResolver().getResources("classpath*:**/*.pdf")) {
      String name = Objects.requireNonNullElse(resource.getFilename(), "");
      if (name.equals("baurechnung-rg-2026-0457-mit-anweisung.pdf")) continue;
      byte[] bytes; try (var input = resource.getInputStream()) { bytes = input.readAllBytes(); }
      List<String> text; try { text = pages(bytes); } catch (IOException unreadable) { continue; }
      scanned++;
      for (String page : text) if (!EvidenceGuard.approvalInstructions(page).isEmpty()) flagged.add(name);
    }
    assertTrue(scanned >= 70, "scanned " + scanned + " bundled PDFs");
    assertEquals(List.of(), flagged);
  }

  @Test @SuppressWarnings("unchecked") void differentTaxBasisIsNeverSubtracted() throws Exception {
    var netInvoice = new DocumentExtractor().parse("netto-rechnung.pdf", List.of(new CreditCase.Page(1,
        "Baurechnung (Schlussrechnung) RG-2026-0999\nRechnungsnummer: RG-2026-0999\nRechnungsbetrag: 42.000,00 EUR netto\nFIKTIVE DATEN", "pdf-text")), null);
    var documents = List.of(core().get(0), core().get(1), netInvoice, core().get(3));
    var result = ContractorPrecheck.run(dossier(documents), null, ContractorPrecheck.UNTRACED, "en");
    var variance = (Map<String, Object>) result.get("variance");
    assertNull(variance.get("amount"));
    assertEquals(false, variance.get("sameTaxBasis"));
    var codes = ((List<Map<String, Object>>) result.get("findings")).stream().map(f -> f.get("code")).toList();
    assertTrue(codes.contains("TAX_BASIS_MISMATCH"), codes.toString());
    assertTrue(String.join(" ", (List<String>) ((Map<String, Object>) result.get("draft")).get("summary")).contains("No difference computed"));
  }

  @Test @SuppressWarnings("unchecked") void readsDoclingStyleCellsAndTables() throws Exception {
    // Docling appends each table cell on its own line and reports the positions table with row/column indexes.
    var cells = new ArrayList<CreditCase.TableCell>();
    String[][] rows = {{"Pos.", "Leistung", "Bezug", "Netto EUR"}, {"1", "Trockenbauwände und Deckenbekleidung Haus C", "WV-2026-031", "36.000,00"},
        {"2", "Schallschutz-Vorsatzschale Treppenhaus", "Nachtrag N-01", "4.991,60"}, {"3", "Zusätzliche Spachtelung Q3 Flur 2. OG", "ohne Nachtrag", "1.008,40"}};
    for (int r = 0; r < rows.length; r++) for (int c = 0; c < 4; c++) cells.add(new CreditCase.TableCell(r, c, rows[r][c]));
    var page1 = new CreditCase.Page(1, "Baurechnung (Schlussrechnung) RG-2026-0457\nRechnungsnummer:\nRG-2026-0457\nFIKTIVE DATEN", "docling");
    var region = new CreditCase.Region("r7", "49.980,00 EUR brutto", .4, .3, .8, .33, 595, 842, 0, 2, 1);
    var page2 = new CreditCase.Page(2, "Rechnungssumme\nNettobetrag:\n42.000,00 EUR netto\nUmsatzsteuer 19 %:\n7.980,00 EUR\nRechnungsbetrag:\n49.980,00 EUR brutto\nFIKTIVE DATEN", "docling", List.of(region));
    var invoice = new CreditCase.Document("doc-docling-invoice", "baurechnung-rg-2026-0457.pdf", "construction-invoice", "review", null, List.of(),
        List.of(page1, page2), true, "docling", "docling-layout-tableformer", "application/pdf", List.of(new CreditCase.Table(1, 4, 4, cells)));
    var lines = ContractorPrecheck.lines(invoice);
    assertEquals(3, lines.size());
    assertEquals("table row 3", lines.get(2).origin());
    assertEquals("Zusätzliche Spachtelung Q3 Flur 2. OG", lines.get(2).description());
    var documents = List.of(core().get(0), core().get(1), invoice, core().get(3));
    var result = ContractorPrecheck.run(dossier(documents), null, ContractorPrecheck.UNTRACED, "en");
    var source = (Map<String, Object>) ((Map<String, Object>) result.get("invoice")).get("source");
    assertEquals("r7", source.get("regionId"));
    assertEquals("1200.00", ((Map<String, Object>) result.get("variance")).get("amount"));
  }

  @Test @SuppressWarnings("unchecked") void everyStatedClaimCitesAPageThatContainsIt() throws Exception {
    var result = ContractorPrecheck.run(dossier(core()), lexical(core()), ContractorPrecheck.UNTRACED, "de");
    var checks = (List<Map<String, Object>>) result.get("citationChecks");
    assertTrue(checks.stream().map(c -> c.get("claim")).toList().containsAll(List.of("approved", "invoice", "invoice-line-3", "acceptance")), checks.toString());
    assertEquals(List.of(), checks.stream().filter(c -> !"SUPPORTED".equals(c.get("status"))).map(c -> c.get("ref")).toList(),
        "every claim is supported, except payment, which has no evidence in this dossier");
    assertEquals(Boolean.TRUE, ((Map<String, Object>) result.get("draft")).get("citationsVerified"));
    assertEquals(List.of(), result.get("isolatedPages"));
  }

  @Test void aCitationOnTheRightPageWithTheWrongContentIsNotSupported() throws Exception {
    var documents = core();
    var item = dossier(documents);
    var changeOrder = documents.get(1);
    // Page 1 of the change order exists and is cited, but the approved total is stated on page 2.
    var wrongPage = CitationCheck.verify(item, new CitationCheck.Claim("approved", changeOrder.id(), 1, "48.780,00 EUR brutto"));
    assertEquals("NOT_SUPPORTED", wrongPage.get("status"));
    assertEquals("[" + changeOrder.id() + ":p1]", wrongPage.get("ref"));
    var rightPage = CitationCheck.verify(item, new CitationCheck.Claim("approved", changeOrder.id(), 2, "48.780,00 EUR brutto"));
    assertEquals("SUPPORTED", rightPage.get("status"));
  }

  @Test void missingPageOrDocumentIsUnknownNeverGuessed() throws Exception {
    var documents = core();
    var item = dossier(documents);
    assertEquals("UNKNOWN", CitationCheck.verify(item, new CitationCheck.Claim("invoice", documents.get(2).id(), 9, "49.980,00 EUR brutto")).get("status"));
    assertEquals("UNKNOWN", CitationCheck.verify(item, new CitationCheck.Claim("invoice", "doc-missing", 1, "49.980,00 EUR brutto")).get("status"));
    assertEquals("UNKNOWN", CitationCheck.verify(item, new CitationCheck.Claim("acceptance", documents.get(3).id(), 1, " ")).get("status"));
  }

  @Test void anInvoiceAmountCitedToTheAcceptanceReportIsRejected() throws Exception {
    var documents = core();
    var item = dossier(documents);
    // The invoice's literal, cited against the acceptance report page, must be rejected.
    var check = CitationCheck.verify(item, new CitationCheck.Claim("invoice", documents.get(3).id(), 1, "49.980,00 EUR brutto"));
    assertEquals("NOT_SUPPORTED", check.get("status"));
  }

  // ---------------------------------------------------------------- helpers
  @SuppressWarnings("unchecked")
  private static void assertSource(Object value, String name, int page, String literal) {
    var source = (Map<String, Object>) value;
    assertEquals(name, source.get("documentName"));
    assertEquals(page, source.get("page"));
    assertTrue(String.valueOf(source.get("quote")).endsWith(literal), String.valueOf(source.get("quote")));
  }

  private static CreditCase dossier(List<CreditCase.Document> documents) {
    return new CreditCase("CR-ai103-test", "tenant-test", "AI-103 contractor dossier", "Pre-accounting check", 0, 0, "HUMAN_REVIEW",
        List.of(), List.of(), "", "2026-12-05T09:00:00Z", documents, List.of(), 7, "real-estate");
  }

  private static List<CreditCase.Document> core() throws IOException {
    var out = new ArrayList<CreditCase.Document>();
    for (String name : CORE) out.add(document(name));
    return out;
  }

  private static CreditCase.Document document(String name) throws IOException {
    var pages = new ArrayList<CreditCase.Page>();
    var text = pages(bytes(name));
    for (int i = 0; i < text.size(); i++) pages.add(new CreditCase.Page(i + 1, text.get(i), "pdf-text"));
    return new DocumentExtractor().parse(name, pages, null);
  }

  private static CreditCase.Document photo(String name, String ocr) {
    return new CreditCase.Document("doc-" + name, name, "unknown", "review", null, List.of(), List.of(new CreditCase.Page(1, ocr, "docling")),
        true, "docling", "docling-layout-tableformer", "image/png");
  }

  /** Stand-in for Qdrant/BM25: pages ranked by shared terms. */
  private static ContractorPrecheck.EvidenceSearch lexical(List<CreditCase.Document> documents) {
    return question -> {
      var terms = EvidenceGuard.terms(question);
      var hits = new ArrayList<ContractorPrecheck.Hit>();
      for (var d : documents) for (var p : d.pages()) {
        long shared = EvidenceGuard.terms(p.text()).stream().filter(terms::contains).count();
        if (shared > 0) hits.add(new ContractorPrecheck.Hit(d.id() + ":p" + p.number(), d.id(), p.number(), (double) shared, p.text()));
      }
      hits.sort(Comparator.comparingDouble(ContractorPrecheck.Hit::score).reversed());
      return new ContractorPrecheck.Retrieval("test-lexical", hits.stream().limit(5).toList());
    };
  }

  private static List<String> pages(byte[] pdf) throws IOException {
    try (var document = Loader.loadPDF(pdf)) {
      var stripper = new PDFTextStripper(); stripper.setSortByPosition(true);
      var pages = new ArrayList<String>();
      for (int page = 1; page <= document.getNumberOfPages(); page++) { stripper.setStartPage(page); stripper.setEndPage(page); pages.add(stripper.getText(document)); }
      return pages;
    }
  }

  private static byte[] bytes(String name) throws IOException {
    try (var input = new ClassPathResource(DIR + name).getInputStream()) { return input.readAllBytes(); }
  }

  private static JsonNode manifest() throws IOException {
    try (var input = new ClassPathResource(DIR + "manifest.json").getInputStream()) { return new ObjectMapper().readTree(input); }
  }
}
