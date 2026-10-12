package dev.creditlab.casework;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class PayrollLayoutFieldsTest {
  private PayrollLayoutFields.Line line(String text,double x,double y) {return new PayrollLayoutFields.Line(text,x,y,x+0.12,y+0.008);}
  @Test void keepsGermanNetAndPayoutSeparateWithPageEvidence() {
    var fields=PayrollLayoutFields.extract(2,List.of(line("Netto-Verdienst",0.75,0.67),line("2.967,11",0.76,0.685),line("Auszahlungsbetrag",0.75,0.85),line("2.882,11",0.76,0.865),line("61.600,00",0.16,0.685)));
    assertThat(fields).extracting(CreditCase.Field::label).containsExactly("netIncome","payoutAmount");
    assertThat(fields).extracting(CreditCase.Field::value).containsExactly("2.967,11","2.882,11");
    assertThat(fields).allSatisfy(f->{assertThat(f.page()).isEqualTo(2);assertThat(f.confidence()).isNull();assertThat(f.evidence()).contains(f.value());});
  }
  @Test void supportsValuesBesideLabels() {
    assertThat(PayrollLayoutFields.extract(1,List.of(line("Nettogehalt",0.2,0.2),line("1.500,00 EUR",0.35,0.2)))).hasSize(1);
  }
  @Test void abstainsWhenTwoNearbyAmountsAreAmbiguous() {
    assertThat(PayrollLayoutFields.extract(1,List.of(line("Netto-Verdienst",0.75,0.2),line("1.000,00",0.75,0.22),line("2.000,00",0.75,0.221)))).isEmpty();
  }
  @Test void rejectsDistantAmountsAndMalformedCoordinates() {
    assertThat(PayrollLayoutFields.extract(1,List.of(line("Nettolohn",0.2,0.2),line("1.000,00",0.75,0.22),line("Netto-Verdienst",Double.NaN,0.4)))).isEmpty();
  }
  @Test void neverConflatesOtherAmountsOrDatesWithNetIncome() {
    assertThat(PayrollLayoutFields.extract(1,List.of(line("SV-Beiträge",0.75,0.2),line("1.000,00",0.75,0.22),line("Nettolohn",0.2,0.2),line("16.01.2026",0.2,0.22)))).isEmpty();
  }
  @Test void abstainsOnConflictingRepeatedNetLabels() {
    assertThat(PayrollLayoutFields.extract(1,List.of(line("Nettolohn",0.75,0.2),line("1.000,00",0.75,0.22),line("Nettolohn",0.75,0.4),line("2.000,00",0.75,0.42)))).isEmpty();
  }
}
