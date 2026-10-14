package dev.creditlab.platform;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;

/** Retry consent covers only the two exact, previously approved fictional PDFs. */
public final class ApprovedDatevSamples {
  private ApprovedDatevSamples(){}
  private static final Map<String,String> HASHES=load();
  private static Map<String,String> load(){
    try(var input=ApprovedDatevSamples.class.getResourceAsStream("/datev-reference-hashes.json")){
      if(input==null)throw new IllegalStateException("Approved references unavailable");
      return Map.copyOf(new ObjectMapper().readValue(input,new TypeReference<Map<String,String>>(){}));
    }catch(Exception error){throw new IllegalStateException("Approved references unavailable");}
  }
  public static boolean matchesDigest(String name,String digest){return HASHES.containsKey(name)&&HASHES.get(name).equals(digest);}
  public static boolean matches(String name,byte[] bytes){
    try{return matchesDigest(name,HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)));}
    catch(Exception error){return false;}
  }
}
