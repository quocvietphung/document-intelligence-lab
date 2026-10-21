package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class SchemaChatTest {
  record Value(String value) {}
  @Test void backendRejectsCoercionUnknownPropertiesAndOverlongStringsEvenIfAProviderIgnoresTheSchema() throws Exception{
    var mapper=new ObjectMapper();var schema=SchemaChat.object(Map.of("value",SchemaChat.text(4)));
    for(String value:java.util.List.of("{\"value\":1234}","{\"value\":\"12345\"}","{\"value\":\"ok\",\"extra\":\"no\"}","{}"))
      assertThatThrownBy(()->SchemaChat.validate(mapper.readTree(value),schema)).isInstanceOf(IllegalArgumentException.class);
  }
  @Test void ollamaReceivesAnActualBoundedJsonSchemaNotOnlyAPromptInstruction() throws Exception {
    var mapper=new ObjectMapper();var body=new AtomicReference<String>();
    var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
    server.createContext("/api/chat",exchange->{
      body.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
      byte[] response=mapper.writeValueAsBytes(Map.of("model","qwen3:4b-instruct-2507-q4_K_M","message",Map.of("role","assistant","content","{\"value\":\"51109301\"}"),"done",true,"done_reason","stop"));
      exchange.getResponseHeaders().set("Content-Type","application/json");exchange.sendResponseHeaders(200,response.length);exchange.getResponseBody().write(response);exchange.close();
    });
    server.start();
    try{
      var model=new LocalAiConfiguration().localChatModel("http://127.0.0.1:"+server.getAddress().getPort(),"qwen3:4b-instruct-2507-q4_K_M");
      var value=SchemaChat.call(model,"Extract JSON only","Invoice number: 51109301",SchemaChat.object(Map.of("value",SchemaChat.text(20))),Value.class);
      assertThat(value.value()).isEqualTo("51109301");var request=mapper.readTree(body.get());
      assertThat(request.path("format").path("additionalProperties").asBoolean(true)).isFalse();
      assertThat(request.path("format").path("properties").path("value").path("maxLength").asInt()).isEqualTo(20);
      assertThat(request.path("think").asBoolean(true)).isFalse();
    }finally{server.stop(0);}
  }
}
