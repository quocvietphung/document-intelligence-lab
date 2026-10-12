package dev.creditlab.assistant;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.agent.tool.Tool;
import java.util.Set;

/** Read-only product metadata, shared with the frontend. No arbitrary URL or UI execution. */
final class AppGuideTools {
  private static final JsonNode FEATURES=load();
  private final String locale;
  AppGuideTools(String locale){this.locale=Set.of("en","de","vi").contains(locale)?locale:"en";}
  private static JsonNode load(){try(var stream=AppGuideTools.class.getResourceAsStream("/nova-features.json")){if(stream==null)throw new IllegalStateException("Missing guide");return new ObjectMapper().readTree(stream);}catch(java.io.IOException e){throw new IllegalStateException("Invalid guide",e);}}
  @Tool("Read the actual app sections and instructions. Returns fixed relative navigation links, not case data. Cannot navigate, upload, edit or execute payments.")
  public String appFeatures(){var result=new StringBuilder();for(var f:FEATURES){var t=f.get(locale);result.append(f.get("id").asText()).append(": ").append(t.get("title").asText()).append(" — ").append(t.get("description").asText()).append(". Link: /").append(locale).append("#").append(f.get("id").asText()).append("\n");}return result.toString();}
  @Tool("Read steps for a known app section ID: overview, studio, documents, pipeline, controls, banking, evaluation, operations, audit. Unknown sections are not invented.")
  public String appFeature(String section){for(var f:FEATURES)if(f.get("id").asText().equals(section))return f.get(locale).toString()+"; link=/"+locale+"#"+section;return "Unknown section. Use appFeatures to list actual sections.";}
}
