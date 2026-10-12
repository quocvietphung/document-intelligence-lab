package dev.creditlab.platform;

import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobContainerClientBuilder;
import com.azure.core.util.BinaryData;
import com.azure.identity.DefaultAzureCredentialBuilder;
import dev.creditlab.security.AzureTokenFileCredential;
import java.nio.file.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class DocumentObjectStore {
  private final Path root;private final BlobContainerClient blob;
  public DocumentObjectStore(@Value("${app.platform.storage-root:/tmp/credit-lab-objects}") String root,
      @Value("${app.platform.blob-endpoint:}") String endpoint,@Value("${app.platform.blob-container:lab-documents}") String container,
      @Value("${app.ai.token-file:}") String tokenFile) {
    this.root=Path.of(root).toAbsolutePath().normalize();
    blob=endpoint.isBlank()?null:new BlobContainerClientBuilder().endpoint(endpoint).containerName(container)
      .credential(tokenFile.isBlank()?new DefaultAzureCredentialBuilder().build():new AzureTokenFileCredential(tokenFile)).buildClient();
  }
  public String mode(){return blob==null?"local volume":"Azure Blob · Entra identity";}
  private Path path(String key){if(!key.matches("[a-f0-9]{64}/[-a-zA-Z0-9]{1,80}"))throw new IllegalArgumentException("Invalid object key");Path p=root.resolve(key).normalize();if(!p.startsWith(root))throw new IllegalArgumentException("Invalid object path");return p;}
  public void put(String key,byte[] bytes) {
    try{if(blob!=null){blob.getBlobClient(key).upload(BinaryData.fromBytes(bytes),false);return;}Path p=path(key);Files.createDirectories(p.getParent());Files.write(p,bytes,StandardOpenOption.CREATE_NEW);}
    catch(Exception e){throw new IllegalStateException("Object storage unavailable",e);}
  }
  public byte[] read(String key){try{return blob==null?Files.readAllBytes(path(key)):blob.getBlobClient(key).downloadContent().toBytes();}catch(Exception e){throw new IllegalStateException("Object unavailable",e);}}
  public void delete(String key){try{if(blob!=null)blob.getBlobClient(key).deleteIfExists();else Files.deleteIfExists(path(key));}catch(Exception e){throw new IllegalStateException("Object cleanup unavailable",e);}}
}
