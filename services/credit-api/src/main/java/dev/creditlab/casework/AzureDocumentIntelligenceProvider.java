package dev.creditlab.casework;

import com.azure.ai.documentintelligence.DocumentIntelligenceClient;
import com.azure.ai.documentintelligence.DocumentIntelligenceClientBuilder;
import com.azure.ai.documentintelligence.models.AnalyzeDocumentOptions;
import com.azure.ai.documentintelligence.models.AnalyzeResult;
import com.azure.ai.documentintelligence.models.DocumentAnalysisFeature;
import com.azure.ai.documentintelligence.models.DocumentField;
import com.azure.core.exception.HttpResponseException;
import com.azure.core.exception.ClientAuthenticationException;
import com.azure.identity.CredentialUnavailableException;
import com.azure.core.util.BinaryData;
import com.azure.identity.DefaultAzureCredentialBuilder;
import com.azure.identity.AzureCliCredentialBuilder;
import com.azure.core.credential.TokenCredential;
import dev.creditlab.security.AzureTokenFileCredential;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.Semaphore;
import java.io.ByteArrayInputStream;
import javax.imageio.ImageIO;
import org.apache.pdfbox.Loader;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Keyless Azure Document Intelligence provider. Raw text is never written to logs. */
@Component
@ConditionalOnExpression("'${app.document-intelligence.endpoint:}' != ''")
public class AzureDocumentIntelligenceProvider implements DocumentAnalysisProvider {
  private final DocumentIntelligenceClient client;
  private final DocumentExtractor extractor;
  private final String modelId;
  private final int maxPages;
  private final Semaphore slots = new Semaphore(2);

  public AzureDocumentIntelligenceProvider(DocumentExtractor extractor,
      @Value("${app.document-intelligence.endpoint}") String endpoint,
      @Value("${app.document-intelligence.model-id:prebuilt-layout}") String modelId,
      @Value("${app.document-intelligence.max-pages:4}") int maxPages,
      @Value("${app.document-intelligence.credential:default}") String credentialType,
      @Value("${app.document-intelligence.token-file:}") String tokenFile) {
    this.extractor = extractor;
    this.modelId = modelId;
    if(maxPages<1||maxPages>4) throw new IllegalArgumentException("Document page limit must be between 1 and 4");
    this.maxPages = maxPages;
    TokenCredential credential=switch(credentialType) {
      case "azure-cli" -> new AzureCliCredentialBuilder().processTimeout(Duration.ofSeconds(20)).build();
      case "token-file" -> new AzureTokenFileCredential(tokenFile);
      case "default" -> new DefaultAzureCredentialBuilder().credentialProcessTimeout(Duration.ofSeconds(20)).build();
      default -> throw new IllegalArgumentException("Document credential must be default, azure-cli or token-file");
    };
    this.client = new DocumentIntelligenceClientBuilder()
        .endpoint(endpoint)
        .credential(credential)
        .buildClient();
  }

  @Override public CreditCase.Document analyze(String name, String contentType, byte[] bytes) {
    validateUpload(bytes,maxPages);
    if(!slots.tryAcquire()) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Document analysis busy; retry later");
    try {
      var options=new AnalyzeDocumentOptions(BinaryData.fromBytes(bytes)).setPages(List.of("1-"+maxPages));
      if(modelId.equals("prebuilt-layout")) {
        options.setDocumentAnalysisFeatures(DocumentAnalysisFeature.KEY_VALUE_PAIRS);
      }
      AnalyzeResult result = client.beginAnalyzeDocument(modelId,options).getFinalResult();
      String content = result.getContent() == null ? "" : result.getContent();
      var pages = new ArrayList<CreditCase.Page>();
      var confidences = new ArrayList<Double>();
      if (result.getPages() != null) {
        if(result.getPages().size()>maxPages) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Maximum "+maxPages+" pages");
        result.getPages().forEach(page -> {
          var text = new StringBuilder();
          if (page.getLines() != null) page.getLines().forEach(line -> {
            if (line.getContent() != null && !line.getContent().isBlank()) text.append(line.getContent()).append('\n');
          });
          if (page.getWords() != null) page.getWords().forEach(word -> confidences.add(word.getConfidence()));
          pages.add(new CreditCase.Page(page.getPageNumber(), bounded(text.toString().strip()), "azure-document-intelligence"));
        });
      }
      if (pages.isEmpty() && !content.isBlank()) pages.add(new CreditCase.Page(1, bounded(content), "azure-document-intelligence"));
      if (pages.isEmpty() || pages.stream().allMatch(page -> page.text().isBlank())) {
        throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Azure found no readable text");
      }
      Integer confidence = confidences.isEmpty() ? null : (int)Math.round(
          100 * confidences.stream().mapToDouble(Double::doubleValue).average().orElse(0));
      String resolvedModelId=result.getModelId()==null||result.getModelId().isBlank()?modelId:result.getModelId();
      var document=extractor.parse(name,List.copyOf(pages),confidence,provider(),resolvedModelId,contentType);
      var tables=new ArrayList<CreditCase.Table>();
      if(result.getTables()!=null) for(var table:result.getTables()) {
        if(table.getCells()==null||table.getCells().size()>1500)continue;
        var cells=table.getCells().stream().map(c->new CreditCase.TableCell(c.getRowIndex(),c.getColumnIndex(),c.getContent()==null?"":boundedEvidence(c.getContent()))).toList();
        tables.add(new CreditCase.Table(page(table.getBoundingRegions()),table.getRowCount(),table.getColumnCount(),cells));
      }
      document=new CreditCase.Document(document.id(),document.name(),document.type(),document.status(),document.confidence(),document.fields(),document.pages(),true,document.analysisProvider(),document.modelId(),document.contentType(),tables);
      var structuredFields=structuredFields(result);
      structuredFields.addAll(layoutFields(result));
      structuredFields.addAll(InvoiceTableFields.extract(document));
      if(structuredFields.isEmpty()) return document;
      var merged=new LinkedHashMap<String,CreditCase.Field>();
      document.fields().forEach(field->merged.put(field.label()+":"+field.page(),field));
      structuredFields.forEach(field->merged.putIfAbsent(field.label()+":"+field.page(),field));
      return new CreditCase.Document(document.id(),document.name(),azureDocumentType(result,document.type()),
          document.status(),document.confidence(),List.copyOf(merged.values()),document.pages(),
          document.originalAvailable(),document.analysisProvider(),document.modelId(),document.contentType(),document.tables());
    } catch (ResponseStatusException error) {
      throw error;
    } catch (HttpResponseException error) {
      int status=error.getResponse()==null?500:error.getResponse().getStatusCode();
      if(status==400||status==422) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
          "Azure rejected the document format or content");
      if(status==429) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
          "Azure Document Intelligence quota is busy; retry later");
      if(status==401||status==403) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"AZURE_ACCESS_DENIED");
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
          "AZURE_SERVICE_UNAVAILABLE");
    } catch (RuntimeException error) {
      throw unavailable(error);
    } finally { slots.release(); }
  }

  static ResponseStatusException unavailable(RuntimeException error) {
    Throwable cause=error;
    for(int i=0;cause!=null&&i<8;i++,cause=cause.getCause())
      if(cause instanceof CredentialUnavailableException||cause instanceof ClientAuthenticationException)
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"AZURE_AUTH_UNAVAILABLE");
    return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"AZURE_SERVICE_UNAVAILABLE");
  }

  private String bounded(String value) {
    if(value.length()>12_000) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Page text exceeds safe processing limit");
    return value;
  }

  /** Reject over-limit PDFs before sending them to Azure, avoiding silent F0 truncation. */
  static void validateUpload(byte[] bytes,int maxPages) {
    if(bytes.length==0||bytes.length>3_000_000) throw invalid("Empty file or file exceeds 3 MB");
    try {
      if(bytes.length>=4&&bytes[0]=='%'&&bytes[1]=='P'&&bytes[2]=='D'&&bytes[3]=='F') {
        try(var pdf=Loader.loadPDF(bytes)) {
          if(pdf.isEncrypted()||pdf.getNumberOfPages()<1||pdf.getNumberOfPages()>maxPages)
            throw invalid("Use unencrypted PDF, maximum "+maxPages+" pages for this Azure resource");
        }
      } else {
        try(var input=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
          if(input==null) throw invalid("Azure analysis accepts PDF, PNG or JPEG");
          var readers=ImageIO.getImageReaders(input);
          if(!readers.hasNext()) throw invalid("Azure analysis accepts PDF, PNG or JPEG");
          var reader=readers.next();
          try {
            reader.setInput(input);
            String format=reader.getFormatName();
            if(!format.equalsIgnoreCase("png")&&!format.equalsIgnoreCase("jpeg"))
              throw invalid("Azure analysis accepts PDF, PNG or JPEG");
            if((long)reader.getWidth(0)*reader.getHeight(0)>6_000_000)
              throw invalid("Image exceeds 6 megapixels");
          } finally { reader.dispose(); }
        }
      }
    } catch(ResponseStatusException error) { throw error; }
      catch(Exception error) { throw invalid("Document could not be read safely"); }
  }

  private static ResponseStatusException invalid(String message) {
    return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,message);
  }

  private List<CreditCase.Field> structuredFields(AnalyzeResult result) {
    var fields=new ArrayList<CreditCase.Field>();
    if(result.getKeyValuePairs()!=null) result.getKeyValuePairs().forEach(pair->{
      if(pair.getKey()==null||pair.getValue()==null) return;
      addField(fields,pair.getKey().getContent(),pair.getValue().getContent(),pair.getConfidence(),
          page(pair.getValue().getBoundingRegions()),pair.getKey().getContent()+": "+pair.getValue().getContent());
    });
    if(result.getDocuments()!=null) result.getDocuments().forEach(document->{
      if(document.getFields()==null) return;
      document.getFields().forEach((label,field)->addField(fields,label,fieldValue(field),field.getConfidence(),
          page(field.getBoundingRegions()),label+": "+fieldValue(field)));
    });
    return new ArrayList<>(fields.stream().limit(20).toList());
  }

  private List<CreditCase.Field> layoutFields(AnalyzeResult result) {
    var fields=new ArrayList<CreditCase.Field>();
    if(result.getPages()==null) return fields;
    for(var page:result.getPages()) {
      if(page.getLines()==null||page.getWidth()==null||page.getHeight()==null||page.getWidth()<=0||page.getHeight()<=0) continue;
      var lines=new ArrayList<PayrollLayoutFields.Line>();
      for(var line:page.getLines()) {
        var points=line.getPolygon();
        if(points==null||points.size()<8||points.size()%2!=0||points.stream().anyMatch(v->v==null||!Double.isFinite(v))) continue;
        double left=Double.POSITIVE_INFINITY,top=left,right=Double.NEGATIVE_INFINITY,bottom=right;
        for(int i=0;i<points.size();i+=2) {left=Math.min(left,points.get(i));right=Math.max(right,points.get(i));top=Math.min(top,points.get(i+1));bottom=Math.max(bottom,points.get(i+1));}
        lines.add(new PayrollLayoutFields.Line(line.getContent(),left/page.getWidth(),top/page.getHeight(),right/page.getWidth(),bottom/page.getHeight()));
      }
      fields.addAll(PayrollLayoutFields.extract(page.getPageNumber(),lines));
    }
    return fields;
  }

  private void addField(List<CreditCase.Field> fields,String rawLabel,String value,Double confidence,int page,String evidence) {
    if(rawLabel==null||value==null||value.isBlank()) return;
    DocumentExtractor.canonicalFieldLabel(rawLabel).ifPresent(label->fields.add(new CreditCase.Field(label,
        value.strip(),confidence==null?null:(int)Math.round(confidence*100),page,boundedEvidence(evidence))));
  }

  private String fieldValue(DocumentField field) {
    if(field==null) return "";
    if(field.getContent()!=null&&!field.getContent().isBlank()) return field.getContent();
    if(field.getValueString()!=null) return field.getValueString();
    if(field.getValueNumber()!=null) return field.getValueNumber().toString();
    if(field.getValueInteger()!=null) return field.getValueInteger().toString();
    if(field.getValueDate()!=null) return field.getValueDate().toString();
    return "";
  }

  private int page(List<com.azure.ai.documentintelligence.models.BoundingRegion> regions) {
    return regions==null||regions.isEmpty()?1:regions.getFirst().getPageNumber();
  }

  private String azureDocumentType(AnalyzeResult result,String fallback) {
    if(result.getDocuments()==null) return fallback;
    return result.getDocuments().stream().map(document->document.getDocumentType())
        .filter(java.util.Objects::nonNull).map(value->value.toLowerCase(Locale.ROOT))
        .map(value->value.contains("income")||value.contains("paystub")?"income":
            value.contains("statement")?"statement":value.contains("disclosure")?"disclosure":
            value.contains("valuation")||value.contains("appraisal")?"valuation":"unknown")
        .filter(value->!value.equals("unknown")).findFirst().orElse(fallback);
  }

  private String boundedEvidence(String value) { return value.length()<=500?value:value.substring(0,500); }

  @Override public String provider() { return "azure-document-intelligence"; }
  @Override public String modelId() { return modelId; }
  public int maxPages() { return maxPages; }
}
