package dev.creditlab.security;

import java.net.URI;
import java.util.Set;

/** Operator-configured local model services only; never a request-supplied URL or cloud fallback. */
public final class LocalModelEndpoint {
  private LocalModelEndpoint() {}
  public static String validate(String value) {
    try {
      URI uri=URI.create(value);
      if(!"http".equals(uri.getScheme())||!Set.of("localhost","127.0.0.1","[::1]","ollama","ai-models","host.docker.internal").contains(uri.getHost())
          ||uri.getUserInfo()!=null||uri.getQuery()!=null||uri.getFragment()!=null||!(uri.getPath().isEmpty()||uri.getPath().equals("/")))
        throw new IllegalArgumentException();
      return value.replaceAll("/$","");
    } catch(RuntimeException e) {throw new IllegalArgumentException("Use an approved local model service root URL");}
  }
  public static String model(String value) {
    if(value==null||!value.matches("[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,99}")||value.contains("..")||value.contains("://")||value.toLowerCase(java.util.Locale.ROOT).matches(".*(?:-cloud|:cloud)(?::.*)?$"))
      throw new IllegalArgumentException("Configure an explicit local model identifier");
    return value;
  }
}
