package dev.creditlab.platform;

import com.azure.storage.blob.*;
import com.azure.storage.blob.models.*;
import com.azure.storage.blob.options.BlobInputStreamOptions;
import com.azure.identity.DefaultAzureCredentialBuilder;
import dev.creditlab.casework.CreditCaseService;
import java.net.URI;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Explicit pull into the existing consented queue. Never lists another dossier's prefix. */
@Service
public class BlobSources {
  private final CreditCaseService cases;private final DocumentBatches batches;
  private final String endpoint,container;
  private BlobContainerClient client;
  @Value("${app.integrations.storage-token-file:}") private String tokenFile="";
  public BlobSources(CreditCaseService cases,DocumentBatches batches,
      @Value("${app.integrations.blob-endpoint:}") String endpoint,@Value("${app.integrations.blob-container:document-intake}") String container){
    this.cases=cases;this.batches=batches;this.endpoint=endpoint;this.container=container;
    if(!endpoint.isBlank())validateEndpoint(endpoint,container);
  }
  static void validateEndpoint(String endpoint,String container){
    URI uri=URI.create(endpoint);
    if(!"https".equals(uri.getScheme())||uri.getHost()==null||!uri.getHost().matches("[a-z0-9]{3,24}\\.blob\\.core\\.windows\\.net")
        ||uri.getPort()!=-1||uri.getUserInfo()!=null||uri.getQuery()!=null||uri.getFragment()!=null||!(uri.getPath().isEmpty()||uri.getPath().equals("/"))
        ||!container.matches("[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])"))throw new IllegalArgumentException("Use an Azure Blob account root and private intake container");
  }
  public boolean configured(){return !endpoint.isBlank();}
  private synchronized BlobContainerClient client(){
    if(!configured())throw fail(503,"BLOB_SOURCE_NOT_CONFIGURED");
    if(client==null)client=new BlobContainerClientBuilder().endpoint(endpoint).containerName(container)
        .credential(tokenFile.isBlank()?new DefaultAzureCredentialBuilder().build():new dev.creditlab.security.AzureTokenFileCredential(tokenFile,"https://storage.azure.com/")).buildClient();
    return client;
  }
  public static String prefix(String tenant,String caseId){return RagEngine.hash(tenant+"|"+caseId)+"/";}
  static void scopedName(String name,String prefix){if(name==null||!name.startsWith(prefix)||name.substring(prefix.length()).length()>120||!name.substring(prefix.length()).matches("[\\p{L}\\p{N}][\\p{L}\\p{N}._ -]{0,119}\\.(?i:pdf|png|jpe?g)")||name.contains(".."))throw fail(403,"SOURCE_SCOPE_REQUIRED");}
  public Map<String,Object> list(String tenant,String caseId){
    cases.require(tenant,caseId);String prefix=prefix(tenant,caseId);
    try{
      var items=new ArrayList<Map<String,Object>>();
      for(var page:client().listBlobs(new ListBlobsOptions().setPrefix(prefix).setMaxResultsPerPage(20),Duration.ofSeconds(20)).iterableByPage()){
        for(var item:page.getValue()){
          try{scopedName(item.getName(),prefix);}catch(ResponseStatusException ignored){continue;}
          var properties=item.getProperties();Long size=properties.getContentLength();
          if(size==null||size<1||size>3_000_000)continue;
          items.add(Map.of("name",item.getName(),"filename",item.getName().substring(prefix.length()),"etag",properties.getETag(),"bytes",size));
        }
        break; // bounded first page only; explicit refresh, never background polling.
      }
      return Map.of("items",items,"limit",20,"prefix",prefix,"automaticIngestion",false);
    }catch(ResponseStatusException e){throw e;}catch(RuntimeException e){throw fail(503,"BLOB_SOURCE_UNAVAILABLE");}
  }
  public Map<String,Object> ingest(String tenant,String id,String actor,String requestId,long version,String name,String etag,String profile,boolean consent){
    cases.allowWrite();if(cases.require(tenant,id).version()!=version)throw fail(409,"STALE_CASE");
    if(!consent)throw fail(422,"EXPLICIT_PROCESSING_CONSENT_REQUIRED");
    scopedName(name,prefix(tenant,id));if(etag==null||etag.isBlank()||etag.length()>160||etag.chars().anyMatch(Character::isISOControl))throw fail(422,"SOURCE_ETAG_REQUIRED");
    try{
      var blob=client().getBlobClient(name);
      var options=new BlobInputStreamOptions().setBlockSize(64*1024).setRequestConditions(new BlobRequestConditions().setIfMatch(etag));
      byte[] bytes;try(var input=blob.openInputStream(options)){bytes=input.readNBytes(3_000_001);}
      if(bytes.length<1||bytes.length>3_000_000)throw fail(422,"SOURCE_SIZE_LIMIT");
      String filename=name.substring(name.lastIndexOf('/')+1),type=filename.toLowerCase(Locale.ROOT).endsWith("pdf")?"application/pdf":filename.toLowerCase(Locale.ROOT).endsWith("png")?"image/png":"image/jpeg";
      return batches.submit(tenant,id,actor,requestId,"Azure Blob intake","Private Blob · ETag "+etag,profile,List.of(new DocumentBatches.Input(filename,type,bytes)));
    }catch(ResponseStatusException e){throw e;}catch(BlobStorageException e){throw fail(e.getStatusCode()==412?409:503,"BLOB_SOURCE_CHANGED_OR_UNAVAILABLE");}catch(Exception e){throw fail(503,"BLOB_SOURCE_UNAVAILABLE");}
  }
  private static ResponseStatusException fail(int code,String message){return new ResponseStatusException(HttpStatus.valueOf(code),message);}
}
