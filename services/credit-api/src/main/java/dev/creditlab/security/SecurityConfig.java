package dev.creditlab.security;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.core.OAuth2Error;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
  @Bean
  @ConditionalOnProperty(name = "app.security.enabled", havingValue = "true", matchIfMissing = true)
  JwtDecoder jwtDecoder(@Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuer,
      @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}") String jwkUri) {
    NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkUri).build();
    decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(issuer),
        jwt -> jwt.getAudience().contains("credit-api") ? OAuth2TokenValidatorResult.success()
            : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Invalid audience", null))));
    return decoder;
  }
  @Bean
  @ConditionalOnProperty(name = "app.security.enabled", havingValue = "true", matchIfMissing = true)
  SecurityFilterChain secured(HttpSecurity http) throws Exception {
    return http.csrf(csrf -> csrf.disable())
        .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/actuator/health", "/actuator/info").permitAll()
            .requestMatchers("/actuator/prometheus").hasRole("ADMIN")
            .requestMatchers("/api/cases/*/platform/**").hasAnyRole("ADVISOR","REVIEWER","ADMIN")
            .requestMatchers(HttpMethod.POST, "/api/assistant/chat").hasAnyRole("ADVISOR", "REVIEWER", "ADMIN")
            .requestMatchers(HttpMethod.GET, "/api/cases/**").hasAnyRole("ADVISOR", "REVIEWER", "ADMIN")
            .requestMatchers(HttpMethod.POST, "/api/cases/*/documents/*/review").hasAnyRole("REVIEWER","ADMIN")
            .requestMatchers(HttpMethod.POST, "/api/cases/*/banking/payments/*/confirm").hasAnyRole("REVIEWER","ADMIN")
            .requestMatchers("/api/cases/**").hasAnyRole("ADVISOR","ADMIN")
            .anyRequest().authenticated())
        .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtConverter())))
        .build();
  }

  @Bean
  @ConditionalOnProperty(name = "app.security.enabled", havingValue = "false")
  SecurityFilterChain demo(HttpSecurity http) throws Exception {
    return http.csrf(csrf -> csrf.disable()).authorizeHttpRequests(auth -> auth.anyRequest().permitAll()).build();
  }

  private Converter<Jwt, AbstractAuthenticationToken> jwtConverter() {
    return jwt -> {
      Map<String, Object> realmAccess = jwt.getClaim("realm_access");
      Object rawRoles = realmAccess == null ? null : realmAccess.get("roles");
      Collection<?> roles = rawRoles instanceof Collection<?> collection ? collection : List.of();
      Stream<GrantedAuthority> authorities = roles.stream().map(String::valueOf).map(role -> new SimpleGrantedAuthority("ROLE_" + role));
      return new JwtAuthenticationToken(jwt, authorities.toList(), jwt.getClaimAsString("preferred_username"));
    };
  }
}
