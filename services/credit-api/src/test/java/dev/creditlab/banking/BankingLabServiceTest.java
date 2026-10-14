package dev.creditlab.banking;
import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.web.server.ResponseStatusException;
class BankingLabServiceTest {
 private final ObjectMapper mapper=new ObjectMapper();
 private final DriverManagerDataSource source=new DriverManagerDataSource("jdbc:h2:mem:noSeeds"+System.nanoTime()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa","");
 private final CreditCaseService cases=new CreditCaseService(new SqlCaseStore(source,mapper));
 private final BankingLabService service=new BankingLabService(cases,mapper,Optional.of(source));
 @Test void neverInventsAccountsMovementsOrInvoices(){
  var value=service.snapshot("praxisbank-demo","CR-2026-1048");
  assertThat(value.synthetic()).isFalse();assertThat(value.accounts()).isEmpty();assertThat(value.transactions()).isEmpty();assertThat(value.invoices()).isEmpty();assertThat(value.payments()).isEmpty();
 }
 @Test void refusesForeignTenantBeforeAnyBankAccess(){assertThatThrownBy(()->service.snapshot("foreign","CR-2026-1048")).isInstanceOf(ResponseStatusException.class);}
 @Test void refusesUnknownCase(){assertThatThrownBy(()->service.snapshot("praxisbank-demo","missing")).isInstanceOf(ResponseStatusException.class);}
 @Test void doesNotChangeCaseVersion(){service.snapshot("praxisbank-demo","CR-2026-1048");assertThat(cases.require("praxisbank-demo","CR-2026-1048").version()).isZero();}
 @Test void neverClaimsBalanceWithoutOriginalStatement(){assertThatThrownBy(()->service.balance(service.snapshot("praxisbank-demo","CR-2026-1048"),"practice")).isInstanceOf(ResponseStatusException.class);}
 @Test void leavesLegacyBankingPayloadRecoverableWithoutUsingIt(){
  var db=new JdbcTemplate(source);db.execute("CREATE TABLE banking_lab (tenant varchar(120),case_id varchar(80),payload text)");
  String payload="{\"legacyFixture\":true}";db.update("INSERT INTO banking_lab VALUES(?,?,?)","praxisbank-demo","CR-2026-1048",payload);
  assertThat(service.snapshot("praxisbank-demo","CR-2026-1048").accounts()).isEmpty();
  assertThat(db.queryForObject("SELECT payload FROM banking_lab",String.class)).isEqualTo(payload);
 }
 @Test void noTransactionMutationMethodsRemain(){assertThat(Arrays.stream(BankingLabService.class.getDeclaredMethods()).filter(m->java.lang.reflect.Modifier.isPublic(m.getModifiers())).map(java.lang.reflect.Method::getName)).containsExactlyInAnyOrder("snapshot","balance");}
}
