package dev.creditlab.precheck;

import dev.creditlab.casework.CreditCase;
import dev.creditlab.platform.EvidenceGuard;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pre-accounting check of a contractor dossier (order, change orders, invoice, acceptance report, photos, payment
 * evidence). Amounts are read from the extracted page text and tables, kept with their page, and compared with
 * BigDecimal only on the same tax basis. Evidence search only nominates candidate pages; a literal text rule confirms
 * them. The result is a draft for a person: this class never changes the dossier, approves, pays or sends anything.
 */
public final class ContractorPrecheck {
  public static final String METHOD = "contractor-precheck-v1";
  public static final String BOUNDARY = "Research support only. A draft for human review: no approval, payment release, legal acceptance or email delivery.";
  private ContractorPrecheck() {}

  public record Hit(String id, String documentId, int page, double score, String text) {}
  /** Candidate retrieval (Qdrant/BM25 in the API, a plain lexical scan in tests). */
  @FunctionalInterface public interface EvidenceSearch { Retrieval search(String question); }
  public record Retrieval(String backend, List<Hit> hits) {}
  /** Timing/tracing hook around each step. */
  public interface Steps { <T> T step(String name, Supplier<T> body); }
  public static final Steps UNTRACED = new Steps() { @Override public <T> T step(String name, Supplier<T> body) { return body.get(); } };

  enum Basis { NET, VAT, GROSS, UNKNOWN }
  record Amount(String role, String kind, Basis basis, BigDecimal value, String literal, String documentId, String documentName,
      int page, String label, String regionId) {
    Map<String, Object> source() {
      var source = new LinkedHashMap<String, Object>();
      source.put("documentId", documentId); source.put("documentName", documentName); source.put("page", page);
      source.put("label", label); source.put("quote", label + ": " + literal); source.put("regionId", regionId);
      source.put("ref", "[" + documentId + ":p" + page + "]");
      return source;
    }
  }
  record Line(int position, String description, String reference, BigDecimal net, String documentId, String documentName, int page, String origin) {}
  record LabelValue(String value, String documentId, String documentName, int page) {}
  record Doc(CreditCase.Document document, String role) {}

  private static final Pattern MONEY = Pattern.compile("(?<![\\d.,])(\\d{1,3}(?:\\.\\d{3})*,\\d{2})\\s*(?:EUR|€)(?:\\s+(netto|brutto))?", Pattern.CASE_INSENSITIVE);
  private static final Pattern PLAIN_MONEY = Pattern.compile("(?<![\\d.,])(\\d{1,3}(?:\\.\\d{3})*,\\d{2})(?![\\d,])");
  private static final Pattern LABEL = Pattern.compile("^\\s*(\\p{L}[\\p{L}\\p{N} .%()/-]{1,60}?)\\s*:\\s*(.*)$");
  private static final Pattern REFERENCE_LINE = Pattern.compile("^\\s*(?:(\\d{1,2})\\s+)?(.*?)\\s*(\\p{Lu}{2,4}-\\d{4}-\\d{3,4}|Nachtrag\\s+\\p{L}{1,3}-\\d{1,3}|ohne Nachtrag)\\s+(\\d{1,3}(?:\\.\\d{3})*,\\d{2})\\s*$");
  private static final Pattern PHOTO_REF = Pattern.compile("\\bF\\s?-\\s?([0-9OoIl]{2})\\b");
  private static final Pattern PAYMENT_CONFIRMATION = Pattern.compile("(?iu)(?:bezahlt am|überwiesen am|zahlungseingang am|zahlung ausgeführt am|ausführungsdatum|buchungstag|paid on|đã thanh toán ngày)\\s*:?\\s*\\d{1,2}[./]\\d{1,2}[./]\\d{4}");

  public static Map<String, Object> run(CreditCase item, EvidenceSearch search, Steps steps, String locale) {
    String language = Set.of("de", "en", "vi").contains(locale) ? locale : "en";
    var timings = new ArrayList<Map<String, Object>>();
    var extracted = timed(timings, steps, "extract", () -> extract(item));
    var retrieval = timed(timings, steps, "search", () -> search(extracted, search));
    var reconciled = timed(timings, steps, "reconcile", () -> reconcile(extracted, retrieval));
    var draft = timed(timings, steps, "draft", () -> draft(extracted, reconciled, language));
    var result = new LinkedHashMap<String, Object>();
    result.put("method", METHOD);
    result.put("caseId", item.id()); result.put("caseVersion", item.version()); result.put("domain", item.domain());
    result.put("readOnly", true); result.put("dossierWrites", 0); result.put("locale", language);
    result.put("documents", extracted.documents().stream().map(d -> {
      var row = new LinkedHashMap<String, Object>();
      row.put("id", d.document().id()); row.put("name", d.document().name()); row.put("role", d.role());
      row.put("type", d.document().type()); row.put("reviewStatus", d.document().status()); row.put("pages", d.document().pages().size());
      row.put("provider", Objects.requireNonNullElse(d.document().analysisProvider(), "unknown"));
      return row;
    }).toList());
    result.putAll(reconciled);
    result.put("draft", draft);
    // Claim-level citations: every stated amount, invoice line and status must be on the page it cites.
    var checks = citationChecks(item, reconciled);
    result.put("citationChecks", checks);
    result.put("isolatedPages", List.copyOf(dev.creditlab.platform.PageIsolation.quarantinedPages(item)));
    @SuppressWarnings("unchecked") var findings = (List<Map<String, Object>>) result.get("findings");
    for (var check : checks) if ("NOT_SUPPORTED".equals(check.get("status")))
      findings.add(finding("CITATION_NOT_SUPPORTED", "HIGH", "The cited page " + check.get("ref") + " does not contain the stated " + check.get("claim") + " amount or status",
          List.of(Map.of("ref", String.valueOf(check.get("ref"))))));
    draft.put("citationsVerified", checks.stream().noneMatch(c -> "NOT_SUPPORTED".equals(c.get("status"))));
    result.put("steps", timings);
    result.put("boundary", BOUNDARY);
    return result;
  }

  private static <T> T timed(List<Map<String, Object>> timings, Steps steps, String name, Supplier<T> body) {
    long start = System.nanoTime();
    T value = steps.step(name, body);
    timings.add(Map.of("name", name, "durationMs", Math.round((System.nanoTime() - start) / 10_000.0) / 100.0));
    return value;
  }

  // ---------------------------------------------------------------- extract: roles, labelled amounts, table lines
  record Extraction(List<Doc> documents, List<Amount> amounts, List<Line> lines, List<Map<String, Object>> instructions) {}

  static Extraction extract(CreditCase item) {
    var documents = item.documents().stream().filter(CreditCase.Document::originalAvailable).map(d -> new Doc(d, role(d))).toList();
    var amounts = new ArrayList<Amount>();
    var lines = new ArrayList<Line>();
    var instructions = new ArrayList<Map<String, Object>>();
    for (var doc : documents) {
      amounts.addAll(amounts(doc.document(), doc.role()));
      if (doc.role().equals("invoice")) lines.addAll(lines(doc.document()));
      for (var page : doc.document().pages())
        for (String quote : EvidenceGuard.approvalInstructions(page.text())) {
          var row = new LinkedHashMap<String, Object>();
          row.put("documentId", doc.document().id()); row.put("documentName", doc.document().name()); row.put("page", page.number());
          row.put("quote", quote); row.put("ref", "[" + doc.document().id() + ":p" + page.number() + "]");
          row.put("handling", "IGNORED_AS_INSTRUCTION; EXCLUDED_FROM_MODEL_CONTEXT; SHOWN_TO_REVIEWER");
          instructions.add(row);
        }
    }
    return new Extraction(documents, List.copyOf(amounts), List.copyOf(lines), List.copyOf(instructions));
  }

  static String role(CreditCase.Document d) {
    String text = all(d);
    String lower = text.toLowerCase(Locale.ROOT);
    String name = d.name().toLowerCase(Locale.ROOT);
    if (Objects.requireNonNullElse(d.contentType(), "").startsWith("image/") || name.matches(".*\\.(png|jpe?g)$"))
      return PHOTO_REF.matcher(text).find() ? "photo" : "other";
    switch (Objects.requireNonNullElse(d.type(), "")) {
      case "acceptance-report" -> { return "acceptance"; }
      case "change-order" -> { return "change-order"; }
      case "construction-invoice", "invoice" -> { return "invoice"; }
      case "construction-order", "contract" -> { return "contract"; }
      default -> { }
    }
    if (PAYMENT_CONFIRMATION.matcher(text).find() || lower.contains("zahlungsbestätigung") || lower.contains("überweisungsbeleg")) return "payment";
    if (lower.contains("abnahmeprotokoll")) return "acceptance";
    if (lower.contains("nachtragsnummer")) return "change-order";
    if (lower.contains("rechnungsnummer")) return "invoice";
    if (lower.contains("bauauftrag") || lower.contains("werkvertrag")) return "contract";
    return "other";
  }

  static List<Amount> amounts(CreditCase.Document d, String role) {
    var out = new ArrayList<Amount>();
    for (var page : d.pages()) {
      String[] lines = page.text().split("\\R");
      for (int i = 0; i < lines.length; i++) {
        var label = LABEL.matcher(lines[i]);
        if (!label.matches()) continue;
        String name = label.group(1).strip(), value = label.group(2).strip();
        if (value.isEmpty()) { int next = i + 1; while (next < lines.length && lines[next].isBlank()) next++; if (next < lines.length) value = lines[next].strip(); }
        var money = MONEY.matcher(value);
        if (!money.find() || money.start() != 0) continue;
        String kind = kind(role, name);
        if (kind == null) continue;
        out.add(new Amount(role, kind, basis(name, money.group(2)), decimal(money.group(1)), value.substring(0, money.end()).strip(),
            d.id(), d.name(), page.number(), name, region(page, money.group(1))));
      }
    }
    return out;
  }

  static String kind(String role, String label) {
    String l = label.toLowerCase(Locale.ROOT);
    if (!Set.of("contract", "change-order", "invoice").contains(role)) return null;
    if (l.matches(".*(umsatzsteuer|\\bust\\b|mwst|\\bvat\\b).*")) return "vat";
    return switch (role) {
      case "contract" -> l.matches(".*(auftragssumme|vertragssumme|vergütung|auftragswert).*") ? "order" : null;
      case "change-order" -> l.matches(".*genehmigte (gesamtvergütung|gesamtsumme|auftragssumme).*") ? "approvedTotal"
          : l.matches(".*(nachtragssumme|nachtragsvergütung|nachtragswert).*") ? "changeOrder" : null;
      case "invoice" -> l.matches(".*(rechnungsbetrag|gesamtbetrag|bruttobetrag|nettobetrag|rechnungssumme).*") ? "invoice" : null;
      default -> null;
    };
  }

  static Basis basis(String label, String suffix) {
    String l = (label + " " + Objects.requireNonNullElse(suffix, "")).toLowerCase(Locale.ROOT);
    if (l.matches(".*(umsatzsteuer|\\bust\\b|mwst|\\bvat\\b).*")) return Basis.VAT;
    boolean gross = l.matches(".*(brutto|inkl\\.? ?ust|\\bgross\\b).*"), net = l.matches(".*(netto|zzgl|\\bnet\\b).*");
    return gross && !net ? Basis.GROSS : net && !gross ? Basis.NET : Basis.UNKNOWN;
  }

  private static String region(CreditCase.Page page, String literal) {
    var starts = page.regions().stream().filter(r -> r.text().strip().startsWith(literal)).toList();
    if (!starts.isEmpty()) return starts.getFirst().id();
    var contains = page.regions().stream().filter(r -> r.text().contains(literal)).toList();
    return contains.size() == 1 ? contains.getFirst().id() : null;
  }

  static List<Line> lines(CreditCase.Document d) {
    for (var table : d.tables()) {
      var rows = new TreeMap<Integer, Map<Integer, String>>();
      for (var cell : table.cells()) rows.computeIfAbsent(cell.row(), r -> new TreeMap<>()).put(cell.column(), cell.text().replaceAll("\\s+", " ").strip());
      Integer headerRow = null; int pos = -1, text = -1, ref = -1, net = -1;
      for (var row : rows.entrySet()) {
        for (var cell : row.getValue().entrySet()) {
          String h = cell.getValue().toLowerCase(Locale.ROOT);
          if (h.matches("pos\\.?|position")) pos = cell.getKey();
          else if (h.matches(".*(leistung|beschreibung).*")) text = cell.getKey();
          else if (h.matches(".*(bezug|referenz).*")) ref = cell.getKey();
          else if (h.contains("netto")) net = cell.getKey();
        }
        if (pos >= 0 && net >= 0) { headerRow = row.getKey(); break; }
        pos = -1; text = -1; ref = -1; net = -1;
      }
      if (headerRow == null) continue;
      var out = new ArrayList<Line>();
      for (var row : rows.tailMap(headerRow, false).entrySet()) {
        var cells = row.getValue();
        var amount = PLAIN_MONEY.matcher(cells.getOrDefault(net, ""));
        String position = cells.getOrDefault(pos, "").replaceAll("[^0-9]", "");
        if (!amount.find() || position.isEmpty()) continue;
        out.add(new Line(Integer.parseInt(position), cells.getOrDefault(text, ""), cells.getOrDefault(ref, ""), decimal(amount.group(1)),
            d.id(), d.name(), table.page(), "table row " + row.getKey()));
      }
      if (!out.isEmpty()) return out;
    }
    // Native-text fallback (no table structure): one line per reference + net amount, in reading order.
    var out = new ArrayList<Line>();
    for (var page : d.pages()) for (String line : page.text().split("\\R")) {
      var m = REFERENCE_LINE.matcher(line);
      if (!m.matches()) continue;
      int position = m.group(1) != null ? Integer.parseInt(m.group(1)) : out.size() + 1;
      out.add(new Line(position, m.group(2).strip(), m.group(3).replaceAll("\\s+", " "), decimal(m.group(4)), d.id(), d.name(), page.number(), "text line"));
    }
    return out;
  }

  // ---------------------------------------------------------------- search: retrieval nominates, rules confirm
  static List<Map<String, Object>> search(Extraction extracted, EvidenceSearch search) {
    var roles = new HashMap<String, String>();
    extracted.documents().forEach(d -> roles.put(d.document().id(), d.role()));
    var pagesById = new HashMap<String, String>();
    extracted.documents().forEach(d -> d.document().pages().forEach(p -> pagesById.put(d.document().id() + ":" + p.number(), p.text())));
    var queries = new LinkedHashMap<String, String>();
    queries.put("approved", "Genehmigte Gesamtvergütung brutto Nachtrag genehmigt");
    queries.put("invoice", "Rechnungsbetrag brutto Rechnungssumme Umsatzsteuer");
    queries.put("acceptance", "Abnahmeprotokoll Abnahmeergebnis abgenommen Umfang Mängel");
    queries.put("payment", "Zahlungsnachweis Zahlung bezahlt überwiesen Zahlungseingang");
    var out = new ArrayList<Map<String, Object>>();
    for (var query : queries.entrySet()) {
      Retrieval retrieved;
      try { retrieved = search == null ? new Retrieval("none", List.of()) : search.search(query.getValue()); }
      catch (RuntimeException unavailable) { retrieved = new Retrieval("unavailable", List.of()); }
      var hits = new ArrayList<Map<String, Object>>();
      for (var hit : retrieved.hits()) {
        String role = roles.getOrDefault(hit.documentId(), "other");
        String page = pagesById.getOrDefault(hit.documentId() + ":" + hit.page(), "");
        boolean confirmed = switch (query.getKey()) {
          case "approved" -> role.equals("change-order") && extracted.amounts().stream().anyMatch(a -> a.kind().equals("approvedTotal") && a.documentId().equals(hit.documentId()) && a.page() == hit.page());
          case "invoice" -> role.equals("invoice") && extracted.amounts().stream().anyMatch(a -> a.kind().equals("invoice") && a.documentId().equals(hit.documentId()) && a.page() == hit.page());
          case "acceptance" -> role.equals("acceptance");
          default -> PAYMENT_CONFIRMATION.matcher(page).find();
        };
        var row = new LinkedHashMap<String, Object>();
        row.put("id", hit.id()); row.put("documentId", hit.documentId()); row.put("page", hit.page()); row.put("score", hit.score());
        row.put("role", role); row.put("confirmed", confirmed);
        hits.add(row);
      }
      var row = new LinkedHashMap<String, Object>();
      row.put("purpose", query.getKey()); row.put("question", query.getValue()); row.put("backend", retrieved.backend()); row.put("hits", hits);
      out.add(row);
    }
    return out;
  }

  // ---------------------------------------------------------------- reconcile: same tax basis, exact decimals
  static Map<String, Object> reconcile(Extraction x, List<Map<String, Object>> retrieval) {
    var findings = new ArrayList<Map<String, Object>>();
    var out = new LinkedHashMap<String, Object>();

    var orderNumber = labelValue(x, "contract", "Auftragsnummer");
    var changeNumbers = new LinkedHashMap<String, Boolean>();
    for (var doc : x.documents()) if (doc.role().equals("change-order")) {
      var number = labelValue(doc.document(), "Nachtragsnummer");
      var status = labelValue(doc.document(), "Genehmigungsstatus").or(() -> labelValue(doc.document(), "Freigabestatus"));
      boolean approved = status.map(s -> s.value().toLowerCase(Locale.ROOT)).filter(s -> s.contains("genehmigt") || s.contains("freigegeben")).filter(s -> !s.contains("nicht")).isPresent();
      number.ifPresent(n -> changeNumbers.put(n.value().strip(), approved));
    }

    // Approved amount: the stated approved total, cross-checked against order + approved change orders.
    var approvedTotal = single(x, findings, "change-order", "approvedTotal", null);
    var orderGross = single(x, findings, "contract", "order", Basis.GROSS);
    var orderNet = single(x, findings, "contract", "order", Basis.NET);
    var changeGross = perDocumentSum(x, "change-order", "changeOrder", Basis.GROSS);
    var changeNet = perDocumentSum(x, "change-order", "changeOrder", Basis.NET);
    Amount approved = approvedTotal.orElse(null);
    BigDecimal approvedValue = approved != null ? approved.value() : orderGross.map(o -> o.value().add(changeGross.orElse(BigDecimal.ZERO))).orElse(null);
    Basis approvedBasis = approved != null ? approved.basis() : orderGross.isPresent() ? Basis.GROSS : Basis.UNKNOWN;
    var approvedJson = new LinkedHashMap<String, Object>();
    approvedJson.put("amount", money(approvedValue)); approvedJson.put("basis", approvedBasis.name());
    approvedJson.put("literal", approved != null ? approved.literal() : null);
    approvedJson.put("source", approved != null ? approved.source() : orderGross.map(Amount::source).orElse(null));
    approvedJson.put("derivation", approved != null ? "stated approved total" : orderGross.isPresent() ? "order + change orders (computed)" : "not found");
    if (orderGross.isPresent()) {
      BigDecimal computed = orderGross.get().value().add(changeGross.orElse(BigDecimal.ZERO));
      var cross = new LinkedHashMap<String, Object>();
      cross.put("order", money(orderGross.get().value())); cross.put("orderSource", orderGross.get().source());
      cross.put("changeOrders", money(changeGross.orElse(BigDecimal.ZERO)));
      cross.put("changeOrderSources", x.amounts().stream().filter(a -> a.kind().equals("changeOrder") && a.basis() == Basis.GROSS).map(Amount::source).toList());
      cross.put("sum", money(computed)); cross.put("consistent", approvedValue != null && computed.compareTo(approvedValue) == 0);
      approvedJson.put("crossCheck", cross);
      if (approvedValue != null && computed.compareTo(approvedValue) != 0)
        findings.add(finding("APPROVED_TOTAL_INCONSISTENT", "HIGH", "Stated approved total differs from order plus change orders", List.of()));
    }
    if (approvedValue == null) findings.add(finding("APPROVED_AMOUNT_NOT_FOUND", "HIGH", "No approved amount with a tax basis was found in the order or change orders", List.of()));
    out.put("approved", approvedJson);

    var invoiceGross = single(x, findings, "invoice", "invoice", Basis.GROSS);
    var invoiceNet = single(x, findings, "invoice", "invoice", Basis.NET);
    var invoiceVat = single(x, findings, "invoice", "vat", Basis.VAT);
    var invoiceJson = new LinkedHashMap<String, Object>();
    invoiceJson.put("amount", invoiceGross.map(a -> money(a.value())).orElse(null)); invoiceJson.put("basis", invoiceGross.isPresent() ? "GROSS" : "UNKNOWN");
    invoiceJson.put("literal", invoiceGross.map(Amount::literal).orElse(null)); invoiceJson.put("source", invoiceGross.map(Amount::source).orElse(null));
    invoiceJson.put("net", invoiceNet.map(a -> money(a.value())).orElse(null)); invoiceJson.put("vat", invoiceVat.map(a -> money(a.value())).orElse(null));
    invoiceJson.put("number", labelValue(x, "invoice", "Rechnungsnummer").map(LabelValue::value).orElse(null));
    invoiceJson.put("date", labelValue(x, "invoice", "Rechnungsdatum").map(LabelValue::value).orElse(null));
    if (invoiceGross.isPresent() && invoiceNet.isPresent() && invoiceVat.isPresent()) {
      boolean arithmetic = invoiceNet.get().value().add(invoiceVat.get().value()).compareTo(invoiceGross.get().value()) == 0;
      invoiceJson.put("netPlusVatEqualsGross", arithmetic);
      if (!arithmetic) findings.add(finding("INVOICE_ARITHMETIC_MISMATCH", "HIGH", "Invoice net plus VAT does not equal the gross amount", List.of(invoiceGross.get().source())));
    }
    if (invoiceGross.isEmpty()) findings.add(finding("INVOICE_AMOUNT_NOT_FOUND", "HIGH", "No invoice total with an explicit gross basis was found", List.of()));
    out.put("invoice", invoiceJson);

    // Lines: approval by order/change-order reference, sum against the stated net amount.
    var lines = new ArrayList<Map<String, Object>>();
    var unapprovedNet = BigDecimal.ZERO;
    BigDecimal linesNet = BigDecimal.ZERO;
    for (var line : x.lines()) {
      boolean approvedLine = orderNumber.map(n -> line.reference().equals(n.value().strip())).orElse(false)
          || changeNumbers.entrySet().stream().anyMatch(e -> e.getValue() && line.reference().contains(e.getKey()));
      linesNet = linesNet.add(line.net());
      if (!approvedLine) unapprovedNet = unapprovedNet.add(line.net());
      var row = new LinkedHashMap<String, Object>();
      row.put("position", line.position()); row.put("description", line.description()); row.put("reference", line.reference());
      row.put("net", money(line.net())); row.put("approved", approvedLine);
      row.put("source", Map.of("documentId", line.documentId(), "documentName", line.documentName(), "page", line.page(), "origin", line.origin(),
          "ref", "[" + line.documentId() + ":p" + line.page() + "]"));
      lines.add(row);
      if (!approvedLine) findings.add(finding("INVOICE_LINE_WITHOUT_APPROVAL", "HIGH",
          "Invoice line " + line.position() + " (" + line.reference() + ", " + german(line.net()) + " EUR netto) is not covered by the order or an approved change order",
          List.of(Map.of("documentId", line.documentId(), "page", line.page(), "ref", "[" + line.documentId() + ":p" + line.page() + "]"))));
    }
    if (!x.lines().isEmpty() && invoiceNet.isPresent() && linesNet.compareTo(invoiceNet.get().value()) != 0)
      findings.add(finding("INVOICE_LINES_DIFFER_FROM_NET", "MEDIUM", "Observed invoice lines do not add up to the stated net amount", List.of(invoiceNet.get().source())));

    // Variance only on a shared tax basis.
    var variance = new LinkedHashMap<String, Object>();
    BigDecimal gap = null;
    if (approvedValue != null && invoiceGross.isPresent() && approvedBasis == Basis.GROSS) {
      gap = invoiceGross.get().value().subtract(approvedValue);
      variance.put("amount", money(gap)); variance.put("basis", "GROSS"); variance.put("sameTaxBasis", true);
    } else if (approvedValue != null && invoiceNet.isPresent() && approvedBasis == Basis.NET) {
      gap = invoiceNet.get().value().subtract(approvedValue);
      variance.put("amount", money(gap)); variance.put("basis", "NET"); variance.put("sameTaxBasis", true);
    } else {
      variance.put("amount", null); variance.put("basis", null); variance.put("sameTaxBasis", false);
      if (approvedValue != null && (invoiceGross.isPresent() || invoiceNet.isPresent()))
        findings.add(finding("TAX_BASIS_MISMATCH", "HIGH", "Approved amount (" + approvedBasis + ") and invoice do not share a stated tax basis; no variance computed", List.of()));
    }
    if (orderNet.isPresent() && invoiceNet.isPresent()) {
      BigDecimal approvedNet = orderNet.get().value().add(changeNet.orElse(BigDecimal.ZERO));
      variance.put("net", money(invoiceNet.get().value().subtract(approvedNet)));
      if (gap != null && "GROSS".equals(variance.get("basis"))) variance.put("vat", money(gap.subtract(invoiceNet.get().value().subtract(approvedNet))));
    }
    out.put("variance", variance);
    if (gap != null && gap.signum() > 0)
      findings.addFirst(finding("INVOICE_EXCEEDS_APPROVED_AMOUNT", "HIGH", "Invoice exceeds the approved amount by " + german(gap) + " EUR (" + variance.get("basis") + ")",
          List.of(invoiceGross.map(Amount::source).orElse(Map.of()), approved != null ? approved.source() : orderGross.map(Amount::source).orElse(Map.of()))));
    else if (gap != null && gap.signum() < 0)
      findings.addFirst(finding("INVOICE_BELOW_APPROVED_AMOUNT", "MEDIUM", "Invoice is below the approved amount by " + german(gap.abs()) + " EUR; check partial billing", List.of()));

    BigDecimal rate = invoiceNet.isPresent() && invoiceVat.isPresent() && invoiceNet.get().value().signum() > 0
        ? invoiceVat.get().value().divide(invoiceNet.get().value(), 4, RoundingMode.HALF_UP) : null;
    var explanation = new LinkedHashMap<String, Object>();
    explanation.put("unapprovedNet", money(unapprovedNet)); explanation.put("vatRate", rate == null ? null : rate.stripTrailingZeros().toPlainString());
    BigDecimal unapprovedGross = rate == null ? null : unapprovedNet.multiply(BigDecimal.ONE.add(rate)).setScale(2, RoundingMode.HALF_UP);
    explanation.put("unapprovedGross", money(unapprovedGross));
    explanation.put("explainsVariance", gap != null && unapprovedGross != null && "GROSS".equals(variance.get("basis")) && unapprovedGross.compareTo(gap) == 0);
    out.put("explanation", explanation);

    // Acceptance coverage per invoice line.
    var acceptance = new LinkedHashMap<String, Object>();
    var acceptanceDocs = x.documents().stream().filter(d -> d.role().equals("acceptance")).toList();
    var accepted = new ArrayList<Integer>(); var notAccepted = new ArrayList<Integer>();
    var references = new LinkedHashSet<String>();
    if (acceptanceDocs.isEmpty()) {
      acceptance.put("status", "MISSING");
      findings.add(finding("ACCEPTANCE_EVIDENCE_MISSING", "HIGH", "No acceptance report is in the dossier", List.of()));
    } else {
      var result = labelValue(x, "acceptance", "Abnahmeergebnis");
      var scope = labelValue(x, "acceptance", "Abgenommener Umfang");
      var defects = labelValue(x, "acceptance", "Offene Mängel");
      var deadline = labelValue(x, "acceptance", "Mängelfrist");
      for (var line : x.lines()) {
        boolean covered = scope.map(s -> Pattern.compile("\\bPos\\.?\\s*" + line.position() + "\\b").matcher(s.value()).find()).orElse(false);
        (covered ? accepted : notAccepted).add(line.position());
      }
      for (var doc : acceptanceDocs) { var m = PHOTO_REF.matcher(all(doc.document())); while (m.find()) references.add(photoId(m.group(1))); }
      boolean reserved = result.map(r -> r.value().toLowerCase(Locale.ROOT).contains("vorbehalt")).orElse(false);
      acceptance.put("status", notAccepted.isEmpty() && !reserved && result.isPresent() ? "COMPLETE" : "PARTIAL");
      acceptance.put("result", result.map(LabelValue::value).orElse(null));
      acceptance.put("acceptedPositions", accepted); acceptance.put("notAcceptedPositions", notAccepted);
      acceptance.put("openDefects", defects.map(d -> d.value().replaceAll("[^0-9]", "")).filter(v -> !v.isEmpty()).map(Integer::parseInt).orElse(null));
      acceptance.put("remediationDeadline", deadline.map(LabelValue::value).orElse(null));
      var sources = new ArrayList<Map<String, Object>>();
      result.ifPresent(r -> sources.add(source(r, "Abnahmeergebnis")));
      scope.ifPresent(s -> sources.add(source(s, "Abgenommener Umfang")));
      acceptance.put("sources", sources);
      for (int position : notAccepted)
        findings.add(finding("ACCEPTANCE_EVIDENCE_MISSING", "MEDIUM", "No acceptance evidence for invoice line " + position, sources));
      if (acceptance.get("openDefects") instanceof Integer count && count > 0)
        findings.add(finding("OPEN_ACCEPTANCE_DEFECTS", "MEDIUM", count + " open defect(s); remediation deadline " + acceptance.get("remediationDeadline"),
            defects.map(d -> List.of(source(d, "Offene Mängel"))).orElse(List.of())));
    }

    // Photos referenced by the acceptance report versus photos in the dossier.
    var provided = new LinkedHashMap<String, Map<String, Object>>();
    for (var doc : x.documents()) if (doc.role().equals("photo")) {
      var m = PHOTO_REF.matcher(all(doc.document()));
      if (m.find()) provided.putIfAbsent(photoId(m.group(1)), Map.of("photoId", photoId(m.group(1)), "documentId", doc.document().id(), "documentName", doc.document().name(), "page", 1));
    }
    var photos = new LinkedHashMap<String, Object>();
    photos.put("referenced", List.copyOf(references)); photos.put("provided", List.copyOf(provided.values()));
    var missingPhotos = references.stream().filter(r -> !provided.containsKey(r)).toList();
    photos.put("missing", missingPhotos);
    photos.put("unreferenced", provided.keySet().stream().filter(p -> !references.contains(p)).toList());
    if (!missingPhotos.isEmpty())
      findings.add(finding("PHOTO_EVIDENCE_MISSING", "MEDIUM", "Referenced acceptance photo(s) not in the dossier: " + String.join(", ", missingPhotos), List.of()));

    // Payment evidence: a literal confirmation with a date, never inferred from words like "Zahlung".
    var payment = new LinkedHashMap<String, Object>();
    var paymentSources = new ArrayList<Map<String, Object>>();
    for (var doc : x.documents()) for (var page : doc.document().pages()) {
      var m = PAYMENT_CONFIRMATION.matcher(page.text());
      if (m.find()) paymentSources.add(Map.of("documentId", doc.document().id(), "documentName", doc.document().name(), "page", page.number(), "quote", m.group(),
          "ref", "[" + doc.document().id() + ":p" + page.number() + "]"));
    }
    payment.put("status", paymentSources.isEmpty() ? "MISSING" : "FOUND");
    payment.put("sources", paymentSources);
    payment.put("rule", "dated payment confirmation (bezahlt/überwiesen/Zahlungseingang am DD.MM.YYYY); keywords alone are not evidence");
    if (paymentSources.isEmpty())
      findings.add(finding("PAYMENT_EVIDENCE_MISSING", "MEDIUM", "No payment evidence in the dossier; payment status is unknown, not confirmed", List.of()));

    var evidence = new LinkedHashMap<String, Object>();
    evidence.put("acceptance", acceptance); evidence.put("payment", payment); evidence.put("photos", photos); evidence.put("retrieval", retrieval);
    out.put("invoiceLines", lines);
    out.put("evidence", evidence);
    for (var instruction : x.instructions())
      findings.add(finding("EMBEDDED_APPROVAL_INSTRUCTION", "HIGH", "Document text instructs an assistant to approve, pay or send mail; it was ignored",
          List.of(Map.of("documentId", instruction.get("documentId"), "page", instruction.get("page"), "ref", instruction.get("ref")))));
    out.put("embeddedInstructions", x.instructions());
    var unreviewed = x.documents().stream().filter(d -> !"verified".equals(d.document().status())).map(d -> d.document().id()).toList();
    if (!unreviewed.isEmpty())
      findings.add(finding("SOURCES_NOT_HUMAN_REVIEWED", "INFO", unreviewed.size() + " source document(s) still await human field review", List.of()));
    out.put("findings", findings);
    out.put("humanReviewRequired", true);
    return out;
  }

  // ---------------------------------------------------------------- draft: deterministic wording, cited, never sent
  @SuppressWarnings("unchecked")
  static Map<String, Object> draft(Extraction x, Map<String, Object> r, String locale) {
    var approved = (Map<String, Object>) r.get("approved"); var invoice = (Map<String, Object>) r.get("invoice");
    var variance = (Map<String, Object>) r.get("variance"); var explanation = (Map<String, Object>) r.get("explanation");
    var evidence = (Map<String, Object>) r.get("evidence");
    var acceptance = (Map<String, Object>) evidence.get("acceptance"); var payment = (Map<String, Object>) evidence.get("payment");
    var photos = (Map<String, Object>) evidence.get("photos");
    var lines = (List<Map<String, Object>>) r.get("invoiceLines");
    String approvedRef = ref(approved.get("source")), invoiceRef = ref(invoice.get("source"));
    String approvedAmount = display(approved.get("amount"), locale), invoiceAmount = display(invoice.get("amount"), locale);
    String gap = display(variance.get("amount"), locale);
    String basis = basisWord(variance.get("basis"), locale);
    var unapproved = lines.stream().filter(l -> !Boolean.TRUE.equals(l.get("approved"))).toList();
    var summary = new ArrayList<String>();
    var citations = new ArrayList<Map<String, Object>>();
    if (approved.get("source") instanceof Map<?, ?> s) citations.add((Map<String, Object>) s);
    if (invoice.get("source") instanceof Map<?, ?> s) citations.add((Map<String, Object>) s);
    summary.add(text(locale,
        "Pre-accounting check draft – requires human review. Nothing was approved, paid or sent.",
        "Entwurf der Prüfung vor Übergabe an die Buchhaltung – menschliche Prüfung erforderlich. Nichts wurde freigegeben, bezahlt oder versendet.",
        "Bản nháp kiểm tra trước khi chuyển kế toán – cần người duyệt. Không có phê duyệt, thanh toán hay email nào được thực hiện."));
    if (variance.get("amount") != null) summary.add(text(locale,
        "Approved: " + approvedAmount + " " + basis + " " + approvedRef + ". Invoice: " + invoiceAmount + " " + basis + " " + invoiceRef + ". Difference: " + gap + " on the same tax basis (" + basis + ").",
        "Genehmigt: " + approvedAmount + " " + basis + " " + approvedRef + ". Rechnung: " + invoiceAmount + " " + basis + " " + invoiceRef + ". Differenz: " + gap + " auf derselben Steuerbasis (" + basis + ").",
        "Giá trị đã duyệt: " + approvedAmount + " " + basis + " " + approvedRef + ". Hóa đơn: " + invoiceAmount + " " + basis + " " + invoiceRef + ". Chênh lệch: " + gap + ", cùng cơ sở thuế (" + basis + ")."));
    else summary.add(text(locale,
        "No difference computed: the approved amount and the invoice do not share a stated tax basis, or an amount is missing.",
        "Keine Differenz berechnet: Genehmigter Betrag und Rechnung haben keine gemeinsame Steuerbasis oder ein Betrag fehlt.",
        "Chưa tính chênh lệch: giá trị duyệt và hóa đơn không cùng cơ sở thuế hoặc thiếu một khoản."));
    for (var line : unapproved) summary.add(text(locale,
        "Invoice line " + line.get("position") + " (" + line.get("description") + ", " + display(line.get("net"), locale) + " net) has no approved change order " + ref(line.get("source")) + ".",
        "Rechnungsposition " + line.get("position") + " (" + line.get("description") + ", " + display(line.get("net"), locale) + " netto) ist durch keinen genehmigten Nachtrag gedeckt " + ref(line.get("source")) + ".",
        "Dòng hóa đơn " + line.get("position") + " (" + line.get("description") + ", " + display(line.get("net"), locale) + " netto) không có Nachtrag được duyệt " + ref(line.get("source")) + "."));
    if (Boolean.TRUE.equals(explanation.get("explainsVariance"))) summary.add(text(locale,
        "Unapproved net " + display(explanation.get("unapprovedNet"), locale) + " plus VAT equals the difference of " + gap + " (computed in code).",
        "Nicht genehmigte " + display(explanation.get("unapprovedNet"), locale) + " netto zuzüglich USt ergeben genau die Differenz von " + gap + " (im Code berechnet).",
        "Phần chưa duyệt " + display(explanation.get("unapprovedNet"), locale) + " netto cộng thuế GTGT bằng đúng chênh lệch " + gap + " (tính bằng code)."));
    String acceptanceRef = ((List<Map<String, Object>>) acceptance.getOrDefault("sources", List.of())).stream().map(ContractorPrecheck::ref).reduce("", (a, b) -> (a + " " + b).strip());
    switch (String.valueOf(acceptance.get("status"))) {
      case "MISSING" -> summary.add(text(locale, "Acceptance evidence: MISSING – no acceptance report in the dossier.",
          "Abnahmenachweis: FEHLT – kein Abnahmeprotokoll im Dossier.", "Bằng chứng nghiệm thu: THIẾU – hồ sơ không có biên bản nghiệm thu."));
      case "PARTIAL" -> summary.add(text(locale,
          "Acceptance evidence: PARTIAL – accepted positions " + acceptance.get("acceptedPositions") + ", missing for " + acceptance.get("notAcceptedPositions") + "; " + acceptance.get("openDefects") + " open defect(s) until " + acceptance.get("remediationDeadline") + " " + acceptanceRef + ".",
          "Abnahmenachweis: TEILWEISE – abgenommen Positionen " + acceptance.get("acceptedPositions") + ", fehlt für " + acceptance.get("notAcceptedPositions") + "; " + acceptance.get("openDefects") + " offene(r) Mangel/Mängel bis " + acceptance.get("remediationDeadline") + " " + acceptanceRef + ".",
          "Bằng chứng nghiệm thu: MỘT PHẦN – đã nghiệm thu các dòng " + acceptance.get("acceptedPositions") + ", thiếu cho dòng " + acceptance.get("notAcceptedPositions") + "; " + acceptance.get("openDefects") + " lỗi còn mở đến " + acceptance.get("remediationDeadline") + " " + acceptanceRef + "."));
      default -> summary.add(text(locale, "Acceptance evidence: present " + acceptanceRef + ".", "Abnahmenachweis: vorhanden " + acceptanceRef + ".", "Bằng chứng nghiệm thu: có " + acceptanceRef + "."));
    }
    if ("MISSING".equals(payment.get("status"))) summary.add(text(locale,
        "Payment evidence: MISSING – no dated payment confirmation in the dossier; payment status is unknown.",
        "Zahlungsnachweis: FEHLT – keine datierte Zahlungsbestätigung im Dossier; der Zahlungsstatus ist unbekannt.",
        "Bằng chứng thanh toán: THIẾU – hồ sơ không có xác nhận thanh toán có ngày; chưa biết trạng thái thanh toán."));
    else summary.add(text(locale, "Payment evidence found; verify it against the bank record.", "Zahlungsnachweis gefunden; mit dem Bankbeleg abgleichen.", "Có bằng chứng thanh toán; cần đối chiếu với chứng từ ngân hàng."));
    var missingPhotos = (List<String>) photos.get("missing");
    if (!missingPhotos.isEmpty()) summary.add(text(locale,
        "Acceptance photos referenced but missing: " + String.join(", ", missingPhotos) + ".",
        "Im Abnahmeprotokoll genannte Fotos fehlen: " + String.join(", ", missingPhotos) + ".",
        "Ảnh nghiệm thu được tham chiếu nhưng không có trong hồ sơ: " + String.join(", ", missingPhotos) + "."));
    for (var instruction : x.instructions()) summary.add(text(locale,
        "Warning: " + instruction.get("documentName") + " page " + instruction.get("page") + " contains an instruction to approve or send; it was ignored and kept out of model context " + instruction.get("ref") + ".",
        "Warnung: " + instruction.get("documentName") + " Seite " + instruction.get("page") + " enthält eine Anweisung zur Freigabe oder zum Versand; sie wurde ignoriert und vom Modellkontext ausgeschlossen " + instruction.get("ref") + ".",
        "Cảnh báo: " + instruction.get("documentName") + " trang " + instruction.get("page") + " chứa câu chỉ dẫn tự duyệt/gửi; đã bỏ qua và loại khỏi ngữ cảnh mô hình " + instruction.get("ref") + "."));

    // Contractor-facing questions only; internal payment status stays in the summary.
    var items = new ArrayList<String>();
    if (variance.get("amount") != null && new BigDecimal(String.valueOf(variance.get("amount"))).signum() > 0) items.add(text(locale,
        "The invoice amount of " + invoiceAmount + " " + basis + " exceeds the approved total of " + approvedAmount + " " + basis + " by " + gap + ".",
        "Der Rechnungsbetrag von " + invoiceAmount + " " + basis + " übersteigt die genehmigte Gesamtvergütung von " + approvedAmount + " " + basis + " um " + gap + ".",
        "Số tiền hóa đơn " + invoiceAmount + " " + basis + " vượt tổng giá trị đã duyệt " + approvedAmount + " " + basis + " là " + gap + "."));
    for (var line : unapproved) items.add(text(locale,
        "Line " + line.get("position") + " (" + line.get("description") + ", " + display(line.get("net"), locale) + " net) is not covered by an approved change order. Please send the approved change order or a corrected invoice.",
        "Position " + line.get("position") + " (" + line.get("description") + ", " + display(line.get("net"), locale) + " netto) ist durch keinen genehmigten Nachtrag gedeckt. Bitte reichen Sie den genehmigten Nachtrag oder eine korrigierte Rechnung ein.",
        "Dòng " + line.get("position") + " (" + line.get("description") + ", " + display(line.get("net"), locale) + " netto) chưa có Nachtrag được duyệt. Đề nghị gửi Nachtrag đã duyệt hoặc hóa đơn điều chỉnh."));
    for (Object position : (List<Object>) acceptance.getOrDefault("notAcceptedPositions", List.of())) items.add(text(locale,
        "There is no acceptance record for line " + position + ".", "Für Position " + position + " liegt kein Abnahmenachweis vor.", "Chưa có biên bản nghiệm thu cho dòng " + position + "."));
    if (!missingPhotos.isEmpty()) items.add(text(locale,
        "Photo(s) " + String.join(", ", missingPhotos) + " named in the acceptance report are missing.",
        "Die im Abnahmeprotokoll genannten Fotos " + String.join(", ", missingPhotos) + " fehlen.",
        "Thiếu ảnh " + String.join(", ", missingPhotos) + " được nêu trong biên bản nghiệm thu."));
    String number = String.valueOf(Objects.requireNonNullElse(invoice.get("number"), "?"));
    var body = new StringBuilder(text(locale, "Dear Sir or Madam,\n\nregarding invoice " + number + " we have the following open points:\n",
        "Sehr geehrte Damen und Herren,\n\nzu Ihrer Rechnung " + number + " haben wir folgende offene Punkte:\n",
        "Kính gửi Quý công ty,\n\nliên quan đến hóa đơn " + number + ", chúng tôi còn các điểm sau:\n"));
    for (int i = 0; i < items.size(); i++) body.append(i + 1).append(". ").append(items.get(i)).append('\n');
    if (items.isEmpty()) body.append(text(locale, "No open points were found by the automated check.\n", "Die automatische Prüfung hat keine offenen Punkte gefunden.\n", "Kiểm tra tự động không thấy điểm còn mở.\n"));
    body.append(text(locale, "\nKind regards\n[name of the reviewing person]\n\nDRAFT – not sent. A person reviews and sends it.",
        "\nMit freundlichen Grüßen\n[Name der prüfenden Person]\n\nENTWURF – nicht versendet. Prüfung und Versand nur durch einen Menschen.",
        "\nTrân trọng\n[Tên người kiểm tra]\n\nBẢN NHÁP – chưa gửi. Người kiểm tra xem lại nội dung và tự gửi."));
    var email = new LinkedHashMap<String, Object>();
    email.put("recipients", List.of()); email.put("subject", text(locale, "Questions on invoice " + number + " (draft)", "Rückfragen zur Rechnung " + number + " (Entwurf)", "Câu hỏi về hóa đơn " + number + " (bản nháp)"));
    email.put("body", body.toString()); email.put("send", false);
    var draft = new LinkedHashMap<String, Object>();
    draft.put("status", "DRAFT_REQUIRES_HUMAN_REVIEW");
    draft.put("approved", false); draft.put("emailSent", false); draft.put("paymentReleased", false);
    draft.put("generatedBy", "deterministic template; no language model");
    draft.put("summary", summary); draft.put("email", email); draft.put("citations", citations);
    draft.put("reviewerActions", List.of("open each cited page", "confirm or correct extracted fields", "edit and send the email yourself"));
    return draft;
  }

  // ---------------------------------------------------------------- citations
  @SuppressWarnings("unchecked")
  static List<Map<String, Object>> citationChecks(CreditCase item, Map<String, Object> r) {
    var claims = new ArrayList<CitationCheck.Claim>();
    var approved = (Map<String, Object>) r.get("approved");
    if (approved.get("source") instanceof Map<?, ?> source) claims.add(claim("approved", source, String.valueOf(approved.get("literal"))));
    var invoice = (Map<String, Object>) r.get("invoice");
    if (invoice.get("source") instanceof Map<?, ?> source) claims.add(claim("invoice", source, String.valueOf(invoice.get("literal"))));
    for (var line : (List<Map<String, Object>>) r.get("invoiceLines")) {
      var source = (Map<String, Object>) line.get("source");
      claims.add(claim("invoice-line-" + line.get("position"), source, german(new BigDecimal(String.valueOf(line.get("net"))))));
    }
    var evidence = (Map<String, Object>) r.get("evidence");
    for (var source : (List<Map<String, Object>>) ((Map<String, Object>) evidence.get("acceptance")).getOrDefault("sources", List.of()))
      claims.add(claim("acceptance", source, String.valueOf(source.get("quote"))));
    for (var source : (List<Map<String, Object>>) ((Map<String, Object>) evidence.get("payment")).get("sources"))
      claims.add(claim("payment", source, String.valueOf(source.get("quote"))));
    return claims.stream().map(c -> CitationCheck.verify(item, c)).toList();
  }

  private static CitationCheck.Claim claim(String name, Map<?, ?> source, String literal) {
    return new CitationCheck.Claim(name, String.valueOf(source.get("documentId")), (Integer) source.get("page"), literal);
  }

  // ---------------------------------------------------------------- helpers
  private static Optional<Amount> single(Extraction x, List<Map<String, Object>> findings, String role, String kind, Basis basis) {
    var values = x.amounts().stream().filter(a -> a.role().equals(role) && a.kind().equals(kind) && (basis == null || a.basis() == basis)).toList();
    if (values.isEmpty()) return Optional.empty();
    if (values.stream().map(a -> a.value().stripTrailingZeros()).distinct().count() > 1) {
      findings.add(finding("AMBIGUOUS_AMOUNT", "HIGH", "Different " + role + "/" + kind + " values were extracted; a person must choose the source", values.stream().map(Amount::source).toList()));
      return Optional.empty();
    }
    return Optional.of(values.getFirst());
  }

  private static Optional<BigDecimal> perDocumentSum(Extraction x, String role, String kind, Basis basis) {
    var perDocument = new LinkedHashMap<String, BigDecimal>();
    for (var a : x.amounts()) if (a.role().equals(role) && a.kind().equals(kind) && a.basis() == basis) perDocument.putIfAbsent(a.documentId(), a.value());
    return perDocument.isEmpty() ? Optional.empty() : Optional.of(perDocument.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add));
  }

  private static Optional<LabelValue> labelValue(Extraction x, String role, String label) {
    for (var doc : x.documents()) if (doc.role().equals(role)) { var value = labelValue(doc.document(), label); if (value.isPresent()) return value; }
    return Optional.empty();
  }

  static Optional<LabelValue> labelValue(CreditCase.Document d, String label) {
    var pattern = Pattern.compile("^\\s*" + Pattern.quote(label) + "\\s*:\\s*(.*)$", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    for (var page : d.pages()) {
      String[] lines = page.text().split("\\R");
      for (int i = 0; i < lines.length; i++) {
        Matcher m = pattern.matcher(lines[i]);
        if (!m.matches()) continue;
        String value = m.group(1).strip();
        if (value.isEmpty() && i + 1 < lines.length) value = lines[i + 1].strip();
        if (!value.isEmpty()) return Optional.of(new LabelValue(value, d.id(), d.name(), page.number()));
      }
    }
    return Optional.empty();
  }

  private static Map<String, Object> source(LabelValue value, String label) {
    return Map.of("documentId", value.documentId(), "documentName", value.documentName(), "page", value.page(), "quote", label + ": " + value.value(),
        "ref", "[" + value.documentId() + ":p" + value.page() + "]");
  }

  private static Map<String, Object> finding(String code, String severity, String message, List<?> sources) {
    var row = new LinkedHashMap<String, Object>();
    row.put("code", code); row.put("severity", severity); row.put("message", message); row.put("sources", sources); row.put("humanReviewRequired", true);
    return row;
  }

  private static String photoId(String digits) { return "F-" + digits.replace('O', '0').replace('o', '0').replace('I', '1').replace('l', '1'); }
  static String all(CreditCase.Document d) { return String.join("\n", d.pages().stream().map(CreditCase.Page::text).toList()); }
  static BigDecimal decimal(String german) { return new BigDecimal(german.replace(".", "").replace(",", ".")).setScale(2, RoundingMode.UNNECESSARY); }
  static String money(BigDecimal value) { return value == null ? null : value.setScale(2, RoundingMode.UNNECESSARY).toPlainString(); }
  static String german(BigDecimal value) {
    String plain = value.abs().setScale(2, RoundingMode.UNNECESSARY).toPlainString();
    String integer = plain.substring(0, plain.indexOf('.')), cents = plain.substring(plain.indexOf('.') + 1);
    var grouped = new StringBuilder();
    for (int i = 0; i < integer.length(); i++) { if (i > 0 && (integer.length() - i) % 3 == 0) grouped.append('.'); grouped.append(integer.charAt(i)); }
    return (value.signum() < 0 ? "-" : "") + grouped + "," + cents;
  }
  private static String display(Object amount, String locale) {
    if (amount == null) return "?";
    var value = new BigDecimal(String.valueOf(amount));
    if (!locale.equals("en")) return german(value) + " EUR";
    return "EUR " + german(value).replace(".", "#").replace(",", ".").replace("#", ",");
  }
  private static String basisWord(Object basis, String locale) {
    if (basis == null) return "";
    return switch (String.valueOf(basis)) {
      case "GROSS" -> locale.equals("en") ? "gross" : "brutto";
      case "NET" -> locale.equals("en") ? "net" : "netto";
      default -> "";
    };
  }
  private static String ref(Object source) { return source instanceof Map<?, ?> map && map.get("ref") != null ? String.valueOf(map.get("ref")) : ""; }
  private static String text(String locale, String en, String de, String vi) { return switch (locale) { case "de" -> de; case "vi" -> vi; default -> en; }; }
}
