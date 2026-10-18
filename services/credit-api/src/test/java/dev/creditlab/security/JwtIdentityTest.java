package dev.creditlab.security;

import static org.assertj.core.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class JwtIdentityTest {
  private JwtAuthenticationToken token(String tenant, String subject) {
    var jwt = Jwt.withTokenValue("test-token").header("alg", "RS256").claim("iss", "test-issuer");
    if (tenant != null) jwt.claim("tenant_id", tenant);
    if (subject != null) jwt.subject(subject);
    return new JwtAuthenticationToken(jwt.build(), List.of(), "display-name");
  }

  @Test void readsTenantAndStableSubjectWithoutUsingDisplayName() {
    var authentication = token("tenant-a", "user-123");
    assertThat(JwtIdentity.tenant(authentication)).isEqualTo("tenant-a");
    assertThat(JwtIdentity.actor(authentication)).isEqualTo("user-123");
  }

  @Test void rejectsMissingOrBlankTenant() {
    for (String tenant : new String[]{null, "", " "}) {
      assertThatThrownBy(() -> JwtIdentity.tenant(token(tenant, "user")))
          .isInstanceOf(AccessDeniedException.class).hasMessage("Verified tenant required");
    }
  }

  @Test void rejectsMissingOrBlankSubject() {
    for (String subject : new String[]{null, "", " "}) {
      assertThatThrownBy(() -> JwtIdentity.actor(token("tenant-a", subject)))
          .isInstanceOf(AccessDeniedException.class).hasMessage("Verified identity required");
    }
  }

  @Test void rejectsNonStringTenantClaims() {
    for (Object tenant : List.of(123, List.of("tenant-a"))) {
      var jwt = Jwt.withTokenValue("test-token").header("alg", "RS256")
          .subject("user").claim("tenant_id", tenant).build();
      assertThatThrownBy(() -> JwtIdentity.tenant(new JwtAuthenticationToken(jwt)))
          .isInstanceOf(AccessDeniedException.class);
    }
  }

  @Test void neverAcceptsAnonymousOrNonJwtIdentity() {
    var password = new UsernamePasswordAuthenticationToken("user", "unused");
    for (var authentication : new org.springframework.security.core.Authentication[]{null, password}) {
      assertThatThrownBy(() -> JwtIdentity.tenant(authentication)).isInstanceOf(AccessDeniedException.class);
      assertThatThrownBy(() -> JwtIdentity.actor(authentication)).isInstanceOf(AccessDeniedException.class);
    }
  }
}
