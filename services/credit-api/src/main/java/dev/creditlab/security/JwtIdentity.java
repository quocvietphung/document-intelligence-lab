package dev.creditlab.security;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/** Read identity only from the JWT already validated by Spring Security. */
public final class JwtIdentity {
  private JwtIdentity() {}

  public static String tenant(Authentication authentication) {
    if (authentication instanceof JwtAuthenticationToken token) {
      Object tenant = token.getToken().getClaim("tenant_id");
      if (tenant instanceof String value && !value.isBlank()) return value;
    }
    throw new AccessDeniedException("Verified tenant required");
  }

  public static String actor(Authentication authentication) {
    if (authentication instanceof JwtAuthenticationToken token) {
      String subject = token.getToken().getSubject();
      if (subject != null && !subject.isBlank()) return subject;
    }
    throw new AccessDeniedException("Verified identity required");
  }
}
