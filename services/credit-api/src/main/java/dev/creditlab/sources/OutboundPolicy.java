package dev.creditlab.sources;

import java.net.*;
import java.util.*;

/**
 * SSRF guard for every outbound connector URL. Provider endpoints come from operator configuration and
 * must match an exact host allowlist. A URL is never built from a value that a user or a document supplied.
 */
public final class OutboundPolicy {
  private OutboundPolicy() {}
  private static final Set<String> LOOPBACK = Set.of("127.0.0.1", "localhost", "[::1]", "::1");

  /**
   * @param allowedHosts exact host names permitted over HTTPS
   * @param internalHttpHosts exact service names permitted over plain HTTP inside the private Docker network
   * @param allowLoopbackForTests permits http://127.0.0.1 only for automated tests with a local mock
   */
  public static URI requireAllowed(String raw, Set<String> allowedHosts, Set<String> internalHttpHosts, boolean allowLoopbackForTests) {
    final URI uri;
    try { uri = new URI(Objects.requireNonNull(raw).strip()); }
    catch (URISyntaxException | NullPointerException e) { throw new IllegalArgumentException("Connector endpoint is not a valid URL"); }
    String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
    if (!uri.isAbsolute() || host.isBlank() || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null)
      throw new IllegalArgumentException("Connector endpoint must be an absolute URL without credentials, query or fragment");
    boolean loopback = LOOPBACK.contains(host);
    switch (Objects.requireNonNullElse(uri.getScheme(), "").toLowerCase(Locale.ROOT)) {
      case "https" -> {
        if (loopback ? !allowLoopbackForTests : !allowedHosts.contains(host)) throw new IllegalArgumentException("Connector host is not allowed: " + host);
        if (uri.getPort() != -1 && uri.getPort() != 443 && !loopback) throw new IllegalArgumentException("Connector port is not allowed");
      }
      case "http" -> {
        if (!(loopback && allowLoopbackForTests) && !internalHttpHosts.contains(host)) throw new IllegalArgumentException("Plain HTTP is only allowed for internal services");
      }
      default -> throw new IllegalArgumentException("Connector endpoint must use HTTPS");
    }
    return uri;
  }

  /**
   * Destination URLs (for example a future webhook) must also resolve only to public addresses. DNS can change
   * after this check; a real webhook needs connection-time pinning as well.
   */
  public static void requirePublicAddresses(String host) {
    try {
      for (InetAddress address : InetAddress.getAllByName(host)) {
        if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress() || address.isSiteLocalAddress()
            || address.isMulticastAddress() || isUniqueLocalIpv6(address) || isCarrierGradeNat(address) || isMetadata(address))
          throw new IllegalArgumentException("Destination resolves to a private or reserved address");
      }
    } catch (UnknownHostException e) { throw new IllegalArgumentException("Destination host cannot be resolved"); }
  }

  private static boolean isUniqueLocalIpv6(InetAddress address) {
    return address instanceof Inet6Address && (address.getAddress()[0] & 0xfe) == 0xfc;
  }
  private static boolean isCarrierGradeNat(InetAddress address) {
    byte[] b = address.getAddress();
    return b.length == 4 && (b[0] & 0xff) == 100 && (b[1] & 0xc0) == 64;
  }
  private static boolean isMetadata(InetAddress address) {
    byte[] b = address.getAddress();
    return b.length == 4 && (b[0] & 0xff) == 169 && (b[1] & 0xff) == 254;
  }

  /** Appends a path and an encoded query to a validated base URL. */
  public static String join(URI base, String path, Map<String, String> query) {
    var url = new StringBuilder(base.toString().replaceAll("/+$", ""));
    url.append(path.startsWith("/") ? path : "/" + path);
    if (!query.isEmpty()) {
      url.append('?');
      var first = true;
      for (var entry : query.entrySet()) {
        if (!first) url.append('&');
        url.append(URLEncoder.encode(entry.getKey(), java.nio.charset.StandardCharsets.UTF_8)).append('=')
            .append(URLEncoder.encode(entry.getValue(), java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20"));
        first = false;
      }
    }
    return url.toString();
  }

  /** Encodes one path segment (for example a provider object ID that was already format-checked). */
  public static String segment(String value) {
    return URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20");
  }
}
