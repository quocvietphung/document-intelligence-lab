package dev.creditlab.platform;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class DocumentScanner {
  private final String host;private final int port;
  public DocumentScanner(@Value("${app.platform.clamav-host:}") String host,@Value("${app.platform.clamav-port:3310}") int port){this.host=host;this.port=port;}
  public String mode(){return host.isBlank()?"structural checks only (antivirus not configured)":"ClamAV INSTREAM";}
  public String scan(byte[] bytes) {
    String text=new String(bytes,StandardCharsets.ISO_8859_1);
    if(text.contains("/JavaScript")||text.contains("/JS ")||text.contains("/Launch")||text.contains("/EmbeddedFile"))throw new IllegalArgumentException("ACTIVE_CONTENT_BLOCKED");
    if(host.isBlank())return "STRUCTURAL_ONLY";
    try(var socket=new Socket()) {
      socket.connect(new InetSocketAddress(host,port),2500);socket.setSoTimeout(20_000);
      var out=new DataOutputStream(socket.getOutputStream());out.write("zINSTREAM\0".getBytes(StandardCharsets.US_ASCII));
      for(int offset=0;offset<bytes.length;offset+=65536){int size=Math.min(65536,bytes.length-offset);out.writeInt(size);out.write(bytes,offset,size);}out.writeInt(0);out.flush();
      var input=socket.getInputStream();var result=new ByteArrayOutputStream();int c;while((c=input.read())>0&&result.size()<512)result.write(c);
      String response=result.toString(StandardCharsets.UTF_8);
      if(response.contains("FOUND"))throw new IllegalArgumentException("MALWARE_BLOCKED");
      if(!response.endsWith("OK"))throw new IllegalStateException("SCAN_UNAVAILABLE");return "CLAMAV_CLEAN";
    } catch(IllegalArgumentException e){throw e;}catch(Exception e){throw new IllegalStateException("SCAN_UNAVAILABLE",e);}
  }
}
