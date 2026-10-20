package dev.creditlab.security;

import com.azure.core.credential.AccessToken;
import com.azure.core.credential.TokenCredential;
import com.azure.core.credential.TokenRequestContext;
import com.azure.identity.CredentialUnavailableException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import reactor.core.publisher.Mono;

/** Local Docker only: one short-lived token for one explicit audience, never an Azure CLI refresh cache. */
public final class AzureTokenFileCredential implements TokenCredential {
  private static final String RESOURCE="https://cognitiveservices.azure.com/";
  private final Path file;
  private final String resource;
  private final ObjectMapper mapper=new ObjectMapper();

  public AzureTokenFileCredential(String file) {
    this(file,RESOURCE);
  }
  public AzureTokenFileCredential(String file,String resource) {
    if(file==null||file.isBlank()) throw new IllegalArgumentException("Azure token file must be configured");
    if(!java.util.Set.of(RESOURCE,"https://storage.azure.com/","https://management.azure.com/").contains(resource))throw new IllegalArgumentException("Unsupported token audience");
    this.file=Path.of(file);
    this.resource=resource;
  }

  @Override public Mono<AccessToken> getToken(TokenRequestContext context) {
    return Mono.fromSupplier(()->getTokenSync(context));
  }

  @Override public AccessToken getTokenSync(TokenRequestContext context) {
    if(context.getScopes()==null||context.getScopes().isEmpty()||
        context.getScopes().stream().anyMatch(scope->!(resource+".default").equals(scope)))
      throw unavailable();
    try {
      if(!Files.isRegularFile(file)||Files.size(file)>32_000) throw unavailable();
      var json=mapper.readTree(Files.readAllBytes(file));
      if(!resource.equals(json.path("resource").asText())) throw unavailable();
      String token=json.path("accessToken").asText("");
      var expires=OffsetDateTime.parse(json.path("expiresOn").asText(""));
      if(token.isBlank()||!expires.isAfter(OffsetDateTime.now().plusSeconds(30))) throw unavailable();
      return new AccessToken(token,expires);
    } catch(Exception error) {
      // JSON/parser errors may contain document fragments; do not attach them to logs.
      throw unavailable();
    }
  }

  private CredentialUnavailableException unavailable() {
    return new CredentialUnavailableException("Local Azure token unavailable or expired. Restart scripts/docker-azure.mjs after az login.");
  }
}
