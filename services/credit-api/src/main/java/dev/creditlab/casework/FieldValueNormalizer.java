package dev.creditlab.casework;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;

public final class FieldValueNormalizer {
  private FieldValueNormalizer() {}

  public static String normalize(String label, String value) {
    if (value == null) return "";
    return switch (label) {
      case "netIncome", "payoutAmount", "monthlyRate", "balance", "premium", "deductible", "coverageAmount", "invoiceTotal" -> money(value);
      case "date", "coverageStart", "coverageEnd", "claimDate" -> date(value);
      default -> value.strip().replaceAll("\\s+"," ").toLowerCase(Locale.ROOT);
    };
  }

  private static String money(String raw) {
    String value=raw.replaceAll("[^0-9,.-]","");
    if (value.isBlank()) return raw.strip().toLowerCase(Locale.ROOT);
    int comma=value.lastIndexOf(','), dot=value.lastIndexOf('.');
    char decimal=comma>=0&&dot>=0?(comma>dot?',':'.'):(comma>=0?',':'.');
    int position=value.lastIndexOf(decimal);
    boolean hasDecimal=position>=0 && value.length()-position-1>0 && value.length()-position-1<=2;
    String canonical;
    if (hasDecimal) {
      canonical=value.substring(0,position).replaceAll("[,.]","")+"."+value.substring(position+1);
    } else canonical=value.replaceAll("[,.]","");
    try { return new BigDecimal(canonical).stripTrailingZeros().toPlainString(); }
    catch (NumberFormatException ignored) { return raw.strip().toLowerCase(Locale.ROOT); }
  }

  private static String date(String raw) {
    for (var format: List.of(DateTimeFormatter.ISO_LOCAL_DATE,DateTimeFormatter.ofPattern("d.M.uuuu"),
        DateTimeFormatter.ofPattern("d/M/uuuu"))) {
      try { return LocalDate.parse(raw.strip(),format).toString(); }
      catch (DateTimeParseException ignored) { }
    }
    return raw.strip().toLowerCase(Locale.ROOT);
  }
}
