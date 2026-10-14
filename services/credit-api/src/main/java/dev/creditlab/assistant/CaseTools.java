package dev.creditlab.assistant;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.CreditCase;
import dev.langchain4j.agent.tool.Tool;
import java.util.Map;

/** Read-only tools bound to one already-authorized case. The model cannot choose another tenant or case. */
public class CaseTools {
  private final CreditCase item;
  private final ObjectMapper mapper;

  CaseTools(CreditCase item,ObjectMapper mapper) { this.item=item; this.mapper=mapper; }

  @Tool("Read the selected case summary, missing documents and validation issues")
  public String caseSummary() {
    return json(Map.of("sourceId","case-summary","caseId",item.id(),"purpose",item.purpose(),"status",item.status(),
        "completeness",item.completeness(),"missingDocuments",item.missingDocuments(),"validationIssues",item.validationIssues()));
  }

  @Tool("Read evidence-backed fields and page references from documents in the selected case")
  public String documentEvidence() {
    return json(item.documents().stream().filter(document->document.originalAvailable()&&document.pages().stream().noneMatch(p->dev.creditlab.platform.EvidenceGuard.suspicious(p.text()))).map(document -> Map.of(
        "sourceId",document.id(),"name",document.name(),"type",document.type(),"status",document.status(),
        "provider",String.valueOf(document.analysisProvider()),"modelId",String.valueOf(document.modelId()),
        "fields",document.fields(),"pageEvidence",document.pages().stream().limit(4).map(page->Map.of(
            "sourceId",document.id()+":p"+page.number(),"page",page.number(),"method",page.method(),
            "text",bounded(page.text(),1200))).toList())).toList());
  }

  private String bounded(String value,int limit) { return value.length()<=limit?value:value.substring(0,limit); }

  private String json(Object value) {
    try { return mapper.writeValueAsString(value); }
    catch (JsonProcessingException error) { throw new IllegalStateException("Tool result could not be encoded"); }
  }
}
