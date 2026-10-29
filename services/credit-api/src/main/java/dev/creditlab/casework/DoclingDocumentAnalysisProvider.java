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
        var parsed=parse(name,contentType,json.readTree(result));
        if(extension.equals(".pdf")&&parsed.structure()!=null){
          String tags="NOT_INSPECTED";
          try(var pdf=org.apache.pdfbox.Loader.loadPDF(bytes)){tags=pdf.getDocumentCatalog().getStructureTreeRoot()==null?"ABSENT":"PRESENT_NOT_VALIDATED";}
          catch(java.io.IOException ignored){/* Extraction success is not a native-tag certification. */}
          var structure=parsed.structure();
          return new CreditCase.Document(parsed.id(),parsed.name(),parsed.type(),parsed.status(),parsed.confidence(),parsed.fields(),parsed.pages(),true,parsed.analysisProvider(),parsed.modelId(),parsed.contentType(),parsed.tables(),parsed.ocrCorrections(),new CreditCase.StructureInfo(structure.origin(),tags,structure.blocks(),structure.issues()));
        }
        return parsed;
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
    var blocks=new LinkedHashMap<String,DoclingStructure.Block>();
    var fragmentsByRef=new HashMap<String,List<String>>();
    if(!source.path("texts").isArray()||source.path("texts").size()>4000) throw invalid("Docling text metadata is invalid");
    for(int blockIndex=0;blockIndex<source.path("texts").size();blockIndex++) {
      var item=source.path("texts").get(blockIndex);
      String value=item.path("text").asText("");
      if(value.isBlank()) continue;
      var provenance=item.path("prov");
      if(!provenance.isArray()||provenance.isEmpty()) throw invalid("Docling text has no page evidence");
      var fragments=pageFragments(value,provenance);var refs=new ArrayList<String>();
      for(int fragmentIndex=0;fragmentIndex<fragments.size();fragmentIndex++){
        var fragment=fragments.get(fragmentIndex);int page=fragment.page();String content=fragment.text();append(text,page,content);var ids=new ArrayList<String>();
        for(var prov:fragment.provenance()){
          var line=layoutLine(content,prov.path("bbox"),sourcePages.path(Integer.toString(page)).path("size"));
          if(line!=null)layout.computeIfAbsent(page,ignored->new ArrayList<>()).add(line);
          var id=addRegion(regions,page,content,prov.path("bbox"),sourcePages.path(Integer.toString(page)).path("size"),null,null,null);if(id!=null)ids.add(id);
        }
        String ref="#/texts/"+blockIndex+(fragments.size()>1?":span"+fragmentIndex:"");refs.add(ref);blocks.put(ref,new DoclingStructure.Block(page,content,List.copyOf(ids)));
      }
      if(fragments.size()>1)fragmentsByRef.put("#/texts/"+blockIndex,List.copyOf(refs));
    }
    var tables=new ArrayList<CreditCase.Table>();var tableIssues=new LinkedHashSet<String>();
    if(!source.path("tables").isMissingNode()&&!source.path("tables").isArray()) throw invalid("Invalid Docling tables");
    if(source.path("tables").size()>30) throw invalid("Too many Docling tables");
    for(int sourceTable=0;sourceTable<source.path("tables").size();sourceTable++) {
      var table=source.path("tables").get(sourceTable);
      var provenance=table.path("prov");
      if(!provenance.isArray()||provenance.size()!=1) throw invalid("Docling table has ambiguous page evidence");
      int page=provenance.get(0).path("page_no").asInt(-1);
      if(!text.containsKey(page)) throw invalid("Docling table page is missing");
      var data=table.path("data");
      int rows=data.path("num_rows").asInt(0),columns=data.path("num_cols").asInt(0);
      var sourceCells=data.path("table_cells");
      if(rows<1||columns<1||rows>500||columns>100||!sourceCells.isArray()||sourceCells.size()>1500)
        throw invalid("Docling table exceeds the processing limit");
      var cells=new ArrayList<CreditCase.TableCell>();var ids=new ArrayList<String>();var covered=new HashSet<String>();boolean overlap=false;
      for(var cell:sourceCells) {
        int row=cell.path("start_row_offset_idx").asInt(-1),column=cell.path("start_col_offset_idx").asInt(-1);
        String value=cell.path("text").asText("");
        if(row<0||row>=rows||column<0||column>=columns||value.length()>500) throw invalid("Invalid Docling table cell");
        int endRow=cell.path("end_row_offset_idx").asInt(row+1),endColumn=cell.path("end_col_offset_idx").asInt(column+1);
        if(endRow<=row||endRow>rows||endColumn<=column||endColumn>columns)throw invalid("Invalid Docling table span");
        for(int r=row;r<endRow;r++)for(int c=column;c<endColumn;c++)if(!covered.add(r+":"+c))overlap=true;
        cells.add(new CreditCase.TableCell(row,column,value,endRow-row,endColumn-column,
            cell.path("column_header").isBoolean()?cell.path("column_header").asBoolean():null,
            cell.path("row_header").isBoolean()?cell.path("row_header").asBoolean():null));
        append(text,page,value);
      }
      // Keep bounded source text/boxes, but never expose overlapping predictions as a valid table.
      if(overlap)tableIssues.add("TABLE_STRUCTURE_OVERLAP");
      for(int i=0;i<sourceCells.size();i++){
        var cell=sourceCells.get(i);var parsed=cells.get(i);
        var id=addRegion(regions,page,parsed.text(),cell.path("bbox"),sourcePages.path(Integer.toString(page)).path("size"),
            overlap?null:tables.size(),overlap?null:parsed.row(),overlap?null:parsed.column());if(id!=null)ids.add(id);
      }
      var tableText=cells.stream().sorted(Comparator.comparingInt(CreditCase.TableCell::row).thenComparingInt(CreditCase.TableCell::column)).map(CreditCase.TableCell::text).collect(java.util.stream.Collectors.joining("\n"));
      blocks.put("#/tables/"+sourceTable,new DoclingStructure.Block(page,tableText,List.copyOf(ids)));
      if(!overlap)tables.add(new CreditCase.Table(page,rows,columns,List.copyOf(cells)));
    }
    var structure=DoclingStructure.read(source,blocks,fragmentsByRef);
    if(!structure.order().isEmpty()){
      text.values().forEach(value->value.setLength(0));var ordered=new LinkedHashSet<>(structure.order());ordered.addAll(blocks.keySet());
      for(String ref:ordered){var block=blocks.get(ref);if(block!=null)append(text,block.page(),block.text());}
    }
    if(text.values().stream().allMatch(value->value.toString().isBlank())) throw invalid("Docling found no readable text");
    var pages=text.entrySet().stream().map(e->new CreditCase.Page(e.getKey(),e.getValue().toString().strip(),provider(),regions.getOrDefault(e.getKey(),List.of()))).toList();
    var parsed=extractor.parse(name,pages,null,provider(),modelId(),contentType);
    var document=new CreditCase.Document(parsed.id(),name,parsed.type(),"review",null,parsed.fields(),pages,true,provider(),modelId(),contentType,tables);
    var fields=new LinkedHashMap<String,CreditCase.Field>();
    document.fields().forEach(field->fields.put(field.label()+":"+field.page(),field));
    layout.forEach((page,lines)->PayrollLayoutFields.extract(page,lines).forEach(field->fields.putIfAbsent(field.label()+":"+field.page(),field)));
    InvoiceTableFields.extract(document).forEach(field->fields.putIfAbsent(field.label()+":"+field.page(),field));
    var info=structure.info();var issues=new LinkedHashSet<>(info.issues());issues.addAll(tableIssues);
    return new CreditCase.Document(document.id(),name,document.type(),"review",null,List.copyOf(fields.values()),pages,true,provider(),modelId(),contentType,tables,List.of(),new CreditCase.StructureInfo(info.origin(),info.nativeTags(),info.blocks(),List.copyOf(issues)));
  }

  private record TextFragment(int page,String text,List<JsonNode> provenance) {}
  private static List<TextFragment> pageFragments(String text,JsonNode provenance){
    var observed=new ArrayList<JsonNode>();provenance.forEach(observed::add);var pages=new HashSet<Integer>();observed.forEach(p->pages.add(p.path("page_no").asInt(-1)));
    if(pages.size()==1)return List.of(new TextFragment(pages.iterator().next(),text,List.copyOf(observed)));
    // Docling offsets count Unicode code points, not Java UTF-16 code units.
    int[] points=text.codePoints().toArray();var ordered=new ArrayList<>(observed);ordered.sort(Comparator.comparingInt(p->p.path("charspan").path(0).asInt(-1)));
    var result=new ArrayList<TextFragment>();int end=0;
    for(var prov:ordered){var span=prov.path("charspan");
      if(!span.isArray()||span.size()!=2||!span.get(0).isIntegralNumber()||!span.get(1).isIntegralNumber())throw invalid("Cross-page text requires exact character spans");
      int start=span.get(0).asInt(-1),next=span.get(1).asInt(-1);
      if(start<end||next<=start||next>points.length)throw invalid("Invalid or overlapping cross-page text spans");
      for(int i=end;i<start;i++)if(!Character.isWhitespace(points[i])&&!Character.isSpaceChar(points[i]))throw invalid("Cross-page spans omit source text");
      result.add(new TextFragment(prov.path("page_no").asInt(-1),new String(points,start,next-start),List.of(prov)));end=next;
    }
    for(int i=end;i<points.length;i++)if(!Character.isWhitespace(points[i])&&!Character.isSpaceChar(points[i]))throw invalid("Cross-page spans omit source text");
    return result;
  }
  private static void append(Map<Integer,StringBuilder> pages,int page,String value) {
    var text=pages.get(page);
    if(text==null) throw invalid("Docling text page is missing");
    if(text.length()+value.length()+1>12_000) throw invalid("Page text exceeds the processing limit");
    text.append(value).append('\n');
  }

  private static String addRegion(Map<Integer,List<CreditCase.Region>> regions,int page,String text,JsonNode box,JsonNode size,Integer table,Integer row,Integer column) {
    var line=layoutLine(text,box,size);if(line==null||text.isBlank())return null;
    var entries=regions.computeIfAbsent(page,ignored->new ArrayList<>());
    entries.add(new CreditCase.Region("r"+entries.size(),text,line.left(),line.top(),line.right(),line.bottom(),
        size.path("width").asDouble(),size.path("height").asDouble(),table,row,column));
    return entries.getLast().id();
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
