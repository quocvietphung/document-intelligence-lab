package dev.creditlab.sources;

import dev.creditlab.sources.SourceContracts.ConnectorException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Deterministic project assessment. Totals, variances, revenue scenarios, margins, cost per m² and schedule
 * variance are computed here with exact decimals; a language model may only explain these results or draft
 * a report from them. Thresholds only request human review; they are not investment or lending decisions.
 */
public final class ProjectAssessment {
  private ProjectAssessment() {}
  public static final String METHOD = "deterministic-project-assessment-v1";
  static final BigDecimal COST_VARIANCE_REVIEW_PERCENT = new BigDecimal("5.00");
  static final BigDecimal MARGIN_REVIEW_PERCENT = new BigDecimal("10.00");
  static final long DELAY_REVIEW_DAYS = 30;

  public record CostLine(String name, BigDecimal planned, BigDecimal forecast) {}
  public record Scenario(String name, BigDecimal revenue) {}
  public record Milestone(String name, LocalDate planned, LocalDate forecast) {}
  public record Input(List<CostLine> costs, BigDecimal areaSqm, List<Scenario> scenarios, List<Milestone> milestones) {}

  /** CSV columns: type,name,planned,forecast. Types: cost, area, revenue, milestone. Decimal point, ISO dates. */
  public static Input parseCsv(String csv) {
    if (csv == null || csv.isBlank()) throw new ConnectorException("CSV_EMPTY", 422);
    if (csv.length() > 64_000) throw new ConnectorException("CSV_TOO_LARGE", 422);
    var lines = csv.strip().lines().map(String::strip).filter(l -> !l.isEmpty()).toList();
    if (!lines.getFirst().equalsIgnoreCase("type,name,planned,forecast")) throw new ConnectorException("CSV_HEADER_INVALID", 422);
    if (lines.size() > 201) throw new ConnectorException("CSV_TOO_MANY_ROWS", 422);
    var costs = new ArrayList<CostLine>(); var scenarios = new ArrayList<Scenario>(); var milestones = new ArrayList<Milestone>();
    BigDecimal area = null;
    for (int i = 1; i < lines.size(); i++) {
      String[] cells = lines.get(i).split(",", -1);
      if (cells.length != 4) throw new ConnectorException("CSV_ROW_INVALID", 422);
      String type = cells[0].strip().toLowerCase(Locale.ROOT), name = name(cells[1]), planned = cells[2].strip(), forecast = cells[3].strip();
      switch (type) {
        case "cost" -> costs.add(new CostLine(name, money(planned), forecast.isEmpty() ? money(planned) : money(forecast)));
        case "area" -> { if (area != null) throw new ConnectorException("CSV_DUPLICATE_AREA", 422); area = money(planned); }
        case "revenue" -> scenarios.add(new Scenario(name, money(planned)));
        case "milestone" -> milestones.add(new Milestone(name, date(planned), forecast.isEmpty() ? date(planned) : date(forecast)));
        default -> throw new ConnectorException("CSV_TYPE_INVALID", 422);
      }
    }
    if (costs.isEmpty()) throw new ConnectorException("CSV_COSTS_REQUIRED", 422);
    return new Input(costs, area, scenarios, milestones);
  }

  public static Map<String, Object> assess(Input input) {
    BigDecimal planned = input.costs().stream().map(CostLine::planned).reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal forecast = input.costs().stream().map(CostLine::forecast).reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal variance = forecast.subtract(planned);
    BigDecimal variancePercent = percent(variance, planned);
    var result = new LinkedHashMap<String, Object>();
    result.put("method", METHOD); result.put("currency", "EUR");
    var lines = input.costs().stream().map(l -> Map.<String, Object>of("name", l.name(), "planned", money(l.planned()), "forecast", money(l.forecast()),
        "variance", money(l.forecast().subtract(l.planned())))).toList();
    result.put("costs", Map.of("planned", money(planned), "forecast", money(forecast), "variance", money(variance),
        "variancePercent", variancePercent == null ? "n/a" : variancePercent.toPlainString(), "lines", lines));
    var flags = new ArrayList<Map<String, Object>>();
    flags.add(flag("COST_VARIANCE_ABOVE_THRESHOLD", COST_VARIANCE_REVIEW_PERCENT.toPlainString(), variancePercent == null ? "n/a" : variancePercent.toPlainString(),
        variancePercent != null && variancePercent.compareTo(COST_VARIANCE_REVIEW_PERCENT) > 0));
    if (input.areaSqm() != null && input.areaSqm().signum() > 0) {
      result.put("areaSqm", input.areaSqm().stripTrailingZeros().toPlainString());
      result.put("costPerSqm", Map.of("planned", money(planned.divide(input.areaSqm(), 2, RoundingMode.HALF_UP)),
          "forecast", money(forecast.divide(input.areaSqm(), 2, RoundingMode.HALF_UP))));
    } else result.put("costPerSqm", "n/a: no area supplied");
    var scenarios = new ArrayList<Map<String, Object>>();
    for (var scenario : input.scenarios()) {
      BigDecimal margin = scenario.revenue().subtract(forecast);
      BigDecimal marginPercent = percent(margin, scenario.revenue());
      scenarios.add(Map.of("name", scenario.name(), "revenue", money(scenario.revenue()), "margin", money(margin),
          "marginPercent", marginPercent == null ? "n/a" : marginPercent.toPlainString()));
      flags.add(flag("MARGIN_BELOW_THRESHOLD:" + scenario.name(), MARGIN_REVIEW_PERCENT.toPlainString(), marginPercent == null ? "n/a" : marginPercent.toPlainString(),
          marginPercent != null && marginPercent.compareTo(MARGIN_REVIEW_PERCENT) < 0));
    }
    result.put("revenueScenarios", scenarios);
    var schedule = new ArrayList<Map<String, Object>>();
    for (var milestone : input.milestones()) {
      long days = ChronoUnit.DAYS.between(milestone.planned(), milestone.forecast());
      schedule.add(Map.of("name", milestone.name(), "planned", milestone.planned().toString(), "forecast", milestone.forecast().toString(), "varianceDays", days));
      flags.add(flag("DELAY_ABOVE_THRESHOLD:" + milestone.name(), DELAY_REVIEW_DAYS + " days", days + " days", days > DELAY_REVIEW_DAYS));
    }
    result.put("schedule", schedule);
    result.put("reviewFlags", flags);
    result.put("humanReviewRequired", flags.stream().anyMatch(f -> Boolean.TRUE.equals(f.get("triggered"))));
    result.put("notice", "Deterministic calculation from the supplied figures. Review triggers are not an investment, valuation, lending or payment decision.");
    return result;
  }

  private static Map<String, Object> flag(String code, String threshold, String value, boolean triggered) {
    return Map.of("code", code, "threshold", threshold, "value", value, "triggered", triggered);
  }
  private static BigDecimal percent(BigDecimal part, BigDecimal whole) {
    return whole.signum() == 0 ? null : part.multiply(BigDecimal.valueOf(100)).divide(whole, 2, RoundingMode.HALF_UP);
  }
  private static String money(BigDecimal value) { return value.setScale(2, RoundingMode.HALF_UP).toPlainString(); }
  private static BigDecimal money(String raw) {
    if (!raw.matches("[0-9]{1,13}(\\.[0-9]{1,2})?")) throw new ConnectorException("CSV_NUMBER_INVALID", 422);
    return new BigDecimal(raw);
  }
  private static LocalDate date(String raw) {
    try { return LocalDate.parse(raw); } catch (RuntimeException e) { throw new ConnectorException("CSV_DATE_INVALID", 422); }
  }
  private static String name(String raw) {
    String value = IntakeChecks.displayText(raw, 80);
    if (value.isEmpty() || value.matches("^[=+\\-@].*")) throw new ConnectorException("CSV_NAME_INVALID", 422);
    return value;
  }
}
