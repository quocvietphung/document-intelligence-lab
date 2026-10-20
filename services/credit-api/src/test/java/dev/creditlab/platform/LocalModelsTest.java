package dev.creditlab.platform;

import static org.assertj.core.api.Assertions.*;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class LocalModelsTest {
  @Test void validatesModelDimensionsAndNoAuthorizationCrossesBoundary() throws Exception {
    var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
    var requests=new ArrayList<String>();
    server.createContext("/embed",exchange->{
      requests.add(Objects.toString(exchange.getRequestHeaders().getFirst("Authorization"),"absent"));
      String vector="1,"+"0,".repeat(1022)+"0";
      byte[] bytes=("{\"model\":\"BAAI/bge-m3\",\"vectors\":[["+vector+"]]}").getBytes(StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(200,bytes.length);try(var body=exchange.getResponseBody()){body.write(bytes);}
    });server.start();
    try{assertThat(new LocalModels("http://127.0.0.1:"+server.getAddress().getPort()).embed("Permitted fictional text")).hasSize(1024);assertThat(requests).containsExactly("absent");}finally{server.stop(0);}
  }
  @Test void rejectsWrongModelDimensionsZeroVectorsAndOutOfRangeScores() throws Exception {
    for(String response:List.of("{\"model\":\"other\",\"vectors\":[[1]]}","{\"model\":\"BAAI/bge-m3\",\"vectors\":[[1]]}","{\"model\":\"BAAI/bge-m3\",\"vectors\":[["+"0,".repeat(1023)+"0]]}")){
      var server=fixture(response,200);try{assertThatThrownBy(()->new LocalModels(url(server)).embed("Test")).isInstanceOf(ResponseStatusException.class);}finally{server.stop(0);}
    }
    var server=fixture("{\"model\":\"BAAI/bge-reranker-v2-m3\",\"scores\":[2]}",200);
    try{assertThatThrownBy(()->new LocalModels(url(server)).rerank("Test",List.of("text"))).isInstanceOf(ResponseStatusException.class);}finally{server.stop(0);}
  }
  @Test void busyProviderDoesNotFallBack() throws Exception {
    var server=fixture("{}",429);try{assertThatThrownBy(()->new LocalModels(url(server)).embed("Test")).isInstanceOf(ResponseStatusException.class).hasMessageContaining("429");}finally{server.stop(0);}
  }
  private static String url(HttpServer server){return "http://127.0.0.1:"+server.getAddress().getPort();}
  private static HttpServer fixture(String response,int status)throws Exception{var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);server.createContext("/",exchange->{byte[] bytes=response.getBytes(StandardCharsets.UTF_8);exchange.sendResponseHeaders(status,bytes.length);try(var body=exchange.getResponseBody()){body.write(bytes);}});server.start();return server;}
}
