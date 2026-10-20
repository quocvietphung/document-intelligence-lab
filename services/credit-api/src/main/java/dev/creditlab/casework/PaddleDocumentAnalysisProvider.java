package dev.creditlab.casework;

import com.fasterxml.jackson.databind.JsonNode;
import dev.creditlab.platform.LocalModels;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Component
@ConditionalOnProperty(name="app.document-intelligence.mode",havingValue="paddleocr")
public class PaddleDocumentAnalysisProvider implements DocumentAnalysisProvider {
  private final DocumentExtractor extractor;private final LocalModels model;
  public PaddleDocumentAnalysisProvider(DocumentExtractor extractor,@Value("${app.platform.model-service:http://ai-models:8090}") String url){this.extractor=extractor;this.model=new LocalModels(url);}
  @Override public CreditCase.Document analyze(String name,String type,byte[] bytes){
    AzureDocumentIntelligenceProvider.validateUpload(bytes,4);
    return parse(name,type,model.call("parse",Map.of("base64",Base64.getEncoder().encodeToString(bytes))));
  }
  CreditCase.Document parse(String name,String type,JsonNode result){
    if(!result.path("provider").asText().equals(provider())||!result.path("model").asText().equals(modelId()))throw invalid();
    var source=result.path("pages");if(!source.isArray()||source.isEmpty()||source.size()>4)throw invalid();
    var pages=new ArrayList<CreditCase.Page>();var numbers=new HashSet<Integer>();
    for(var p:source){int number=p.path("number").asInt(-1);String text=p.path("text").asText();if(number<1||number>4||!numbers.add(number)||text.isBlank()||text.length()>12000)throw invalid();pages.add(new CreditCase.Page(number,text,provider()));}
    pages.sort(Comparator.comparingInt(CreditCase.Page::number));
    if(!result.path("tables").isArray()||result.path("tables").size()>30)throw invalid();
    var tables=new ArrayList<CreditCase.Table>();
    for(var t:result.path("tables")){
      int page=t.path("page").asInt(),rows=t.path("rows").asInt(),columns=t.path("columns").asInt();
      if(!numbers.contains(page)||rows<1||rows>500||columns<1||columns>100||!t.path("cells").isArray()||t.path("cells").size()>1500)throw invalid();
      var cells=new ArrayList<CreditCase.TableCell>();for(var c:t.path("cells")){int row=c.path("row").asInt(-1),column=c.path("column").asInt(-1);String text=c.path("text").asText();if(row<0||row>=rows||column<0||column>=columns||text.length()>500)throw invalid();cells.add(new CreditCase.TableCell(row,column,text));}
      tables.add(new CreditCase.Table(page,rows,columns,List.copyOf(cells)));
    }
    var parsed=extractor.parse(name,pages,null,provider(),modelId(),type);
    var doc=new CreditCase.Document(parsed.id(),name,parsed.type(),"review",null,parsed.fields(),List.copyOf(pages),true,provider(),modelId(),type,List.copyOf(tables));
    var fields=new LinkedHashMap<String,CreditCase.Field>();doc.fields().forEach(f->fields.put(f.label()+":"+f.page(),f));InvoiceTableFields.extract(doc).forEach(f->fields.putIfAbsent(f.label()+":"+f.page(),f));
    return new CreditCase.Document(doc.id(),name,doc.type(),"review",null,List.copyOf(fields.values()),doc.pages(),true,provider(),modelId(),type,doc.tables());
  }
  private static ResponseStatusException invalid(){return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Invalid PaddleOCR page evidence");}
  @Override public String provider(){return "paddleocr";}
  @Override public String modelId(){return "PP-StructureV3";}
}
