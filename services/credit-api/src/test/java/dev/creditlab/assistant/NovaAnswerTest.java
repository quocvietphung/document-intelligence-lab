package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import dev.creditlab.assistant.NovaAnswer.Answer;
import dev.creditlab.assistant.NovaAnswer.Segment;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class NovaAnswerTest {
  private static final List<CreditAssistantService.Source> SOURCES = List.of(
      new CreditAssistantService.Source("doc-acceptance:p1:c1", "Acceptance · p. 1", "Position 3 not accepted"),
      new CreditAssistantService.Source("doc-invoice:p2:c1", "Invoice · p. 2", "Gross 49.980,00 EUR"));

  @Test void labelsFollowTheEvidenceOrder() {
    assertThat(NovaAnswer.labels(SOURCES)).containsExactly(Map.entry("S1", "doc-acceptance:p1:c1"), Map.entry("S2", "doc-invoice:p2:c1"));
  }

  @Test void renderBindsEachLabelToItsAuthorizedIdAndTheUnchangedValidatorAcceptsIt() {
    var answer = new Answer(List.of(
        new Segment("Position 3 wurde nicht abgenommen.", "S1"),
        new Segment("Die Rechnung beträgt 49.980,00 EUR brutto.", "S2"),
        new Segment("Ein Zahlungsnachweis fehlt.", "")));
    String text = NovaAnswer.render(answer, SOURCES);
    assertThat(text).isEqualTo("""
        Position 3 wurde nicht abgenommen. [doc-acceptance:p1:c1]
        Die Rechnung beträgt 49.980,00 EUR brutto. [doc-invoice:p2:c1]
        Ein Zahlungsnachweis fehlt.""");
    assertThat(SourceCitations.validate(text, SOURCES)).isEqualTo(text);
  }

  @Test void anUnknownLabelIsRefusedAndNeverGuessed() {
    var answer = new Answer(List.of(new Segment("Summe 1,00 EUR.", "S9")));
    assertThatThrownBy(() -> NovaAnswer.render(answer, SOURCES))
        .isInstanceOfSatisfying(ModelContractException.class, e -> assertThat(e.reason()).isEqualTo("UNKNOWN_SOURCE_LABEL"));
  }

  @Test void bracketsWrittenInsideTextStayRefusedByTheValidator() {
    String text = NovaAnswer.render(new Answer(List.of(new Segment("Positionen [1, 2] fehlen.", "S1"))), SOURCES);
    assertThatThrownBy(() -> SourceCitations.validate(text, SOURCES))
        .isInstanceOfSatisfying(ModelContractException.class, e -> assertThat(e.reason()).isEqualTo("NON_SOURCE_BRACKET"));
  }

  @Test void aBlankSegmentCarriesNoClaimAndIsDropped() {
    var answer = new Answer(List.of(new Segment("   ", "S1"), new Segment("Ein Zahlungsnachweis fehlt.", "")));
    assertThat(NovaAnswer.render(answer, SOURCES)).isEqualTo("Ein Zahlungsnachweis fehlt.");
  }

  @Test void anEmptyAnswerIsNotRenderedAsAnswer() {
    String text = NovaAnswer.render(new Answer(List.of()), SOURCES);
    assertThat(text).isEmpty();
    assertThatThrownBy(() -> SourceCitations.validate(text, SOURCES))
        .isInstanceOfSatisfying(ModelContractException.class, e -> assertThat(e.reason()).isEqualTo("EMPTY_ANSWER"));
  }

  @Test void ollamaReceivesASchemaThatOffersOnlyAuthorizedLabelsAndNoSourceId() throws Exception {
    var mapper = new ObjectMapper();
    var body = new AtomicReference<String>();
    var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/api/chat", exchange -> {
      body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
      byte[] response = mapper.writeValueAsBytes(Map.of("model", "qwen3:4b-instruct-2507-q4_K_M",
          "message", Map.of("role", "assistant", "content", "{\"segments\":[{\"text\":\"Ein Zahlungsnachweis fehlt.\",\"source\":\"\"}]}"),
          "done", true, "done_reason", "stop"));
      exchange.getResponseHeaders().set("Content-Type", "application/json");
      exchange.sendResponseHeaders(200, response.length);
      exchange.getResponseBody().write(response);
      exchange.close();
    });
    server.start();
    try {
      var model = new LocalAiConfiguration().localChatModel("http://127.0.0.1:" + server.getAddress().getPort(), "qwen3:4b-instruct-2507-q4_K_M");
      var generated = NovaAnswer.generate(model, SOURCES, DocumentReviewModel.prompt("general", "German", "Fehlt etwas?", SOURCES));
      assertThat(generated.value().segments()).containsExactly(new Segment("Ein Zahlungsnachweis fehlt.", ""));
      var source = mapper.readTree(body.get()).path("format").path("properties").path("segments").path("items").path("properties").path("source");
      assertThat(source.path("enum")).hasSize(3);
      assertThat(source.path("enum").get(0).asText()).isEqualTo("S1");
      assertThat(source.path("enum").get(1).asText()).isEqualTo("S2");
      assertThat(source.path("enum").get(2).asText()).isEmpty();
      assertThat(body.get()).doesNotContain("doc-acceptance:p1:c1", "doc-invoice:p2:c1");
    } finally {
      server.stop(0);
    }
  }
}
