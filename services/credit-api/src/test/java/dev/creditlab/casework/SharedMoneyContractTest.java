package dev.creditlab.casework;

import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class SharedMoneyContractTest {
  @Test void comparisonKeysAgreeOnTheExplicitlySupportedSubset() throws Exception {
    try(var input=getClass().getResourceAsStream("/shared-contracts/validation-cases.json")) {
      assertThat(input).isNotNull();
      for(var row:new ObjectMapper().readTree(input).path("money"))
        if(row.has("javaComparison"))assertThat(FieldValueNormalizer.normalize("invoiceTotal",row.path("raw").asText()))
          .isEqualTo(row.path("javaComparison").asText());
    }
  }
}
