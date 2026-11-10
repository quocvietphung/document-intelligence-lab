package dev.creditlab.sources;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Encrypts connector secrets (refresh tokens, PKCE verifiers) at rest with AES-256-GCM. The additional
 * authenticated data binds a ciphertext to its tenant, user and provider, so a copied row cannot be
 * decrypted for another account. Without a configured key, connectors that need secrets stay disabled.
 */
@Component
public class TokenVault {
  private static final SecureRandom RANDOM = new SecureRandom();
  private final SecretKeySpec key;

  public TokenVault(@Value("${app.connectors.token-key:}") String base64Key) {
    if (base64Key == null || base64Key.isBlank()) { key = null; return; }
    byte[] raw;
    try { raw = Base64.getDecoder().decode(base64Key.strip()); }
    catch (IllegalArgumentException e) { throw new IllegalArgumentException("CONNECTOR_TOKEN_KEY must be base64"); }
    if (raw.length != 32) throw new IllegalArgumentException("CONNECTOR_TOKEN_KEY must decode to 32 bytes");
    key = new SecretKeySpec(raw, "AES");
  }

  public boolean configured() { return key != null; }

  public String seal(String plaintext, String binding) {
    if (key == null) throw new IllegalStateException("Token encryption is not configured");
    try {
      byte[] iv = new byte[12]; RANDOM.nextBytes(iv);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
      cipher.updateAAD(binding.getBytes(StandardCharsets.UTF_8));
      byte[] sealed = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
      return "v1:" + Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + sealed.length).put(iv).put(sealed).array());
    } catch (Exception e) { throw new IllegalStateException("Token encryption failed"); }
  }

  public String open(String sealed, String binding) {
    if (key == null) throw new IllegalStateException("Token encryption is not configured");
    if (sealed == null || !sealed.startsWith("v1:")) throw new IllegalStateException("Unsupported token format");
    try {
      byte[] data = Base64.getDecoder().decode(sealed.substring(3));
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, data, 0, 12));
      cipher.updateAAD(binding.getBytes(StandardCharsets.UTF_8));
      return new String(cipher.doFinal(data, 12, data.length - 12), StandardCharsets.UTF_8);
    } catch (Exception e) { throw new IllegalStateException("Token decryption failed"); }
  }

  /** For log lines and error messages: never the token, only that one existed. */
  public static String redact(String token) {
    return token == null || token.isEmpty() ? "[none]" : "[redacted]";
  }
}
