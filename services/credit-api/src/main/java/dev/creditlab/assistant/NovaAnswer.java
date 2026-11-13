package dev.creditlab.assistant;

import dev.langchain4j.model.chat.ChatModel;
import java.util.*;

/**
 * Nova's local free answer as schema-constrained segments.
 *
 * <p>The model can choose only a short source label (S1, S2, ...) or no source for a sentence. It never copies a source ID.
 * Java binds each label to the authorized source ID and writes the citation in square brackets. The citation validator
 * ({@link SourceCitations}) runs on the rendered text exactly as before; nothing is loosened.
 */
final class NovaAnswer {
  record Segment(String text,String source) {}
  record Answer(List<Segment> segments) {}
  static final int MAX_SEGMENTS=8;
  static final int MAX_TEXT=320;
  private static final String INVALID_SEGMENTS="INVALID_SEGMENTS";

  private NovaAnswer(){}

  static String label(int index){return "S"+(index+1);}

  /** Label to authorized source ID, in evidence order. */
  static Map<String,String> labels(List<CreditAssistantService.Source> sources){
    var labels=new LinkedHashMap<String,String>();
    for(int i=0;i<sources.size();i++)labels.put(label(i),sources.get(i).id());
    return labels;
  }

  static SchemaChat.Measured<Answer> generate(ChatModel model,List<CreditAssistantService.Source> sources,String prompt){
    var choices=new ArrayList<>(labels(sources).keySet());
    choices.add("");
    var segment=SchemaChat.object(Map.of("text",Map.of("type","string","minLength",1,"maxLength",MAX_TEXT),"source",Map.of("type","string","enum",choices)));
    var schema=SchemaChat.object(Map.of("segments",Map.of("type","array","items",segment,"maxItems",MAX_SEGMENTS)));
    return SchemaChat.callMeasured(model,DocumentReviewModel.SYSTEM,prompt,schema,Answer.class);
  }

  /**
   * Renders the segments with the authorized IDs. A blank segment carries no claim and is dropped; if nothing is left the
   * answer is "" and the validator refuses it as EMPTY_ANSWER.
   */
  static String render(Answer answer,List<CreditAssistantService.Source> sources){
    if(answer==null||answer.segments()==null)throw invalid(INVALID_SEGMENTS);
    var ids=labels(sources);
    var lines=new ArrayList<String>();
    for(var segment:answer.segments()){
      if(segment==null||segment.text()==null||segment.source()==null)throw invalid(INVALID_SEGMENTS);
      String text=segment.text().strip();
      if(!text.isEmpty())lines.add(segment.source().isEmpty()?text:text+" ["+bind(ids,segment.source())+"]");
    }
    return String.join("\n",lines);
  }

  private static String bind(Map<String,String> ids,String label){
    String id=ids.get(label);
    if(id==null)throw invalid("UNKNOWN_SOURCE_LABEL");
    return id;
  }

  private static ModelContractException invalid(String reason){
    return new ModelContractException("MODEL_CITATION_CONTRACT_FAILED",reason,"no source was guessed or substituted");
  }
}
