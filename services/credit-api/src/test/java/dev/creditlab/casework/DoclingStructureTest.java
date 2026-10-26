package dev.creditlab.casework;
import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

class DoclingStructureTest {
  private final ObjectMapper json=new ObjectMapper();
  private com.fasterxml.jackson.databind.JsonNode fixture() throws Exception {
    try(var stream=getClass().getResourceAsStream("/shared-contracts/structure-cases.json")){return json.readTree(stream);}
  }
  @Test void javaUsesTheSameReadingOrderAndHeaderContractAsPython() throws Exception {
    var data=fixture();var response=json.createObjectNode().put("status","success");response.putObject("document").set("json_content",data.path("input"));
    var provider=new DoclingDocumentAnalysisProvider(new DocumentExtractor(),"http://docling:5001");
    var doc=provider.parse("structure.pdf","application/pdf",response);
    var blocks=new java.util.LinkedHashMap<String,DoclingStructure.Block>();
    for(var ref:data.path("expectedOrder"))blocks.put(ref.asText(),new DoclingStructure.Block(1,"text",java.util.List.of()));
    assertThat(DoclingStructure.read(data.path("input"),blocks).order()).containsExactly("#/texts/1","#/texts/2","#/tables/0","#/texts/0");
    assertThat(doc.pages().getFirst().text().indexOf("Left column")).isLessThan(doc.pages().getFirst().text().indexOf("8,500"));
    assertThat(doc.pages().getFirst().text().indexOf("8,500")).isLessThan(doc.pages().getFirst().text().indexOf("Right column"));
    assertThat(doc.tables().getFirst().cells().getFirst().columnHeader()).isTrue();
    assertThat(doc.tables().getFirst().cells().get(2).rowHeader()).isTrue();
    assertThat(doc.structure().issues()).isEmpty();
    assertThat(doc.structure().nativeTags()).isEqualTo("NOT_INSPECTED");
  }
  @Test void invalidReferenceGraphsNeverBecomeCertifiedReadingOrder() throws Exception {
    var source=(ObjectNode)fixture().path("input");
    ((ObjectNode)source.path("groups").get(0)).putArray("children").addObject().put("$ref","#/groups/0");
    var result=DoclingStructure.read(source,java.util.Map.of());
    assertThat(result.order()).isEmpty();assertThat(result.info().issues()).contains("READING_ORDER_INVALID");
  }
}
