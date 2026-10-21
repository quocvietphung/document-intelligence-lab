package dev.creditlab.assistant;

import com.fasterxml.jackson.databind.*;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.request.*;
import dev.langchain4j.model.chat.request.json.*;
import java.util.*;

/** Explicit provider grammar + strict server decoding. No retries, tools or alternate provider. */
final class SchemaChat {
  private static final ObjectMapper JSON=new ObjectMapper().enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
  private SchemaChat(){}
  static Map<String,Object> text(int max){return Map.of("type","string","maxLength",max);}
  static Map<String,Object> object(Map<String,Object> properties){return Map.of("type","object","properties",properties,"required",properties.keySet().stream().sorted().toList(),"additionalProperties",false);}
  static <T>T call(ChatModel model,String system,String prompt,Map<String,Object> schema,Class<T> type){
    try{
      var format=ResponseFormat.builder().type(ResponseFormatType.JSON).jsonSchema(JsonSchema.builder().name("DocumentEvidence").rootElement(JsonRawSchema.from(JSON.writeValueAsString(schema))).build()).build();
      var response=model.chat(ChatRequest.builder().responseFormat(format).messages(SystemMessage.from(system),UserMessage.from(prompt)).build());
      if(response.finishReason()!=dev.langchain4j.model.output.FinishReason.STOP)throw new IllegalStateException("INCOMPLETE_STRUCTURED_OUTPUT");
      var value=JSON.readTree(response.aiMessage().text());validate(value,schema);
      return JSON.treeToValue(value,type);
    }catch(RuntimeException e){throw e;}catch(Exception e){throw new IllegalStateException("INVALID_STRUCTURED_OUTPUT",e);}
  }
  @SuppressWarnings("unchecked")
  static void validate(JsonNode value,Map<String,Object> schema){
    String kind=schema.get("type").toString();boolean valid=switch(kind){
      case "object"->value!=null&&value.isObject();case "array"->value!=null&&value.isArray();case "string"->value!=null&&value.isTextual();default->false;};
    if(!valid)throw new IllegalArgumentException("INVALID_STRUCTURED_OUTPUT");
    if(kind.equals("string")){
      if(schema.get("maxLength") instanceof Number max&&value.asText().codePointCount(0,value.asText().length())>max.intValue())throw new IllegalArgumentException("STRUCTURED_STRING_TOO_LONG");
      if(schema.get("enum") instanceof List<?> allowed&&!allowed.contains(value.asText()))throw new IllegalArgumentException("UNKNOWN_STRUCTURED_SOURCE_OR_CATEGORY");
    }else if(kind.equals("array")){
      if(schema.get("maxItems") instanceof Number max&&value.size()>max.intValue())throw new IllegalArgumentException("TOO_MANY_STRUCTURED_ITEMS");
      for(var item:value)validate(item,(Map<String,Object>)schema.get("items"));
    }else{
      var properties=(Map<String,Object>)schema.get("properties");var keys=new HashSet<String>();value.fieldNames().forEachRemaining(keys::add);
      if(!keys.equals(properties.keySet()))throw new IllegalArgumentException("MISSING_OR_EXTRA_STRUCTURED_PROPERTY");
      for(var property:properties.entrySet())validate(value.get(property.getKey()),(Map<String,Object>)property.getValue());
    }
  }
}
