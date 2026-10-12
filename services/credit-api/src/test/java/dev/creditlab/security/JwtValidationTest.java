package dev.creditlab.security;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.time.Instant;
import java.util.Date;
import org.junit.jupiter.api.*;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import static org.assertj.core.api.Assertions.*;

class JwtValidationTest {
  HttpServer server;
  RSAKey key;
  JwtDecoder decoder;
  @BeforeEach void setup() throws Exception {
    key = new RSAKeyGenerator(2048).keyID("test-key").generate();
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/certs", exchange -> {
      byte[] payload = new JWKSet(key.toPublicJWK()).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
      exchange.getResponseHeaders().set("Content-Type", "application/json");
      exchange.sendResponseHeaders(200, payload.length);
      exchange.getResponseBody().write(payload);
      exchange.close();
    });
    server.start();
    decoder = new SecurityConfig().jwtDecoder("https://issuer.example/realms/lab", "http://127.0.0.1:" + server.getAddress().getPort() + "/certs");
  }
  @AfterEach void cleanup() { server.stop(0); }
  String token(RSAKey signingKey, String issuer, String audience, Instant expires) throws Exception {
    SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("test-key").build(), new JWTClaimsSet.Builder().subject("demo").issuer(issuer).audience(audience).expirationTime(Date.from(expires)).issueTime(new Date()).build());
    jwt.sign(new RSASSASigner(signingKey));
    return jwt.serialize();
  }
  @Test void acceptsSignedApiToken() throws Exception { assertThat(decoder.decode(token(key, "https://issuer.example/realms/lab", "credit-api", Instant.now().plusSeconds(300))).getSubject()).isEqualTo("demo"); }
  @Test void rejectsWrongAudience() throws Exception { String token = token(key, "https://issuer.example/realms/lab", "other-api", Instant.now().plusSeconds(300)); assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtException.class); }
  @Test void rejectsWrongIssuer() throws Exception { String token = token(key, "https://wrong.example", "credit-api", Instant.now().plusSeconds(300)); assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtException.class); }
  @Test void rejectsExpiredToken() throws Exception { String token = token(key, "https://issuer.example/realms/lab", "credit-api", Instant.now().minusSeconds(120)); assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtException.class); }
  @Test void rejectsOtherSigningKey() throws Exception { String token = token(new RSAKeyGenerator(2048).generate(), "https://issuer.example/realms/lab", "credit-api", Instant.now().plusSeconds(300)); assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtException.class); }
}
