package dev.creditlab.platform;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.CreditCaseService;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LocalDataPipelineTest {
  @TempDir Path root;
  @Test void oldMoneyNormalizationReceiptsAreNotReusedAsCurrent(){
    assertThat(LocalDataPipeline.currentMethod(Map.of("result",Map.of("method","document-medallion-v1")))).isFalse();
    assertThat(LocalDataPipeline.currentMethod(Map.of("result",Map.of("method","document-medallion-v2")))).isFalse();
    assertThat(LocalDataPipeline.currentMethod(Map.of("result",Map.of("method","document-medallion-v3")))).isFalse();
    assertThat(LocalDataPipeline.currentMethod(Map.of("result",Map.of("method","document-medallion-v4")))).isTrue();
    assertThat(LocalDataPipeline.currentMethod(Map.of())).isFalse();
  }
  @Test void disabledPipelineCannotQueueAndNeverCreatesSampleScores(){
    var cases=new CreditCaseService();var store=new LabStore(Optional.empty(),new ObjectMapper());var research=new DocumentResearch(cases,store,new RagEngine(false,""),mock(DistributedLimits.class));
    var etl=new LocalDataPipeline(cases,store,research,mock(DistributedLimits.class),false,root.toString());
    assertThat(etl.read("praxisbank-demo","CR-2026-1048")).containsEntry("enabled",false).containsEntry("workerReady",false).containsEntry("cloudCalls",0);
    assertThat((List<?>)etl.read("praxisbank-demo","CR-2026-1048").get("runs")).isEmpty();
    assertThatThrownBy(()->etl.read("foreign","CR-2026-1048")).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
  }
  @Test void controlTowerListShowsOnlyTheLatestCompletedRunWithMartsPerDossierOfTheCallersTenant(){
    var store=new LabStore(Optional.empty(),new ObjectMapper());
    var etl=new LocalDataPipeline(mock(CreditCaseService.class),store,mock(DocumentResearch.class),mock(DistributedLimits.class),true,root.toString());
    store.insert("tenant","CR-A","medallion-run","etl-1",Map.of("id","etl-1","time","2026-11-15T10:00:00Z","status","COMPLETE","result",Map.of("controlTower",Map.of("schemaVersion","control-tower-v1"))));
    store.insert("tenant","CR-A","medallion-run","etl-0",Map.of("id","etl-0","time","2026-11-14T10:00:00Z","status","COMPLETE","result",Map.of("controlTower",Map.of())));
    store.insert("tenant","CR-B","medallion-run","etl-2",Map.of("id","etl-2","time","2026-11-15T11:00:00Z","status","COMPLETE","result",Map.of("method","document-medallion-v3")));
    store.insert("tenant","CR-C","medallion-run","etl-3",Map.of("id","etl-3","time","2026-11-15T12:00:00Z","status","FAILED"));
    store.insert("tenant","CR-D","medallion-run","etl-5",Map.of("id","etl-5","time","2026-11-15T09:00:00Z","status","COMPLETE","result",Map.of("controlTower",Map.of())));
    store.insert("other","CR-E","medallion-run","etl-4",Map.of("id","etl-4","time","2026-11-15T13:00:00Z","status","COMPLETE","result",Map.of("controlTower",Map.of())));
    assertThat(etl.controlTowerRuns("tenant")).containsExactly(
      Map.of("caseId","CR-A","runId","etl-1","time","2026-11-15T10:00:00Z"),
      Map.of("caseId","CR-D","runId","etl-5","time","2026-11-15T09:00:00Z"));
    assertThat(etl.controlTowerRuns("nobody")).isEmpty();
  }
  @Test void downloadPathsCannotEscapeTheAuthorizedScope(){
    var cases=mock(CreditCaseService.class);var store=new LabStore(Optional.empty(),new ObjectMapper());
    var etl=new LocalDataPipeline(cases,store,mock(DocumentResearch.class),mock(DistributedLimits.class),true,root.toString());
    for(String path:List.of("../secret","gold/../../secret","history","bronze.parquet"))assertThatThrownBy(()->etl.artifact("tenant","case","etl-12345678-1234-1234-1234-123456789abc",path)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
  }
  @Test void queueRequiresConsentVersionAndReadyWorkerBeforeWritingAnySnapshot() throws Exception {
    var cases=mock(CreditCaseService.class);var item=new CreditCaseService().require("praxisbank-demo","CR-2026-1048");
    when(cases.require("tenant","case")).thenReturn(item);
    var store=spy(new LabStore(Optional.empty(),new ObjectMapper()));doReturn(true).when(store).persistent();
    var research=new DocumentResearch(cases,store,new RagEngine(false,""),mock(DistributedLimits.class));
    var etl=new LocalDataPipeline(cases,store,research,mock(DistributedLimits.class),true,root.toString());
    assertThatThrownBy(()->etl.enqueue("tenant","case","actor",new LocalDataPipeline.Request(item.version(),UUID.randomUUID(),false))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThatThrownBy(()->etl.enqueue("tenant","case","actor",new LocalDataPipeline.Request(item.version()+1,UUID.randomUUID(),true))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThatThrownBy(()->etl.enqueue("tenant","case","actor",new LocalDataPipeline.Request(item.version(),UUID.randomUUID(),true))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThat(store.list("tenant","case","medallion-run")).isEmpty();
    assertThat(Files.exists(root.resolve("queue"))).isFalse();
  }
}
