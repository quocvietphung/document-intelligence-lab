package dev.creditlab.assistant;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Stub answers for the local model: the constrained segment that cites the excerpt the prompt labels with a given text. */
final class NovaStubs {
  private NovaStubs() {}

  /** One segment whose source is the label (S1, S2 ...) of the excerpt that contains {@code needle}. */
  static String segmentCiting(String prompt, String needle) {
    Matcher label = Pattern.compile("(?m)^(S\\d+) \\(.*" + Pattern.quote(needle)).matcher(prompt);
    if (!label.find()) {
      throw new AssertionError("no excerpt labelled for: " + needle);
    }
    return "{\"segments\":[{\"text\":\"The supplied excerpt answers the question.\",\"source\":\"" + label.group(1) + "\"}]}";
  }
}
