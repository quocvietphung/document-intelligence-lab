package dev.creditlab.casework;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.Semaphore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Internal, byte-only Docling bridge. Never forwards app credentials or fetches document URLs. */
@Component
@ConditionalOnProperty(name="app.document-intelligence.mode",havingValue="docling")
public class DoclingDocumentAnalysisProvider implements DocumentAnalysisProvider {
  private static final int MAX_RESPONSE=3_000_000;
  private final ObjectMapper json=new ObjectMapper();
  private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
      .version(HttpClient.Version.HTTP_1_1)
      .followRedirects(HttpClient.Redirect.NEVER).build();
  private final DocumentExtractor extractor;
  private final URI endpoint;
  private final Semaphore slot=new Semaphore(1);

  public DoclingDocumentAnalysisProvider(DocumentExtractor extractor,
      @Value("${app.document-intelligence.docling-url:http://docling:5001}") String url) {
    this.extractor=extractor;
    URI base=URI.create(url);
    if(!"http".equals(base.getScheme())||!Set.of("docling","localhost","127.0.0.1").contains(base.getHost())
        ||base.getUserInfo()!=null||base.getQuery()!=null||base.getFragment()!=null
        ||!(base.getPath().isEmpty()||base.getPath().equals("/")))
      throw new IllegalArgumentException("Docling must use the internal docling service or localhost root URL");
    endpoint=base.resolve("/v1/convert/source");
  }

  @Override public CreditCase.Document analyze(String name,String contentType,byte[] bytes) {
    // This is a pure byte/format check; it makes no Azure request.
    AzureDocumentIntelligenceProvider.validateUpload(bytes,4);
    if(!slot.tryAcquire()) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Document analysis busy; retry later");
    try {
      String extension=bytes[0]=='%'?".pdf":bytes[0]==(byte)0x89?".png":".jpg";
      var payload=Map.of("sources",List.of(Map.of("kind","file","filename","document"+extension,"base64_string",Base64.getEncoder().encodeToString(bytes))),
          "target",Map.of("kind","inbody"),
          "options",Map.of("to_formats",List.of("json"),"image_export_mode","placeholder","include_images",false,
              "do_ocr",true,"do_table_structure",true,"table_mode","accurate","document_timeout",110));
      var request=HttpRequest.newBuilder(endpoint).timeout(Duration.ofSeconds(120)).header("Content-Type","application/json")
          .POST(HttpRequest.BodyPublishers.ofByteArray(json.writeValueAsBytes(payload))).build();
      var response=client.send(request,HttpResponse.BodyHandlers.ofInputStream());
      try(var stream=response.body()) {
        if(response.statusCode()==429) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Docling is busy; retry later");
        if(response.statusCode()==400||response.statusCode()==422) throw invalid("Docling rejected the document");
        if(response.statusCode()!=200) throw unavailable();
        byte[] result=stream.readNBytes(MAX_RESPONSE+1);
        if(result.length>MAX_RESPONSE) throw invalid("Docling output exceeds the processing limit");
        return parse(name,contentType,json.readTree(result));
      }
    } catch(ResponseStatusException error) { throw error; }
      catch(InterruptedException error) { Thread.currentThread().interrupt();throw unavailable(); }
      catch(Exception error) { throw unavailable(); }
      finally { slot.release(); }
  }

  CreditCase.Document parse(String name,String contentType,JsonNode response) {
    if(!"success".equals(response.path("status").asText())) throw invalid("Docling did not complete the whole document");
    var source=response.path("document").path("json_content");
    var sourcePages=source.path("pages");
    if(!sourcePages.isObject()||sourcePages.isEmpty()||sourcePages.size()>4) throw invalid("Docling page metadata is missing or out of bounds");
    var text=new TreeMap<Integer,StringBuilder>();
    sourcePages.fields().forEachRemaining(entry->{
      int page=entry.getValue().path("page_no").asInt(-1);
      if(page<1||page>4||text.putIfAbsent(page,new StringBuilder())!=null) throw invalid("Invalid Docling page number");
    });
    var layout=new HashMap<Integer,List<PayrollLayoutFields.Line>>();
    var regions=new HashMap<Integer,List<CreditCase.Region>>();
    if(!source.path("texts").isArray()||source.path("texts").size()>4000) throw invalid("Docling text metadata is invalid");
    for(var item:source.path("texts")) {
      String value=item.path("text").asText("");
      if(value.isBlank()) continue;
      var provenance=item.path("prov");
      if(!provenance.isArray()||provenance.isEmpty()) throw invalid("Docling text has no page evidence");
      // A block spanning multiple pages cannot safely be assigned wholesale to its first page.
      var pageNumbers=new HashSet<Integer>();
      provenance.forEach(prov->pageNumbers.add(prov.path("page_no").asInt(-1)));
      if(pageNumbers.size()!=1) throw invalid("Docling text spans pages without unambiguous page evidence");
      int page=pageNumbers.iterator().next();
      append(text,page,value);
      for(var prov:provenance) {
        var line=layoutLine(value,prov.path("bbox"),sourcePages.path(Integer.toString(page)).path("size"));
        if(line!=null) layout.computeIfAbsent(page,ignored->new ArrayList<>()).add(line);
        addRegion(regions,page,value,prov.path("bbox"),sourcePages.path(Integer.toString(page)).path("size"),null,null,null);
      }
    }
    var tables=new ArrayList<CreditCase.Table>();
    if(!source.path("tables").isMissingNode()&&!source.path("tables").isArray()) throw invalid("Invalid Docling tables");
    if(source.path("tables").size()>30) throw invalid("Too many Docling tables");
    for(var table:source.path("tables")) {
      var provenance=table.path("prov");
      if(!provenance.isArray()||provenance.size()!=1) throw invalid("Docling table has ambiguous page evidence");
      int page=provenance.get(0).path("page_no").asInt(-1);
      if(!text.containsKey(page)) throw invalid("Docling table page is missing");
      var data=table.path("data");
      int rows=data.path("num_rows").asInt(0),columns=data.path("num_cols").asInt(0);
      var sourceCells=data.path("table_cells");
      if(rows<1||columns<1||rows>500||columns>100||!sourceCells.isArray()||sourceCells.size()>1500)
        throw invalid("Docling table exceeds the processing limit");
      var cells=new ArrayList<CreditCase.TableCell>();
      for(var cell:sourceCells) {
        int row=cell.path("start_row_offset_idx").asInt(-1),column=cell.path("start_col_offset_idx").asInt(-1);
        String value=cell.path("text").asText("");
        if(row<0||row>=rows||column<0||column>=columns||value.length()>500) throw invalid("Invalid Docling table cell");
        cells.add(new CreditCase.TableCell(row,column,value));
        addRegion(regions,page,value,cell.path("bbox"),sourcePages.path(Integer.toString(page)).path("size"),tables.size(),row,column);
        append(text,page,value);
      }
      tables.add(new CreditCase.Table(page,rows,columns,List.copyOf(cells)));
    }
    if(text.values().stream().allMatch(value->value.toString().isBlank())) throw invalid("Docling found no readable text");
    var pages=text.entrySet().stream().map(e->new CreditCase.Page(e.getKey(),e.getValue().toString().strip(),provider(),regions.getOrDefault(e.getKey(),List.of()))).toList();
    var parsed=extractor.parse(name,pages,null,provider(),modelId(),contentType);
    var document=new CreditCase.Document(parsed.id(),name,parsed.type(),"review",null,parsed.fields(),pages,true,provider(),modelId(),contentType,tables);
    var fields=new LinkedHashMap<String,CreditCase.Field>();
    document.fields().forEach(field->fields.put(field.label()+":"+field.page(),field));
    layout.forEach((page,lines)->PayrollLayoutFields.extract(page,lines).forEach(field->fields.putIfAbsent(field.label()+":"+field.page(),field)));
    InvoiceTableFields.extract(document).forEach(field->fields.putIfAbsent(field.label()+":"+field.page(),field));
    return new CreditCase.Document(document.id(),name,document.type(),"review",null,List.copyOf(fields.values()),pages,true,provider(),modelId(),contentType,tables);
  }

  private static void append(Map<Integer,StringBuilder> pages,int page,String value) {
    var text=pages.get(page);
    if(text==null) throw invalid("Docling text page is missing");
    if(text.length()+value.length()+1>12_000) throw invalid("Page text exceeds the processing limit");
    text.append(value).append('\n');
  }

  private static void addRegion(Map<Integer,List<CreditCase.Region>> regions,int page,String text,JsonNode box,JsonNode size,Integer table,Integer row,Integer column) {
    var line=layoutLine(text,box,size);if(line==null||text.isBlank())return;
    var entries=regions.computeIfAbsent(page,ignored->new ArrayList<>());
    entries.add(new CreditCase.Region("r"+entries.size(),text,line.left(),line.top(),line.right(),line.bottom(),
        size.path("width").asDouble(),size.path("height").asDouble(),table,row,column));
  }

  private static PayrollLayoutFields.Line layoutLine(String text,JsonNode box,JsonNode size) {
    double width=size.path("width").asDouble(0),height=size.path("height").asDouble(0);
    if(width<=0||height<=0||!box.path("l").isNumber()||!box.path("t").isNumber()
        ||!box.path("r").isNumber()||!box.path("b").isNumber())return null;
    double top=box.path("t").asDouble(),bottom=box.path("b").asDouble();
    String origin=box.path("coord_origin").asText();
    if(origin.equals("BOTTOMLEFT")) {double oldTop=top;top=height-oldTop;bottom=height-bottom;}
    else if(!origin.equals("TOPLEFT")) return null;
    var line=new PayrollLayoutFields.Line(text,box.path("l").asDouble()/width,top/height,box.path("r").asDouble()/width,bottom/height);
    return line.valid()?line:null;
  }

  private static ResponseStatusException invalid(String message) {return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,message);}
  private static ResponseStatusException unavailable() {return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"DOCLING_SERVICE_UNAVAILABLE");}
  @Override public String provider(){return "docling";}
  @Override public String modelId(){return "docling-layout-tableformer";}
}
