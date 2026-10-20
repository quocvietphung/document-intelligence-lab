package dev.creditlab.platform;

import com.fasterxml.jackson.databind.*;
import dev.creditlab.security.LocalModelEndpoint;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Bounded internal model contract. No URLs, tokens or document filenames enter the payload. */
public final class LocalModels {
  private final String endpoint;
  private final ObjectMapper json=new ObjectMapper();
  private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).followRedirects(HttpClient.Redirect.NEVER).build();
  public LocalModels(String endpoint){this.endpoint=LocalModelEndpoint.validate(endpoint);}
  public JsonNode call(String operation,Object payload) {
    if(!Set.of("embed","rerank","parse").contains(operation))throw new IllegalArgumentException("Unsupported local model operation");
    try {
      var request=HttpRequest.newBuilder(URI.create(endpoint+"/"+operation)).timeout(Duration.ofSeconds(120)).header("Content-Type","application/json")
          .POST(HttpRequest.BodyPublishers.ofByteArray(json.writeValueAsBytes(payload))).build();
      var response=client.send(request,HttpResponse.BodyHandlers.ofInputStream());
      try(var stream=response.body()) {
        if(response.statusCode()==429)throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"LOCAL_MODEL_BUSY");
        if(response.statusCode()!=200)throw unavailable();
        byte[] body=stream.readNBytes(5_000_001);if(body.length>5_000_000)throw unavailable();
        return json.readTree(body);
      }
    } catch(ResponseStatusException e){throw e;}catch(InterruptedException e){Thread.currentThread().interrupt();throw unavailable();}catch(Exception e){throw unavailable();}
  }
  public float[] embed(String text) {
    var response=call("embed",Map.of("texts",List.of(text)));
    if(!response.path("model").asText().equals("BAAI/bge-m3"))throw unavailable();
    var vector=response.path("vectors").path(0);if(!vector.isArray()||vector.size()!=1024)throw unavailable();
    float[] value=new float[1024];double norm=0;for(int i=0;i<value.length;i++){if(!vector.get(i).isNumber())throw unavailable();value[i]=(float)vector.get(i).asDouble();if(!Float.isFinite(value[i]))throw unavailable();norm+=(double)value[i]*value[i];}if(norm==0)throw unavailable();return value;
  }
  public List<Double> rerank(String question,List<String> texts) {
    if(texts.isEmpty()||texts.size()>24)throw new IllegalArgumentException("Bounded candidate list required");
    var response=call("rerank",Map.of("query",question,"texts",texts));var scores=response.path("scores");
    if(!response.path("model").asText().equals("BAAI/bge-reranker-v2-m3")||!scores.isArray()||scores.size()!=texts.size())throw unavailable();
    var out=new ArrayList<Double>();for(var score:scores){double value=score.asDouble(Double.NaN);if(!score.isNumber()||!Double.isFinite(value)||value<0||value>1)throw unavailable();out.add(value);}return List.copyOf(out);
  }
  private static ResponseStatusException unavailable(){return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"LOCAL_MODEL_UNAVAILABLE; no alternate model selected");}
}
