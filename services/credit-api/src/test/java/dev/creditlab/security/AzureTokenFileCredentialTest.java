package dev.creditlab.security;

import static org.assertj.core.api.Assertions.*;
import com.azure.core.credential.TokenRequestContext;
import com.azure.identity.CredentialUnavailableException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.time.OffsetDateTime;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class AzureTokenFileCredentialTest {
  @TempDir Path directory;
  final TokenRequestContext context=new TokenRequestContext().addScopes("https://cognitiveservices.azure.com/.default");
  Path file() { return directory.resolve("token.json"); }
  void write(String token,OffsetDateTime expires,String resource) throws Exception {
    new ObjectMapper().writeValue(file().toFile(),Map.of("accessToken",token,"expiresOn",expires.toString(),"resource",resource));
  }
  @Test void readsFreshTokenAndSeesAtomicRefresh() throws Exception {
    write("synthetic-one",OffsetDateTime.now().plusMinutes(10),"https://cognitiveservices.azure.com/");
    var credential=new AzureTokenFileCredential(file().toString());
    assertThat(credential.getTokenSync(context).getToken()).isEqualTo("synthetic-one");
    write("synthetic-two",OffsetDateTime.now().plusMinutes(20),"https://cognitiveservices.azure.com/");
    assertThat(credential.getToken(context).block().getToken()).isEqualTo("synthetic-two");
  }
  @Test void rejectsExpiredToken() throws Exception {
    write("synthetic",OffsetDateTime.now().minusMinutes(1),"https://cognitiveservices.azure.com/");
    assertThatThrownBy(()->new AzureTokenFileCredential(file().toString()).getTokenSync(context))
        .isInstanceOf(CredentialUnavailableException.class);
  }
  @Test void refusesOtherAzureScopes() throws Exception {
    write("synthetic",OffsetDateTime.now().plusMinutes(10),"https://cognitiveservices.azure.com/");
    assertThatThrownBy(()->new AzureTokenFileCredential(file().toString()).getTokenSync(
        new TokenRequestContext().addScopes("https://management.azure.com/.default")))
        .isInstanceOf(CredentialUnavailableException.class);
  }
  @Test void rejectsWrongResource() throws Exception {
    write("synthetic",OffsetDateTime.now().plusMinutes(10),"https://management.azure.com/");
    assertThatThrownBy(()->new AzureTokenFileCredential(file().toString()).getTokenSync(context))
        .isInstanceOf(CredentialUnavailableException.class);
  }
  @Test void rejectsMalformedFileWithoutLeakingContent() throws Exception {
    Files.writeString(file(),"{not valid SENSITIVE-TEST-STRING");
    assertThatThrownBy(()->new AzureTokenFileCredential(file().toString()).getTokenSync(context))
        .isInstanceOf(CredentialUnavailableException.class).hasMessageNotContaining("SENSITIVE-TEST-STRING");
  }
}
