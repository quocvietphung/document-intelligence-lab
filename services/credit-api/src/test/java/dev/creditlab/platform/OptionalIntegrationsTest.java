package dev.creditlab.platform;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import dev.creditlab.casework.CreditCaseService;
import java.io.ByteArrayOutputStream;
import org.apache.pdfbox.pdmodel.*;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class OptionalIntegrationsTest {
  @Test void localResponseStatusRequiresMatchingSavedModelWithoutCallingInference(){
    var store=mock(LabStore.class);var cases=mock(CreditCaseService.class);
    when(store.list("tenant","case","trust-answer")).thenReturn(java.util.List.of(java.util.Map.of("mode","local-ollama","modelId","qwen3:1.7b","time","2026-10-20T10:00:00Z")));
    var integrations=new ResearchIntegrations(cases,mock(BlobSources.class),store);
    org.springframework.test.util.ReflectionTestUtils.setField(integrations,"nova","ollama");
    org.springframework.test.util.ReflectionTestUtils.setField(integrations,"localModel","qwen3:1.7b");
    var saved=(java.util.Map<?,?>)org.springframework.test.util.ReflectionTestUtils.invokeMethod(integrations,"localNova","tenant","case");
    assertThat(saved.get("verification")).isEqualTo("SAVED_RESPONSE");
    org.springframework.test.util.ReflectionTestUtils.setField(integrations,"localModel","another-local-model");
    var other=(java.util.Map<?,?>)org.springframework.test.util.ReflectionTestUtils.invokeMethod(integrations,"localNova","tenant","case");
    assertThat(other.get("verification")).isEqualTo("NOT_LIVE_TESTED");assertThat(other.containsKey("recordedAt")).isFalse();
  }
  @Test void bgeConfigurationUsesSeparateIndexWithoutWarmingModel(){
    var rag=new RagEngine(true,"");org.springframework.test.util.ReflectionTestUtils.setField(rag,"embeddingProvider","bge-m3");
    rag.validateConfiguration();assertThat(rag.configuration().get("embeddingModel")).isEqualTo("BAAI/bge-m3 (1024d, multilingual)");
    assertThat((String)org.springframework.test.util.ReflectionTestUtils.invokeMethod(rag,"collection")).isEqualTo("document_lab_bge_m3_v1");
    assertThat((Integer)org.springframework.test.util.ReflectionTestUtils.invokeMethod(rag,"dimensions")).isEqualTo(1024);
  }
  @Test void blobNamesCannotEscapeTenantDossierOrAcceptRemoteUrls(){
    String prefix=BlobSources.prefix("tenant","case");assertThat(prefix).matches("[a-f0-9]{64}/");
    BlobSources.scopedName(prefix+"policy.pdf",prefix);
    assertThat(BlobSources.prefix("other","case")).isNotEqualTo(prefix);
    for(String name:java.util.List.of("other/policy.pdf",prefix+"../policy.pdf",prefix+"nested/policy.pdf",prefix+"a".repeat(120)+".pdf"))assertThatThrownBy(()->BlobSources.scopedName(name,prefix)).isInstanceOf(ResponseStatusException.class);
    for(String endpoint:java.util.List.of("http://localhost", "https://account.blob.core.windows.net/?sig=secret", "https://account.blob.core.windows.net/container"))assertThatThrownBy(()->BlobSources.validateEndpoint(endpoint,"intake")).isInstanceOf(IllegalArgumentException.class);
    BlobSources.validateEndpoint("https://account.blob.core.windows.net","intake");
  }
  @Test void unconfiguredBlobDoesNotConstructCloudClient(){
    var cases=mock(CreditCaseService.class);var source=new BlobSources(cases,mock(DocumentBatches.class),"","intake");
    assertThat(source.configured()).isFalse();
    assertThatThrownBy(()->source.list("tenant","case")).isInstanceOf(ResponseStatusException.class).hasMessageContaining("503");
    verify(cases).require("tenant","case");
  }
  @Test void rendersOneBoundedOriginalPageWithoutVisionModel()throws Exception{
    byte[] pdf;try(var document=new PDDocument();var output=new ByteArrayOutputStream()){document.addPage(new PDPage());document.save(output);pdf=output.toByteArray();}
    assertThat(DocumentVision.pageImage(pdf,1)).startsWith((byte)137,(byte)80,(byte)78,(byte)71);
    assertThatThrownBy(()->DocumentVision.pageImage(pdf,2)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("422");
    assertThatThrownBy(()->DocumentVision.pageImage(new byte[3_000_001],1)).isInstanceOf(ResponseStatusException.class);
  }
}
