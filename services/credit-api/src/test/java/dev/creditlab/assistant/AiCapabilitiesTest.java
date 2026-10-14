package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.DocumentAnalysisService;
import dev.creditlab.platform.RagEngine;
import dev.langchain4j.model.chat.ChatModel;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.util.ReflectionTestUtils;

class AiCapabilitiesTest {
  private JwtAuthenticationToken auth(){return new JwtAuthenticationToken(Jwt.withTokenValue("synthetic-test-token").header("alg","none").subject("test").claim("tenant_id","praxisbank-demo").build());}
  private DocumentAnalysisService documents(String provider){var service=mock(DocumentAnalysisService.class);when(service.status()).thenReturn(Map.of("activeProvider",provider,"modelId","prebuilt-layout","mode","azure"));return service;}
  @Test void metadataNeverRunsInferenceOrInitializesEmbeddings() throws Exception {
    var model=mock(ChatModel.class);var rag=new RagEngine(true,"http://private-qdrant:6333");
    var response=new AiCapabilitiesController(Optional.of(model),documents("azure-document-intelligence"),rag,"lab-model").read(auth());
    String json=new ObjectMapper().writeValueAsString(response.getBody());
    assertThat(json).contains("lab-model","all-MiniLM-L6-v2","configuration-only","\"automaticInference\":false").doesNotContain("private-qdrant","apiKey","accessToken");
    assertThat(response.getHeaders().getFirst("Cache-Control")).isEqualTo("no-store");
    verifyNoInteractions(model);assertThat(ReflectionTestUtils.getField(rag,"model")).isNull();
  }
  @Test void localFallbackAndUnavailableAzureAreNotPresentedAsLiveAI() throws Exception {
    var result=new AiCapabilitiesController(Optional.empty(),documents("unavailable"),new RagEngine(false,""),"").read(auth());
    String json=new ObjectMapper().writeValueAsString(result.getBody());
    assertThat(json).contains("unavailable","lexical-hash","in-memory","\"configured\":false").doesNotContain("azure-openai");
  }
  @Test void endpointAndSecretLikeDeploymentStringsAreNeverReturned() throws Exception {
    String json=new ObjectMapper().writeValueAsString(new AiCapabilitiesController(Optional.of(mock(ChatModel.class)),documents("azure-document-intelligence"),new RagEngine(true,""),"https://secret-endpoint/?token=secret").read(auth()).getBody());
    assertThat(json).contains("not-reported").doesNotContain("secret-endpoint","token=secret");
  }
  @Test void requiresVerifiedTenant(){
    var controller=new AiCapabilitiesController(Optional.empty(),documents("unavailable"),new RagEngine(false,""),"");
    assertThatThrownBy(()->controller.read(null)).isInstanceOf(AccessDeniedException.class);
    var noTenant=new JwtAuthenticationToken(Jwt.withTokenValue("synthetic").header("alg","none").subject("test").build());
    assertThatThrownBy(()->controller.read(noTenant)).isInstanceOf(AccessDeniedException.class);
  }
}
