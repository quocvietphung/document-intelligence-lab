package dev.creditlab.casework;

import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class SqlCaseStoreTest {
  private SqlCaseStore store;
  @BeforeEach void setup() {
    String name="cases"+System.nanoTime();
    store=new SqlCaseStore(new DriverManagerDataSource("jdbc:h2:mem:"+name+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa",""),new ObjectMapper());
  }
  private CreditCase sample() {
    return new CreditCase("CR-1","tenant-a","Synthetic User","Training",1000,0,"DRAFT",List.of(),List.of(),"","2026-10-10T00:00:00Z",List.of(),List.of(),0);
  }
  @Test void persistsCaseAndOriginalByTenant() {
    var item=sample();store.insert(item);store.saveFile("tenant-a","CR-1","doc-1",new byte[]{1,2});
    assertThat(store.get("tenant-a","CR-1")).contains(item);
    assertThat(store.get("tenant-b","CR-1")).isEmpty();
    assertThat(store.file("tenant-a","CR-1","doc-1")).contains(new byte[]{1,2});
  }
  @Test void optimisticUpdateRejectsStaleVersion() {
    var item=sample();store.insert(item);
    var updated=new CreditCase(item.id(),item.tenantId(),item.applicant(),item.purpose(),item.amountEuro(),item.completeness(),item.status(),item.missingDocuments(),item.validationIssues(),item.coApplicant(),item.submittedAt(),item.documents(),item.audit(),1);
    assertThat(store.update(updated,0)).isTrue();assertThat(store.update(updated,0)).isFalse();
  }
  @Test void sharedQuotaStopsSeventhRequestInMinute() {
    for(int i=0;i<6;i++)store.reserve("tenant-a","actor-a",1);
    assertThatThrownBy(()->store.reserve("tenant-a","actor-a",1)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
  }
  @Test void configurableLocalPolicyAllowsMoreThanTheOldDailyBudget(){
    var source=new DriverManagerDataSource("jdbc:h2:mem:local"+System.nanoTime()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa","");
    var local=new SqlCaseStore(source,new ObjectMapper(),new dev.creditlab.assistant.AiQuotaPolicy(12,60,150_000,300_000));
    for(int i=0;i<5;i++)local.reserve("t","a",30_000);
    assertThatThrownBy(()->local.reserve("t","a",1)).isInstanceOf(dev.creditlab.assistant.AiUsageLimitException.class).satisfies(e->assertThat(((dev.creditlab.assistant.AiUsageLimitException)e).code()).isEqualTo("AI_DAILY_ACCOUNT_LIMIT"));
    var db=new org.springframework.jdbc.core.JdbcTemplate(source);
    assertThat(db.queryForObject("SELECT used FROM ai_quota WHERE bucket=?",Long.class,"budget:t:d:"+java.time.LocalDate.now(java.time.ZoneOffset.UTC))).isEqualTo(150_000L);
    local.reserve("t","other",1); // Failed reservations rolled back the shared charge.
  }
  @Test void twelveRequestsAreAllowedButThirteenthIsMinuteLimited(){
    var local=new SqlCaseStore(new DriverManagerDataSource("jdbc:h2:mem:minute"+System.nanoTime()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa",""),new ObjectMapper(),new dev.creditlab.assistant.AiQuotaPolicy(12,60,150_000,300_000));
    for(int i=0;i<12;i++)local.reserve("t","a",1);
    assertThatThrownBy(()->local.reserve("t","a",1)).isInstanceOf(dev.creditlab.assistant.AiUsageLimitException.class).satisfies(e->assertThat(((dev.creditlab.assistant.AiUsageLimitException)e).code()).isEqualTo("AI_MINUTE_LIMIT"));
  }
}
