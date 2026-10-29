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
    assertThat(LocalDataPipeline.currentMethod(Map.of("result",Map.of("method","document-medallion-v3")))).isTrue();
    assertThat(LocalDataPipeline.currentMethod(Map.of())).isFalse();
  }
  @Test void disabledPipelineCannotQueueAndNeverCreatesSampleScores(){
    var cases=new CreditCaseService();var store=new LabStore(Optional.empty(),new ObjectMapper());var research=new DocumentResearch(cases,store,new RagEngine(false,""),mock(DistributedLimits.class));
    var etl=new LocalDataPipeline(cases,store,research,mock(DistributedLimits.class),false,root.toString());
    assertThat(etl.read("praxisbank-demo","CR-2026-1048")).containsEntry("enabled",false).containsEntry("workerReady",false).containsEntry("cloudCalls",0);
    assertThat((List<?>)etl.read("praxisbank-demo","CR-2026-1048").get("runs")).isEmpty();
    assertThatThrownBy(()->etl.read("foreign","CR-2026-1048")).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
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
