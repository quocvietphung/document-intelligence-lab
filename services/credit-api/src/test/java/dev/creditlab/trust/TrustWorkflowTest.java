package dev.creditlab.trust;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.*;
import dev.creditlab.platform.LabStore;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class TrustWorkflowTest {
  private final String tenant="praxisbank-demo",caseId="CR-2026-1048";
  private final CreditCase item=new CreditCaseService().require(tenant,caseId);
  private final CreditCaseService cases=mock(CreditCaseService.class);
  private final LabStore store=new LabStore(Optional.empty(),new ObjectMapper());
  private final TrustService trust=new TrustService(cases,store,null);
  TrustWorkflowTest(){when(cases.require(anyString(),anyString())).thenAnswer(call->{
    if(!tenant.equals(call.getArgument(0))||!caseId.equals(call.getArgument(1)))throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    return item;
  });}
  private String uuid(){return UUID.randomUUID().toString();}
  private Map<String,Object> answer(String id,String revision){return trust.recordAnswer(item,"advisor",id,"What is missing?","A missing document [policy]","synthetic-demo",List.of(AnswerEvidence.source(item,"policy","Policy","Human review is required")),120,revision);}
  private void failure(Runnable operation,int code){assertThatThrownBy(operation::run).isInstanceOfSatisfying(ResponseStatusException.class,e->assertThat(e.getStatusCode().value()).isEqualTo(code));}

  @Test void originalAndRevisionAreImmutableSeparateRecords(){
    String original=uuid(),revision=uuid();var first=answer(original,"");answer(revision,original);
    answer(original,"unexpected overwrite");
    assertThat(trust.answer(tenant,caseId,original)).isEqualTo(first);
    assertThat(trust.answer(tenant,caseId,revision)).containsEntry("revisionOf",original).containsEntry("humanApproved",false).containsEntry("modelId","deterministic-demo");
    assertThat(store.list(tenant,caseId,"trust-answer")).hasSize(2);
  }
  @Test void answerAndSnapshotNeverCrossTenantOrCase(){
    String id=uuid();answer(id,"");
    failure(()->trust.answer("foreign",caseId,id),404);failure(()->trust.answer(tenant,"foreign-case",id),404);
    assertThat(store.find("foreign",caseId,"trust-answer",id)).isEmpty();
  }
  @Test void validCitationIsNotHumanApprovalOrSemanticTruth(){
    var source=AnswerEvidence.source(item,"doc-1:p1","Payroll reference","reference value");
    assertThat(source).containsEntry("kind","REFERENCE").containsEntry("humanReviewed",false).containsEntry("originalAvailable",false);
    var claims=AnswerEvidence.claims("Wrong amount [doc-1:p1]\nUncited claim\nInvented [unknown]",List.of(source));
    assertThat(claims).extracting(c->c.get("state")).containsExactly("SOURCE_LINKED","REVIEW_REQUIRED","REVIEW_REQUIRED");
    assertThat(claims.getLast().get("invalidCitations")).isEqualTo(List.of("unknown"));
  }
  @Test void feedbackIsIdempotentButConflictingReuseIsRejected(){
    String a=uuid(),f=uuid();answer(a,"");var first=trust.feedback(tenant,caseId,"advisor",a,"WRONG_AMOUNT","check amount",f,0);
    assertThat(trust.feedback(tenant,caseId,"advisor",a,"WRONG_AMOUNT","check amount",f,0)).isEqualTo(first);
    failure(()->trust.feedback(tenant,caseId,"other",a,"WRONG_AMOUNT","check amount",f,0),409);
    failure(()->trust.feedback(tenant,caseId,"advisor",a,"OTHER","changed",f,0),409);
    assertThat(store.list(tenant,caseId,"trust-feedback")).hasSize(1);
  }
  @Test void correctionIsADraftAndMustBelongToTheReportingActor(){
    String a=uuid(),f=uuid();answer(a,"");trust.feedback(tenant,caseId,"advisor",a,"WRONG_AMOUNT","verify evidence",f,0);
    var draft=trust.correction(tenant,caseId,"advisor",a,f,"en",0);
    assertThat(draft).containsEntry("automaticSend",false).containsEntry("revisionOf",a);
    assertThat(draft.get("question").toString()).contains("Feedback is not verified truth").hasSizeLessThanOrEqualTo(2000);
    trust.validateRevision(tenant,caseId,"advisor",a,f);
    failure(()->trust.validateRevision(tenant,caseId,"other",a,f),404);
    failure(()->trust.validateRevision(tenant,caseId,"advisor",null,f),400);
    assertThat(store.list(tenant,caseId,"trust-answer")).hasSize(1);
  }
  @Test void staleCaseCannotCreateFeedbackOrTasks(){
    String a=uuid();answer(a,"");
    failure(()->trust.feedback(tenant,caseId,"advisor",a,"OTHER","note",uuid(),1),409);
    failure(()->trust.createTask(tenant,caseId,"advisor","","Review","check",uuid(),1),409);
  }
  @Test void taskStateMachineRequiresOwnerNoteAndVersion(){
    String id=uuid();trust.createTask(tenant,caseId,"advisor","","Check evidence","No automatic decision",id,0);
    failure(()->trust.transition(tenant,caseId,"reviewer",false,id,"RESOLVE","checked",0,0),409);
    var claimed=trust.transition(tenant,caseId,"reviewer",false,id,"CLAIM","",0,0);
    assertThat(claimed).containsEntry("state","IN_REVIEW").containsEntry("assignee","reviewer");
    failure(()->trust.transition(tenant,caseId,"other",false,id,"RESOLVE","checked",1,0),403);
    failure(()->trust.transition(tenant,caseId,"reviewer",false,id,"RESOLVE","",1,0),400);
    failure(()->trust.transition(tenant,caseId,"reviewer",false,id,"RETURN","more evidence",0,0),409);
    trust.transition(tenant,caseId,"reviewer",false,id,"RETURN","Need original",1,0);
    trust.transition(tenant,caseId,"second-reviewer",false,id,"CLAIM","",2,0);
    trust.transition(tenant,caseId,"second-reviewer",false,id,"RESOLVE","Checked original; not a credit approval",3,0);
    var reopened=trust.transition(tenant,caseId,"reviewer",false,id,"REOPEN","Follow-up evidence",4,0);
    assertThat(reopened).containsEntry("state","OPEN").containsEntry("assignee","");
    assertThat((List<?>)reopened.get("history")).hasSize(6);
  }
  @Test void taskRetryDoesNotCreateDuplicateOrChangeItsOriginalNote(){
    String id=uuid();trust.createTask(tenant,caseId,"advisor","","Title","Note",id,0);
    trust.createTask(tenant,caseId,"advisor","","Title","Note",id,0);
    failure(()->trust.createTask(tenant,caseId,"advisor","","Title","Different",id,0),409);
    assertThat(store.list(tenant,caseId,"trust-task")).hasSize(1);
  }
  @Test void featureToggleIsCaseScopedVersionedAndDoesNotCallAI(){
    trust.configure(tenant,caseId,"admin","nova",false,0,0,"Incident containment");
    failure(()->trust.requireEnabled(tenant,caseId,"nova"),503);
    failure(()->trust.taskPrompt(tenant,caseId,"summary","en",0),503);
    assertThat(trust.enabled(tenant,"other-case","nova")).isTrue();
    failure(()->trust.configure(tenant,caseId,"admin","nova",true,0,0,"stale"),409);
    trust.configure(tenant,caseId,"admin","nova",true,1,0,"Retest complete");
    assertThat(store.list(tenant,caseId,"trust-event")).hasSize(2);
    assertThat(store.list(tenant,caseId,"trust-answer")).isEmpty();
  }
  @Test void taskLibraryOnlyPreparesSevenControlledReadOnlyDrafts(){
    assertThat(TrustCatalog.TASKS).hasSize(7);
    for(String id:TrustCatalog.TASKS)for(String locale:List.of("en","de","vi"))assertThat(trust.taskPrompt(tenant,caseId,id,locale,0)).containsEntry("automaticSend",false);
    failure(()->trust.taskPrompt(tenant,caseId,"payment","en",0),404);
    assertThat(TrustCatalog.features()).allSatisfy(f->assertThat(f).containsEntry("payments",false).containsEntry("humanReview",true));
    assertThat(store.list(tenant,caseId,"trust-answer")).isEmpty();
  }
  @Test void newAzureTasksPreserveEvidenceAndNeverPromiseDecisionsOrCertifiedTranslation(){
    for(String task:List.of("review-checklist","terminology","bilingual-summary"))for(String locale:List.of("en","de","vi")){
      String question=TrustCatalog.question(task,locale);assertThat(question).isNotBlank().hasSizeLessThanOrEqualTo(2000);
      assertThat(task.matches(TrustCatalog.TASK_PATTERN)).isTrue();
    }
    assertThat(TrustCatalog.question("terminology","en")).contains("absent terms","Do not invent");
    assertThat(TrustCatalog.question("bilingual-summary","vi")).contains("German–Vietnamese","amounts exactly","certified translation");
    trust.configure(tenant,caseId,"admin","review-checklist",false,0,0,"Synthetic test");
    failure(()->trust.taskPrompt(tenant,caseId,"review-checklist","vi",0),503);
    assertThat(trust.taskPrompt(tenant,caseId,"terminology","vi",0)).containsEntry("automaticSend",false);
  }
  @Test void measuredMetricsAndSafeMetadataDoNotInventAccuracyOrCost(){
    ReflectionTestUtils.setField(trust,"deployment","gpt-4.1-mini");String a=uuid();answer(a,"");
    store.insert(tenant,caseId,"field-review",uuid(),Map.of("fieldsReviewed",4,"fieldsChanged",1));
    var snapshot=trust.snapshot(tenant,caseId,"advisor",false);
    var metrics=(Map<?,?>)snapshot.get("metrics");assertThat(metrics.get("costAvailable")).isEqualTo(false);assertThat(metrics.get("fieldsChanged")).isEqualTo(1L);assertThat(metrics.get("p50Ms")).isEqualTo(120L);
    assertThat(snapshot.toString()).doesNotContain("apiKey","Bearer","endpoint");
    assertThat(snapshot.get("answers")).isNotNull();
  }
  @Test void sqlPersistenceSupportsImmutableInsertAndOptimisticTransitions(){
    var db=new DriverManagerDataSource("jdbc:h2:mem:trust-"+uuid()+";DB_CLOSE_DELAY=-1;MODE=PostgreSQL","sa","");
    new JdbcTemplate(db).execute("CREATE TABLE lab_records(tenant VARCHAR(100),case_id VARCHAR(100),kind VARCHAR(50),id VARCHAR(100),created_at TIMESTAMP,payload TEXT,PRIMARY KEY(tenant,case_id,kind,id))");
    var sql=new LabStore(Optional.of(db),new ObjectMapper());var service=new TrustService(cases,sql,null);
    String id=uuid();service.createTask(tenant,caseId,"advisor","","Persistent task","Check original",id,0);
    service.transition(tenant,caseId,"reviewer",false,id,"CLAIM","",0,0);
    var reopenedStore=new LabStore(Optional.of(db),new ObjectMapper());
    assertThat(reopenedStore.find(tenant,caseId,"trust-task",id).orElseThrow()).containsEntry("state","IN_REVIEW");
    assertThat(reopenedStore.find("foreign",caseId,"trust-task",id)).isEmpty();
    failure(()->service.transition(tenant,caseId,"reviewer",false,id,"RESOLVE","checked",0,0),409);
  }
}
