package dev.creditlab.casework;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.io.ByteArrayOutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;

class DoclingDocumentAnalysisProviderTest {
  private final ObjectMapper json=new ObjectMapper();
  private DoclingDocumentAnalysisProvider provider(){return new DoclingDocumentAnalysisProvider(new DocumentExtractor(),"http://localhost:5001");}
  private static final String INVOICE="""
      {"status":"success","document":{"json_content":{
        "pages":{"1":{"page_no":1,"size":{"width":600,"height":800}}},
        "texts":[{"text":"Invoice number: 51109301","prov":[{"page_no":1}]}],
        "tables":[{"prov":[{"page_no":1}],"data":{"num_rows":2,"num_cols":2,"table_cells":[
          {"start_row_offset_idx":0,"start_col_offset_idx":1,"text":"Gross worth"},
          {"start_row_offset_idx":1,"start_col_offset_idx":0,"text":"Total"},
          {"start_row_offset_idx":1,"start_col_offset_idx":1,"text":"INR 1,844,673.60"}
        ]}}]
      }}}
      """;
  @Test void preservesPageTablesCurrencyAndHonestConfidence() throws Exception {
    var result=provider().parse("invoice.pdf","application/pdf",json.readTree(INVOICE));
    assertThat(result.analysisProvider()).isEqualTo("docling");
    assertThat(result.modelId()).isEqualTo("docling-layout-tableformer");
    assertThat(result.status()).isEqualTo("review");assertThat(result.confidence()).isNull();
    assertThat(result.pages()).hasSize(1);assertThat(result.pages().getFirst().text()).contains("INR 1,844,673.60");
    assertThat(result.tables()).hasSize(1);
    assertThat(result.fields()).anySatisfy(field->{assertThat(field.label()).isEqualTo("invoiceTotal");
      assertThat(field.value()).isEqualTo("INR 1,844,673.60");assertThat(field.page()).isEqualTo(1);assertThat(field.confidence()).isNull();});
  }
  @Test void reusesLayoutRulesForDatevWithoutInventingConfidence() throws Exception {
    var source=json.readTree("""
      {"status":"success","document":{"json_content":{
        "pages":{"1":{"page_no":1,"size":{"width":600,"height":800}}},
        "texts":[
          {"text":"Entgeltabrechnung","prov":[{"page_no":1}]},
          {"text":"Netto-Verdienst","prov":[{"page_no":1,"bbox":{"l":300,"t":400,"r":360,"b":390,"coord_origin":"BOTTOMLEFT"}}]},
          {"text":"2.967,11 EUR","prov":[{"page_no":1,"bbox":{"l":300,"t":380,"r":360,"b":370,"coord_origin":"BOTTOMLEFT"}}]}
        ],"tables":[]}}}
      """);
    var document=provider().parse("payroll.pdf","application/pdf",source);
    assertThat(document.type()).isEqualTo("income");
    assertThat(document.fields()).anySatisfy(field->{assertThat(field.label()).isEqualTo("netIncome");assertThat(field.value()).isEqualTo("2.967,11 EUR");});
  }
  @Test void refusesPartialResultsMissingPagesAndOutOfRangeCells() throws Exception {
    for(String input:new String[]{INVOICE.replace("\"success\"","\"partial_success\""),
        INVOICE.replace("\"page_no\":1","\"page_no\":5"),
        INVOICE.replace("\"start_col_offset_idx\":1","\"start_col_offset_idx\":99"),
        INVOICE.replace("\"prov\":[{\"page_no\":1}]","\"prov\":[]")})
      assertThatThrownBy(()->provider().parse("invoice.pdf","application/pdf",json.readTree(input)))
          .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
  }
  @Test void blocksCloudEndpointsCredentialsAndRedirectTargets(){
    for(String url:new String[]{"https://external.example/","http://169.254.169.254/","http://localhost@external.example/",
        "http://localhost:5001/?secret=value","http://localhost:5001/v1/convert/source"})
      assertThatThrownBy(()->new DoclingDocumentAnalysisProvider(new DocumentExtractor(),url)).isInstanceOf(IllegalArgumentException.class);
  }
  @Test void sendsValidatedBytesWithoutForwardingCredentialsOrCustomerFilename() throws Exception {
    var received=new AtomicReference<String>();
    var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
    server.createContext("/v1/convert/source",exchange->{
      received.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
      byte[] body=INVOICE.getBytes(StandardCharsets.UTF_8);exchange.sendResponseHeaders(200,body.length);
      try(var output=exchange.getResponseBody()){output.write(body);}
    });
    server.start();
    try {
      byte[] pdf;
      try(var document=new PDDocument();var output=new ByteArrayOutputStream()){
        document.addPage(new PDPage());document.save(output);pdf=output.toByteArray();
      }
      var client=new DoclingDocumentAnalysisProvider(new DocumentExtractor(),"http://127.0.0.1:"+server.getAddress().getPort());
      assertThat(client.analyze("private-customer-name.pdf","application/pdf",pdf).analysisProvider()).isEqualTo("docling");
      var payload=json.readTree(received.get());
      assertThat(payload.has("http_sources")).isFalse();assertThat(payload.has("file_sources")).isFalse();
      assertThat(received.get()).doesNotContain("private-customer-name","Authorization","Bearer");
      assertThat(payload.path("sources").get(0).path("kind").asText()).isEqualTo("file");
      assertThat(payload.path("target").path("kind").asText()).isEqualTo("inbody");
      assertThat(payload.path("sources").get(0).path("base64_string").asText()).isEqualTo(java.util.Base64.getEncoder().encodeToString(pdf));
    } finally {server.stop(0);}
  }
  @Test void selectedDoclingNeverSilentlyFallsBackToAzureOrRules(){
    var local=mock(LocalDocumentAnalysisProvider.class);var azure=mock(AzureDocumentIntelligenceProvider.class);
    var docling=mock(DoclingDocumentAnalysisProvider.class);when(docling.provider()).thenReturn("docling");when(docling.modelId()).thenReturn("test-layout");
    var service=new DocumentAnalysisService(local,Optional.of(azure),Optional.of(docling),"docling");
    service.analyze("a.pdf","application/pdf",new byte[]{1});verify(docling).analyze(any(),any(),any());verifyNoInteractions(local,azure);
    assertThat(service.status()).containsEntry("activeProvider","docling").containsEntry("maxPages",4);
    var missing=new DocumentAnalysisService(local,Optional.of(azure),Optional.empty(),"docling");
    assertThatThrownBy(()->missing.analyze("a.pdf","application/pdf",new byte[]{1})).hasMessageContaining("Docling is not configured");
  }
}
