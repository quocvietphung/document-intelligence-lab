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

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
  @Bean
  @ConditionalOnProperty(name = "app.security.enabled", havingValue = "true", matchIfMissing = true)
  SecurityFilterChain secured(HttpSecurity http) throws Exception {
    return http.csrf(csrf -> csrf.disable())
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/actuator/health", "/actuator/info").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/cases/**").hasAnyRole("ADVISOR", "REVIEWER", "ADMIN")
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
