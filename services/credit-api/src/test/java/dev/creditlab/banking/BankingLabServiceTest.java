package dev.creditlab.banking;

import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.*;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

class BankingLabServiceTest {
  private BankingLabService service;
  private CreditCaseService cases;
  private DriverManagerDataSource source;
  private final ObjectMapper mapper=new ObjectMapper();
  private final String tenant="praxisbank-demo",id="CR-2026-1048";
  @BeforeEach void setup() {
    source=new DriverManagerDataSource("jdbc:h2:mem:bank"+System.nanoTime()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa","");
    cases=new CreditCaseService(new SqlCaseStore(source,mapper));
    ReflectionTestUtils.setField(cases,"writesEnabled",true);
    service=new BankingLabService(cases,mapper,Optional.of(source));
  }
  private BankingSnapshot draft(String request,long version) {return service.draft(tenant,id,"advisor","practice","INV-EQUIPMENT",request,version,true);}
  @Test void seedsOnceAndPersistsAcrossServiceInstances() {
    var original=service.snapshot(tenant,id);
    assertThat(original.synthetic()).isTrue();assertThat(original.persistent()).isTrue();
    assertThat(original.accounts()).hasSize(3);assertThat(original.transactions()).hasSize(11);
    assertThat(service.balance(original,"practice")).isEqualTo(3_455_100);
    assertThat(new BankingLabService(cases,mapper,Optional.of(source)).snapshot(tenant,id)).isEqualTo(original);
  }
  @Test void rejectsForeignTenantBeforeReadingOrSeeding() { assertThatThrownBy(()->service.snapshot("foreign",id)).isInstanceOf(ResponseStatusException.class); }
  @Test void separatesCasesAndDoesNotChangeCreditCaseVersion() {
    draft(UUID.randomUUID().toString(),0);
    assertThat(service.snapshot(tenant,"CR-2026-1049").payments()).isEmpty();
    assertThat(cases.require(tenant,id).version()).isZero();
  }
  @Test void explicitConfirmationCreatesExactlyOneMovement() {
    var prepared=draft(UUID.randomUUID().toString(),0);
    assertThat(prepared.transactions()).hasSize(11);
    var result=service.confirm(tenant,id,"reviewer",prepared.payments().getFirst().id(),1,true);
    assertThat(result.transactions()).hasSize(12);assertThat(result.payments().getFirst().status()).isEqualTo("SIMULATED");
    assertThat(result.payments().getFirst().confirmedBy()).isEqualTo("reviewer");
    assertThat(service.balance(result,"practice")).isEqualTo(3_207_100);
    assertThat(result.events()).extracting(BankingSnapshot.Event::action).containsExactly("BANKING_SEEDED","PAYMENT_DRAFTED","PAYMENT_SIMULATED");
    assertThat(service.confirm(tenant,id,"reviewer",prepared.payments().getFirst().id(),0,true)).isEqualTo(result);
  }
  @Test void requestIdIsIdempotentAndCannotBeReusedForDifferentInputs() {
    String request=UUID.randomUUID().toString();var first=draft(request,0);
    assertThat(draft(request,0)).isEqualTo(first);
    assertThatThrownBy(()->service.draft(tenant,id,"advisor","personal","INV-EQUIPMENT",request,1,true)).isInstanceOf(ResponseStatusException.class);
  }
  @Test void blocksDuplicatePaidInvoiceAndUnverifiedBeneficiary() {
    for(String invoice:new String[]{"INV-PAID","INV-UNKNOWN"}) assertThatThrownBy(()->service.draft(tenant,id,"advisor","practice",invoice,UUID.randomUUID().toString(),0,true)).isInstanceOf(ResponseStatusException.class);
  }
  @Test void blocksSecondDraftForSameInvoice() {
    draft(UUID.randomUUID().toString(),0);
    assertThatThrownBy(()->draft(UUID.randomUUID().toString(),1)).isInstanceOf(ResponseStatusException.class);
    assertThat(service.snapshot(tenant,id).payments()).hasSize(1);
  }
  @Test void requiresSourceCheckAndConfirmation() {
    assertThatThrownBy(()->service.draft(tenant,id,"advisor","practice","INV-EQUIPMENT",UUID.randomUUID().toString(),0,false)).isInstanceOf(ResponseStatusException.class);
    var first=draft(UUID.randomUUID().toString(),0);
    assertThatThrownBy(()->service.confirm(tenant,id,"reviewer",first.payments().getFirst().id(),1,false)).isInstanceOf(ResponseStatusException.class);
    assertThat(service.snapshot(tenant,id).transactions()).hasSize(11);
  }
  @Test void rejectsStaleVersionAndUnknownAccount() {
    assertThatThrownBy(()->draft(UUID.randomUUID().toString(),99)).isInstanceOf(ResponseStatusException.class);
    assertThatThrownBy(()->service.draft(tenant,id,"advisor","unknown","INV-EQUIPMENT",UUID.randomUUID().toString(),0,true)).isInstanceOf(ResponseStatusException.class);
  }
  @Test void inMemoryModeIsReadOnly() {
    var readonly=new BankingLabService(new CreditCaseService(),mapper,Optional.empty());
    assertThat(readonly.snapshot(tenant,id).persistent()).isFalse();
    assertThatThrownBy(()->readonly.draft(tenant,id,"advisor","practice","INV-EQUIPMENT",UUID.randomUUID().toString(),0,true)).isInstanceOf(ResponseStatusException.class);
  }
  @Test void toolContextIsReadOnlyAndCitesSyntheticSources() {
    var tools=new BankingTools(service.snapshot(tenant,id),mapper);
    assertThat(tools.bankAccounts()).contains("bank-accounts","balanceCents","3455100");
    assertThat(tools.bankInvoices()).contains("INV-PAID","ALREADY_PAID");
    assertThat(java.util.Arrays.stream(BankingTools.class.getDeclaredMethods()).filter(m->m.isAnnotationPresent(dev.langchain4j.agent.tool.Tool.class)).map(java.lang.reflect.Method::getName)).containsExactlyInAnyOrder("bankAccounts","bankTransactions","bankInvoices");
  }
}
