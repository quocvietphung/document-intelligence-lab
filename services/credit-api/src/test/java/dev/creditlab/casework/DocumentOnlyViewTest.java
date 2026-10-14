package dev.creditlab.casework;
import static org.assertj.core.api.Assertions.*;
import org.junit.jupiter.api.Test;
class DocumentOnlyViewTest {
 private final String tenant="praxisbank-demo",id="CR-2026-1048";
 private SqlCaseStore database(){return new SqlCaseStore(new org.springframework.jdbc.datasource.DriverManagerDataSource("jdbc:h2:mem:documentProjection"+System.nanoTime()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa",""),new com.fasterxml.jackson.databind.ObjectMapper());}
 private CreditCaseService writable(SqlCaseStore store){var service=new CreditCaseService(store,false);org.springframework.test.util.ReflectionTestUtils.setField(service,"writesEnabled",true);return service;}
 private CreditCase.Document original(){return new CreditCase.Document("actual-pdf","source.pdf","income","review",null,java.util.List.of(new CreditCase.Field("netIncome","100 EUR",null,1,"Netto 100 EUR")),java.util.List.of(new CreditCase.Page(1,"Netto 100 EUR","pdfbox")),true,"local-pdfbox-tesseract","layout-rules","application/pdf");}
 @Test void applicationStartsWithoutCaseFixtures(){
  var store=new CaseStore();var service=new CreditCaseService(store,false);
  assertThat(service.findAll("praxisbank-demo")).isEmpty();
 }
 @Test void oldPlaceholderClaimsAreNotDocumentEvidence(){
  var store=new CaseStore();var fixture=new CreditCaseService(store,true);
  var old=fixture.require("praxisbank-demo","CR-2026-1048");
  var actual=new CreditCaseService(store,false).require("praxisbank-demo",old.id());
  assertThat(actual.documents()).isEmpty();assertThat(actual.validationIssues()).isEmpty();
  assertThat(actual.missingDocuments()).containsExactly("income","statement");
  assertThat(store.get("praxisbank-demo",old.id()).orElseThrow().documents()).hasSize(4);
  assertThat(new CreditCaseService(store,false).findAll("praxisbank-demo")).isEmpty();
 }
 @Test void editKeepsArchivedDocumentsWhilePersistingCurrentWorkflow(){
  var store=database();new CreditCaseService(store,true);var service=writable(store);
  var changed=service.edit(tenant,id,"reviewer",new CreditCaseService.Draft("Edited applicant","Document inspection",1000,"",0));
  assertThat(changed.documents()).isEmpty();assertThat(changed.status()).isEqualTo("DRAFT");
  var stored=store.get(tenant,id).orElseThrow();assertThat(stored.documents()).hasSize(4);assertThat(stored.audit()).hasSize(2);
  assertThat(stored.completeness()).isEqualTo(changed.completeness());assertThat(stored.validationIssues()).isEmpty();
 }
 @Test void attachReviewAndExpiryPreserveArchivesAndOriginalBytes(){
  var store=database();new CreditCaseService(store,true);var service=writable(store);byte[] bytes="%PDF-test-original".getBytes();
  var attached=service.attach(tenant,id,"reviewer",bytes,original(),0);
  assertThat(attached.documents()).hasSize(1);assertThat(store.get(tenant,id).orElseThrow().documents()).hasSize(5);
  var reviewed=service.review(tenant,id,"actual-pdf","reviewer",new CreditCaseService.Review(attached.version(),java.util.List.of("110 EUR")));
  assertThat(reviewed.documents().getFirst().status()).isEqualTo("verified");assertThat(reviewed.completeness()).isEqualTo(50);
  var stored=store.get(tenant,id).orElseThrow();assertThat(stored.documents()).hasSize(5);assertThat(stored.completeness()).isEqualTo(reviewed.completeness());
  assertThat(store.file(tenant,id,"actual-pdf")).contains(bytes);
  assertThatThrownBy(()->service.edit(tenant,id,"reviewer",new CreditCaseService.Draft("Stale","Document inspection",1000,"",0))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class).hasMessageContaining("409");
  assertThat(store.get(tenant,id).orElseThrow()).isEqualTo(stored);
  service.expirePipelineDocument(tenant,id,"actual-pdf");assertThat(service.require(tenant,id).documents()).isEmpty();
  assertThat(store.get(tenant,id).orElseThrow().documents()).hasSize(4);assertThat(store.file(tenant,id,"actual-pdf")).isEmpty();
  assertThat(store.get(tenant,id).orElseThrow().status()).isEqualTo("DRAFT");
 }
 @Test void fieldReviewAndCaseUpdateRollbackTogether(){
  var source=new org.springframework.jdbc.datasource.DriverManagerDataSource("jdbc:h2:mem:reviewRollback"+System.nanoTime()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa","");
  var store=new SqlCaseStore(source,new com.fasterxml.jackson.databind.ObjectMapper());new CreditCaseService(store,true);var service=writable(store);
  var before=service.attach(tenant,id,"reviewer","%PDF-original".getBytes(),original(),0);
  var audit=org.mockito.Mockito.mock(dev.creditlab.platform.LabStore.class);
  org.mockito.Mockito.when(audit.insert(org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyMap())).thenThrow(new IllegalStateException("Audit unavailable"));
  org.springframework.test.util.ReflectionTestUtils.setField(service,"reviewStore",audit);
  var factory=new org.springframework.aop.framework.ProxyFactory(service);factory.setProxyTargetClass(true);
  factory.addAdvice(new org.springframework.transaction.interceptor.TransactionInterceptor(new org.springframework.jdbc.datasource.DataSourceTransactionManager(source),new org.springframework.transaction.annotation.AnnotationTransactionAttributeSource()));
  var transactional=(CreditCaseService)factory.getProxy();
  assertThatThrownBy(()->transactional.review(tenant,id,"actual-pdf","reviewer",new CreditCaseService.Review(before.version(),java.util.List.of("110 EUR")))).isInstanceOf(IllegalStateException.class).hasMessage("Audit unavailable");
  var after=service.require(tenant,id);assertThat(after.version()).isEqualTo(before.version());assertThat(after.documents()).isEqualTo(before.documents());
  assertThat(store.get(tenant,id).orElseThrow().documents()).hasSize(5);
 }
}
