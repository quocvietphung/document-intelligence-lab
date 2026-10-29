package dev.creditlab.platform;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class DocumentResearchTest {
  private final CreditCaseService cases=mock(CreditCaseService.class);
  private final LabStore store=new LabStore(Optional.empty(),new ObjectMapper());
  private final DocumentResearch service=new DocumentResearch(cases,store,new RagEngine(false,""),mock(DistributedLimits.class));
  private CreditCase item(long version,String net) {
    var page=new CreditCase.Page(1,"Netto-Verdienst: "+net+"\nAuszahlungsbetrag: 2.882,11 EUR","pdf-text");
    var doc=new CreditCase.Document("original","source.pdf","income","review",97,
        List.of(new CreditCase.Field("netIncome",net,97,1,"Netto-Verdienst"),new CreditCase.Field("payoutAmount","2.882,11 EUR",97,1,"Auszahlungsbetrag")),
        List.of(page),true,"azure-document-intelligence","prebuilt-layout","application/pdf");
    var fixture=new CreditCase.Document("fixture","old-fixture.txt","income","review",99,doc.fields(),doc.pages(),false,"fixture","rules","text/plain");
    return new CreditCase("dossier","tenant","Research","Source evaluation",0,0,"HUMAN_REVIEW",List.of(),List.of(),"","2026-01-01",List.of(doc,fixture),List.of(),version,"banking");
  }
  private void current(CreditCase value){when(cases.require("tenant","dossier")).thenReturn(value);}
  private Map<String,Object> dataset(List<DocumentResearch.FieldLabel> fields,List<DocumentResearch.QuestionLabel> questions) {
    return service.save("tenant","dossier","advisor",new DocumentResearch.DatasetRequest(1,"PDF checked v1",fields,questions,true));
  }
  @SuppressWarnings("unchecked") private List<Map<String,Object>> variants(Map<String,Object> run){return (List<Map<String,Object>>)run.get("variants");}
  @Test void catalogueUsesActualOriginalsAndNeverSeedsScores() {
    current(item(1,"2.967,11 EUR"));var value=service.read("tenant","dossier");
    assertThat((List<?>)value.get("documents")).hasSize(1);assertThat((List<?>)value.get("datasets")).isEmpty();assertThat((List<?>)value.get("runs")).isEmpty();
    assertThat(value.get("sourceHash").toString()).hasSize(64);
  }
  @Test void extractionMeasuresMissingAndWrongFieldsOnAnExplicitLabelledSubset() {
    current(item(1,"2.967,11 EUR"));
    var ref=dataset(List.of(new DocumentResearch.FieldLabel("original",1,"netIncome","2.967,11 EUR"),new DocumentResearch.FieldLabel("original",1,"payoutAmount","9.999,00 EUR"),new DocumentResearch.FieldLabel("original",1,"employer","Fictional employer")),List.of());
    var result=service.run("tenant","dossier","advisor",new DocumentResearch.RunRequest(1,ref.get("id").toString(),DocumentResearch.Suite.EXTRACTION));
    assertThat(result).containsEntry("azureCalls",0).containsEntry("methodVersion","source-evaluation-v2");
    @SuppressWarnings("unchecked")var metrics=(Map<String,Object>)variants(result).getFirst().get("metrics");
    assertThat(metrics).containsEntry("truePositive",1).containsEntry("falsePositive",1).containsEntry("falseNegative",2).containsEntry("f1",40.0);
    assertThat(store.list("tenant","dossier","document-experiment")).hasSize(1);
    assertThat(store.list("foreign","dossier","document-experiment")).isEmpty();
  }
  @Test void missingPredictionsDoNotFabricatePrecision() {
    current(item(1,"2.967,11 EUR"));var ref=dataset(List.of(new DocumentResearch.FieldLabel("original",1,"missingField","missing")),List.of());
    var run=service.run("tenant","dossier","advisor",new DocumentResearch.RunRequest(1,ref.get("id").toString(),DocumentResearch.Suite.EXTRACTION));
    assertThat(((Map<?,?>)variants(run).getFirst().get("metrics")).get("precision")).isNull();
  }
  @Test void retrievalUsesActualDocumentPageTargetsAndDoesNotReplaceLiveIndex() {
    current(item(1,"2.967,11 EUR"));var ref=dataset(List.of(),List.of(new DocumentResearch.QuestionLabel("Netto-Verdienst", "original",1)));
    var result=service.run("tenant","dossier","advisor",new DocumentResearch.RunRequest(1,ref.get("id").toString(),DocumentResearch.Suite.RETRIEVAL));
    assertThat(variants(result)).extracting(v->v.get("method")).containsExactly("BM25","VECTOR","HYBRID","RRF","LEGACY_HYBRID");
    for(var variant:variants(result))assertThat(((Map<?,?>)variant.get("metrics")).get("hitRateAt5")).isEqualTo(100.0);
    assertThat(store.list("tenant","other-dossier","document-experiment")).isEmpty();
  }
  @Test void changedSourcesAndStaleDossierVersionsCannotProduceFreshScores() {
    current(item(1,"2.967,11 EUR"));var ref=dataset(List.of(new DocumentResearch.FieldLabel("original",1,"netIncome","2.967,11 EUR")),List.of());
    current(item(2,"1.000,00 EUR"));
    for(long version:List.of(1L,2L))assertThatThrownBy(()->service.run("tenant","dossier","advisor",new DocumentResearch.RunRequest(version,ref.get("id").toString(),DocumentResearch.Suite.EXTRACTION)))
        .isInstanceOf(ResponseStatusException.class).satisfies(e->assertThat(((ResponseStatusException)e).getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    assertThat(store.list("tenant","dossier","document-experiment")).isEmpty();
  }
  @Test void labelsRequireIndependentCheckAvailableOriginalPageAndUniqueKeys() {
    current(item(1,"2.967,11 EUR"));
    assertThatThrownBy(()->service.save("tenant","dossier","advisor",new DocumentResearch.DatasetRequest(1,"v1",List.of(),List.of(),false))).isInstanceOf(ResponseStatusException.class);
    for(var f:List.of(new DocumentResearch.FieldLabel("fixture",1,"netIncome","1"),new DocumentResearch.FieldLabel("original",99,"netIncome","1"),new DocumentResearch.FieldLabel("foreign",1,"netIncome","1")))
      assertThatThrownBy(()->dataset(List.of(f),List.of())).isInstanceOf(ResponseStatusException.class);
    var f=new DocumentResearch.FieldLabel("original",1,"netIncome","1");
    assertThatThrownBy(()->dataset(List.of(f,f),List.of())).isInstanceOf(ResponseStatusException.class);
  }
  @Test void privateExportHasRealTextAndReferencesButNoPdfBytesOrCloudUpload() {
    current(item(1,"2.967,11 EUR"));dataset(List.of(),List.of(new DocumentResearch.QuestionLabel("Netto-Verdienst", "original",1)));
    var bundle=service.export("tenant","dossier","advisor",1);
    assertThat(bundle).containsEntry("cloudUploaded",false).containsEntry("destination","browser-download-only");
    assertThat((List<?>)bundle.get("silver")).hasSize(1);assertThat((List<?>)bundle.get("gold")).hasSize(1);assertThat((List<?>)bundle.get("evaluationInputs")).hasSize(1);
    assertThat(store.list("tenant","dossier","data-export")).hasSize(1);
    assertThat(store.encode(store.list("tenant","dossier","data-export"))).doesNotContain("2.967,11","Netto-Verdienst");
  }
  @Test void referenceVersionsAreImmutableAndDatasetIdsAreDossierScoped() {
    current(item(1,"2.967,11 EUR"));var label=new DocumentResearch.FieldLabel("original",1,"netIncome","2.967,11 EUR");
    var first=dataset(List.of(label),List.of());var second=dataset(List.of(label),List.of());assertThat(first.get("id")).isNotEqualTo(second.get("id"));
    assertThat(store.list("tenant","dossier","document-reference")).hasSize(2);
    assertThatThrownBy(()->service.run("tenant","dossier","advisor",new DocumentResearch.RunRequest(1,"foreign-reference",DocumentResearch.Suite.EXTRACTION))).isInstanceOf(ResponseStatusException.class);
  }
  @Test void normalizationPreservesAmountsCurrenciesAndSigns() {
    assertThat(DocumentResearch.normalize("  ACME   GmbH ")).isEqualTo("acme gmbh");
    assertThat(DocumentResearch.normalize("-100 EUR")).isNotEqualTo(DocumentResearch.normalize("100 EUR"));
    assertThat(DocumentResearch.normalize("2.967,11 EUR")).isNotEqualTo(DocumentResearch.normalize("2967.11 EUR"));
  }
  private LabStore durableStore() {
    var durable=spy(new LabStore(Optional.empty(),new ObjectMapper()));
    doReturn(true).when(durable).persistent();
    doReturn(mock(org.springframework.jdbc.core.JdbcTemplate.class)).when(durable).database();
    return durable;
  }
  private Map<String,Object> queued(DocumentResearch worker) {
    current(item(1,"2.967,11 EUR"));
    var reference=worker.save("tenant","dossier","advisor",new DocumentResearch.DatasetRequest(1,"Checked original",
        List.of(new DocumentResearch.FieldLabel("original",1,"netIncome","2.967,11 EUR")),List.of(),true));
    return worker.enqueue("tenant","dossier","advisor",new DocumentResearch.RunRequest(1,reference.get("id").toString(),DocumentResearch.Suite.EXTRACTION));
  }
  private void candidate(LabStore durable,Map<String,Object> job) {
    // PostgreSQL candidates have passed through JSON; mirror that numeric representation in the memory double.
    durable.save("tenant","dossier","document-experiment-job",job.get("id").toString(),durable.decode(durable.encode(job)));
    var rows=List.<Map<String,Object>>of(Map.of("tenant","tenant","case_id","dossier","id",job.get("id"),"payload",durable.encode(job)));
    when(durable.database().queryForList(anyString())).thenReturn(rows);
  }
  @Test void durableWorkerCompletesAQueuedExperimentWithTheSameResultId() {
    var durable=durableStore();var worker=new DocumentResearch(cases,durable,new RagEngine(false,""),mock(DistributedLimits.class));
    var job=queued(worker);candidate(durable,job);worker.work();
    assertThat(durable.find("tenant","dossier","document-experiment-job",job.get("id").toString()).orElseThrow()).containsEntry("status","COMPLETE").containsEntry("attempt",1);
    assertThat(durable.find("tenant","dossier","document-experiment",job.get("id").toString()).orElseThrow()).containsEntry("azureCalls",0);
    worker.work(); // The original queued payload can no longer acquire the lease.
    assertThat(durable.list("tenant","dossier","document-experiment")).hasSize(1);
  }
  @Test void changedDossierFailsTheJobWithoutPublishingStaleMetrics() {
    var durable=durableStore();var worker=new DocumentResearch(cases,durable,new RagEngine(false,""),mock(DistributedLimits.class));
    var job=queued(worker);candidate(durable,job);current(item(2,"1.000,00 EUR"));worker.work();
    assertThat(durable.find("tenant","dossier","document-experiment-job",job.get("id").toString()).orElseThrow()).containsEntry("status","FAILED").containsEntry("errorCode","SOURCE_CHANGED");
    assertThat(durable.list("tenant","dossier","document-experiment")).isEmpty();
  }
  @Test void exhaustedLeaseRecoveryCannotLoopForever() {
    var durable=durableStore();var worker=new DocumentResearch(cases,durable,new RagEngine(false,""),mock(DistributedLimits.class));
    var job=new LinkedHashMap<>(queued(worker));job.put("attempt",3);job.put("status","RUNNING");
    durable.save("tenant","dossier","document-experiment-job",job.get("id").toString(),job);candidate(durable,job);worker.work();
    assertThat(durable.find("tenant","dossier","document-experiment-job",job.get("id").toString()).orElseThrow()).containsEntry("status","FAILED").containsEntry("errorCode","ATTEMPTS_EXHAUSTED");
    assertThat(durable.list("tenant","dossier","document-experiment")).isEmpty();
  }
  @Test void disabledWorkerRejectsNewJobsInsteadOfLeavingThemQueuedForever() {
    var durable=durableStore();var worker=new DocumentResearch(cases,durable,new RagEngine(false,""),mock(DistributedLimits.class));
    org.springframework.test.util.ReflectionTestUtils.setField(worker,"workerEnabled",false);
    assertThatThrownBy(()->queued(worker)).isInstanceOf(ResponseStatusException.class)
        .satisfies(error->assertThat(((ResponseStatusException)error).getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    assertThat(durable.list("tenant","dossier","document-experiment-job")).isEmpty();
  }
  @Test void multiSourceLabelsValidateEveryPageAndKeepNegativeExportsExplicit() {
    current(item(1,"2.967,11 EUR"));
    var valid=new DocumentResearch.QuestionLabel("Compare amounts","original",1,List.of(new DocumentResearch.RelevantSource("original",1)),true,"holdout","en");
    var absent=new DocumentResearch.QuestionLabel("Unknown pension forecast","",0,List.of(),false,"holdout","en");
    var reference=dataset(List.of(),List.of(valid,absent));var result=service.run("tenant","dossier","advisor",new DocumentResearch.RunRequest(1,reference.get("id").toString(),DocumentResearch.Suite.RETRIEVAL));
    @SuppressWarnings("unchecked")var metrics=(Map<String,Object>)variants(result).getFirst().get("metrics");assertThat(metrics).containsEntry("answerableSamples",1).containsEntry("unanswerableQuestions",1);
    assertThat(service.export("tenant","dossier","advisor",1).get("evaluationInputs")).isInstanceOf(List.class);
    var foreign=new DocumentResearch.QuestionLabel("Foreign page","original",1,List.of(new DocumentResearch.RelevantSource("foreign",1)),true,"holdout","en");
    assertThatThrownBy(()->dataset(List.of(),List.of(foreign))).isInstanceOf(ResponseStatusException.class);
    var tuning=new DocumentResearch.QuestionLabel("Same source in tune","original",1,null,true,"tune","en");
    assertThatThrownBy(()->dataset(List.of(),List.of(valid,tuning))).isInstanceOf(ResponseStatusException.class).hasMessageContaining("cross tuning");
    var invented=new DocumentResearch.QuestionLabel("No answer but source","original",1,null,false,"holdout","en");
    assertThatThrownBy(()->dataset(List.of(),List.of(invented))).isInstanceOf(ResponseStatusException.class);
  }
}
