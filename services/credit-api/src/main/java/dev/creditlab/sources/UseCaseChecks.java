package dev.creditlab.sources;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.sources.SourceContracts.ConnectorException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Runs each use case offline against its bundled fictional PDFs with deterministic rules: native PDF text,
 * labelled values, exact decimal arithmetic and fixed review thresholds. It checks that the answerable
 * question has its evidence on the cited page and that the unanswerable question has no supporting text,
 * so an assistant must abstain. No model, OCR service or network call is used.
 */
@Component
public class UseCaseChecks {
  static final BigDecimal PENALTY_PER_DAY_REVIEW = new BigDecimal("0.2");
  static final BigDecimal PENALTY_CAP_REVIEW = new BigDecimal("5");
  static final int WARRANTY_REVIEW_YEARS = 5;
  private final UseCaseCatalog catalog;

  public UseCaseChecks(UseCaseCatalog catalog) { this.catalog = catalog; }

  public Map<String, Object> run(String useCaseId) {
    JsonNode useCase = null;
    for (JsonNode node : catalog.catalog().path("useCases")) if (node.path("id").asText().equals(useCaseId)) useCase = node;
    if (useCase == null) throw new ConnectorException("UNKNOWN_USE_CASE", 404);
    var pages = new LinkedHashMap<String, List<String>>();
    for (JsonNode fixture : useCase.path("fixtures")) {
      var item = catalog.fixture(fixture.path("path").asText()).orElseThrow(() -> new ConnectorException("FIXTURE_UNAVAILABLE", 404));
      pages.put(item.path(), text(catalog.read(item)));
    }
    String all = String.join("\n", pages.values().stream().flatMap(List::stream).toList());
    var actual = new LinkedHashMap<String, String>();
    switch (useCaseId) {
      case "project-assessment" -> actual.putAll(projectAssessment(useCase.path("businessData").asText()));
      case "email-intake" -> {
        actual.put("attachments", String.valueOf(GmailSource.attachments(json(useCase.path("mockMessage").asText())).size()));
        for (String label : List.of("Nachtragsnummer", "Bezug Auftrag", "Nachtragssumme")) actual.put(label, value(all, label));
      }
      case "classification-extraction" -> {
        actual.put("documentType", all.contains("Rechnungsnummer") && all.contains("Bruttobetrag") ? "invoice" : "unknown");
        BigDecimal net = amount(value(all, "Nettobetrag")), vat = amount(value(all, "Umsatzsteuer 19 %")), gross = amount(value(all, "Bruttobetrag"));
        actual.put("net+vat=gross", net.add(vat).compareTo(gross) == 0 ? net + "+" + vat + "=" + gross : "mismatch");
      }
      case "project-status" -> {
        for (String label : List.of("Projektphase", "Status", "Fertigstellungsgrad Rohbau")) actual.put(label, value(all, label));
        actual.put("risks", String.valueOf(Arrays.stream(value(all, "Offene Risiken").split(";")).filter(s -> !s.isBlank()).count()));
      }
      case "contract-risk" -> actual.putAll(contract(all));
      case "order-change-invoice-acceptance" -> {
        BigDecimal order = amount(value(all, "Auftragssumme")), change = amount(value(all, "Nachtragssumme")), invoice = amount(value(all, "Rechnungsbetrag"));
        actual.put("variance", german(invoice.subtract(order.add(change))) + " EUR");
        actual.put("openDefects", value(all, "Offene Mängel"));
      }
      case "esg-evidence" -> actual.putAll(esg(all, useCase.path("fields")));
      case "knowledge-assistant" -> { /* evidence and abstention checks below */ }
      default -> throw new ConnectorException("UNKNOWN_USE_CASE", 404);
    }
    var checks = new ArrayList<Map<String, Object>>();
    for (JsonNode check : useCase.path("expectedValidation")) {
      String name = check.path("check").asText(), expected = check.path("expected").asText();
      String value = switch (name) {
        case "answerCitesSourcePage" -> String.valueOf(evidenceFound(useCase, pages));
        case "unsupportedQuestionAbstains" -> String.valueOf(absentTermsFound(useCase, all).isEmpty());
        default -> actual.getOrDefault(name, "not computed");
      };
      checks.add(Map.of("check", name, "expected", expected, "actual", value, "passed", expected.equals(value)));
    }
    boolean labelled = pages.values().stream().allMatch(p -> String.join(" ", p).toLowerCase(Locale.ROOT).contains("fiktiv"));
    var found = absentTermsFound(useCase, all);
    var result = new LinkedHashMap<String, Object>();
    result.put("useCaseId", useCaseId); result.put("method", "deterministic-native-text-v1"); result.put("networkCalls", 0);
    result.put("fixturesLabelledFictional", labelled);
    result.put("checks", checks);
    result.put("answerable", Map.of("answer", useCase.path("answerable").path("answer").asText(),
        "evidence", json(useCase.path("answerable").path("evidence")), "evidenceFoundOnCitedPage", evidenceFound(useCase, pages)));
    result.put("unanswerable", Map.of("expected", "abstain", "supportingTextFound", found, "mustAbstain", found.isEmpty()));
    result.put("passed", labelled && found.isEmpty() && evidenceFound(useCase, pages) && checks.stream().allMatch(c -> Boolean.TRUE.equals(c.get("passed"))));
    result.put("boundary", json(useCase.path("boundary")));
    return result;
  }

  private Map<String, String> projectAssessment(String csvPath) {
    if (!csvPath.matches("use-cases/[a-z0-9-]{1,80}\\.csv")) throw new ConnectorException("FIXTURE_UNAVAILABLE", 404);
    final String csv;
    try (var input = new ClassPathResource(csvPath).getInputStream()) { csv = new String(input.readNBytes(64_001), StandardCharsets.UTF_8); }
    catch (java.io.IOException e) { throw new ConnectorException("FIXTURE_UNAVAILABLE", 404); }
    var result = ProjectAssessment.assess(ProjectAssessment.parseCsv(csv));
    var actual = new LinkedHashMap<String, String>();
    @SuppressWarnings("unchecked") var costs = (Map<String, Object>) result.get("costs");
    for (String key : List.of("planned", "forecast", "variance", "variancePercent")) actual.put("costs." + key, String.valueOf(costs.get(key)));
    if (result.get("costPerSqm") instanceof Map<?, ?> perSqm) { actual.put("costPerSqm.planned", String.valueOf(perSqm.get("planned"))); actual.put("costPerSqm.forecast", String.valueOf(perSqm.get("forecast"))); }
    @SuppressWarnings("unchecked") var scenarios = (List<Map<String, Object>>) result.get("revenueScenarios");
    for (var scenario : scenarios) { actual.put("margin." + scenario.get("name"), String.valueOf(scenario.get("margin"))); actual.put("marginPercent." + scenario.get("name"), String.valueOf(scenario.get("marginPercent"))); }
    @SuppressWarnings("unchecked") var schedule = (List<Map<String, Object>>) result.get("schedule");
    for (var milestone : schedule) actual.put("varianceDays." + milestone.get("name"), String.valueOf(milestone.get("varianceDays")));
    actual.put("humanReviewRequired", String.valueOf(result.get("humanReviewRequired")));
    return actual;
  }

  static Map<String, String> contract(String text) {
    BigDecimal perDay = percent(value(text, "Vertragsstrafe je Werktag")), cap = percent(value(text, "Vertragsstrafe Obergrenze"));
    var years = Pattern.compile("(\\d{1,2})\\s+Jahre").matcher(value(text, "Gewährleistungsfrist"));
    int warranty = years.find() ? Integer.parseInt(years.group(1)) : -1;
    var actual = new LinkedHashMap<String, String>();
    actual.put("penaltyPerDayPercent", perDay.stripTrailingZeros().toPlainString());
    actual.put("penaltyCapPercent", cap.stripTrailingZeros().toPlainString());
    actual.put("warrantyYears", String.valueOf(warranty));
    actual.put("PENALTY_RATE_ABOVE_REVIEW_THRESHOLD", String.valueOf(perDay.compareTo(PENALTY_PER_DAY_REVIEW) > 0));
    actual.put("PENALTY_CAP_ABOVE_REVIEW_THRESHOLD", String.valueOf(cap.compareTo(PENALTY_CAP_REVIEW) > 0));
    actual.put("WARRANTY_BELOW_REVIEW_THRESHOLD", String.valueOf(warranty >= 0 && warranty < WARRANTY_REVIEW_YEARS));
    return actual;
  }

  static Map<String, String> esg(String text, JsonNode fields) {
    int present = 0, missing = 0, pending = 0, total = 0;
    for (JsonNode field : fields) {
      String status = value(text, field.asText()).toLowerCase(Locale.ROOT);
      total++;
      if (status.startsWith("vorhanden")) present++;
      else if (status.startsWith("in prüfung")) pending++;
      else missing++;
    }
    return Map.of("present", String.valueOf(present), "missing", String.valueOf(missing), "pending", String.valueOf(pending),
        "completenessPercent", String.valueOf(total == 0 ? 0 : present * 100 / total));
  }

  private boolean evidenceFound(JsonNode useCase, Map<String, List<String>> pages) {
    JsonNode evidence = useCase.path("answerable").path("evidence");
    var document = pages.get(evidence.path("path").asText());
    int page = evidence.path("page").asInt(0);
    return document != null && page >= 1 && page <= document.size() && normalize(document.get(page - 1)).contains(normalize(evidence.path("quote").asText("\u0000")));
  }

  private static List<String> absentTermsFound(JsonNode useCase, String all) {
    var found = new ArrayList<String>();
    String haystack = normalize(all).toLowerCase(Locale.ROOT);
    for (JsonNode term : useCase.path("unanswerable").path("absentTerms")) if (haystack.contains(normalize(term.asText()).toLowerCase(Locale.ROOT))) found.add(term.asText());
    return found;
  }

  /** Label on the same line or the next line (table cells may be extracted either way). */
  static String value(String text, String label) {
    var matcher = Pattern.compile(Pattern.quote(label) + ":[ \\t]*\\R?[ \\t]*([^\\r\\n]+)").matcher(text);
    return matcher.find() ? matcher.group(1).strip() : "";
  }

  static BigDecimal amount(String raw) {
    var matcher = Pattern.compile("(\\d{1,3}(?:\\.\\d{3})*,\\d{2})").matcher(raw);
    if (!matcher.find()) throw new ConnectorException("AMOUNT_NOT_FOUND", 422);
    return new BigDecimal(matcher.group(1).replace(".", "").replace(",", "."));
  }

  private static BigDecimal percent(String raw) {
    var matcher = Pattern.compile("(\\d{1,2}(?:,\\d{1,2})?)\\s*%").matcher(raw);
    if (!matcher.find()) throw new ConnectorException("PERCENT_NOT_FOUND", 422);
    return new BigDecimal(matcher.group(1).replace(",", "."));
  }

  private static String german(BigDecimal value) {
    String plain = value.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    String integer = plain.substring(0, plain.indexOf('.')), cents = plain.substring(plain.indexOf('.') + 1);
    var grouped = new StringBuilder();
    for (int i = 0; i < integer.length(); i++) { if (i > 0 && (integer.length() - i) % 3 == 0) grouped.append('.'); grouped.append(integer.charAt(i)); }
    return grouped + "," + cents;
  }

  private static String normalize(String text) {
    return Normalizer.normalize(Objects.requireNonNullElse(text, ""), Normalizer.Form.NFKC).replaceAll("\\s+", " ").strip();
  }

  static List<String> text(byte[] pdf) {
    try (var document = Loader.loadPDF(pdf)) {
      var stripper = new PDFTextStripper(); stripper.setSortByPosition(true);
      var pages = new ArrayList<String>();
      for (int page = 1; page <= document.getNumberOfPages(); page++) { stripper.setStartPage(page); stripper.setEndPage(page); pages.add(stripper.getText(document)); }
      return pages;
    } catch (java.io.IOException e) { throw new ConnectorException("FIXTURE_UNREADABLE", 500); }
  }

  private JsonNode json(String path) {
    if (!path.matches("use-cases/[a-z0-9-]{1,80}\\.json")) throw new ConnectorException("FIXTURE_UNAVAILABLE", 404);
    try (var input = new ClassPathResource(path).getInputStream()) { return new ObjectMapper().readTree(input); }
    catch (java.io.IOException e) { throw new ConnectorException("FIXTURE_UNAVAILABLE", 404); }
  }

  private static Object json(JsonNode node) { return new ObjectMapper().convertValue(node, Object.class); }
}
