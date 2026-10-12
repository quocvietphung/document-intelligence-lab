package dev.creditlab.casework;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

class FieldValueNormalizerTest {
  @Test void normalizesGermanAndEnglishMoneyBeforeComparing() {
    assertThat(FieldValueNormalizer.normalize("monthlyRate","1.250,00 EUR")).isEqualTo("1250");
    assertThat(FieldValueNormalizer.normalize("monthlyRate","EUR 1,250.00")).isEqualTo("1250");
    assertThat(FieldValueNormalizer.normalize("monthlyRate","1250 EUR")).isEqualTo("1250");
  }
  @Test void normalizesCommonDates() {
    assertThat(FieldValueNormalizer.normalize("date","08.10.2026")).isEqualTo("2026-10-08");
    assertThat(FieldValueNormalizer.normalize("date","2026-10-08")).isEqualTo("2026-10-08");
  }
}
