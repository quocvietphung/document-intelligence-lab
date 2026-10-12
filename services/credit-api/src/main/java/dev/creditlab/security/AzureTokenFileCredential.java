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

/** Local Docker only: read one short-lived Cognitive Services token, never an Azure CLI refresh cache. */
public final class AzureTokenFileCredential implements TokenCredential {
  private static final String RESOURCE="https://cognitiveservices.azure.com/";
  private static final String SCOPE=RESOURCE+".default";
  private final Path file;
  private final ObjectMapper mapper=new ObjectMapper();

  public AzureTokenFileCredential(String file) {
    if(file==null||file.isBlank()) throw new IllegalArgumentException("Azure token file must be configured");
    this.file=Path.of(file);
  }

  @Override public Mono<AccessToken> getToken(TokenRequestContext context) {
    return Mono.fromSupplier(()->getTokenSync(context));
  }

  @Override public AccessToken getTokenSync(TokenRequestContext context) {
    if(context.getScopes()==null||context.getScopes().isEmpty()||
        context.getScopes().stream().anyMatch(scope->!SCOPE.equals(scope)))
      throw unavailable();
    try {
      if(!Files.isRegularFile(file)||Files.size(file)>32_000) throw unavailable();
      var json=mapper.readTree(Files.readAllBytes(file));
      if(!RESOURCE.equals(json.path("resource").asText())) throw unavailable();
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
