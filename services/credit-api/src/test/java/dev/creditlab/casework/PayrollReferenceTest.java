package dev.creditlab.casework;

import static org.junit.jupiter.api.Assertions.*;
import java.nio.file.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

class PayrollReferenceTest {
  @TempDir Path folder;
  private JwtAuthenticationToken identity(){return new JwtAuthenticationToken(Jwt.withTokenValue("test").header("alg","none").claim("sub","test").claim("tenant_id","lab").build());}
  @Test void missingReferencesReturnUnavailableWithoutLeakingPaths(){
    var response=new PayrollReferenceController("").read(null,identity());
    assertTrue(response.getBody().toString().contains("available=false"));
    assertEquals("private, no-store",response.getHeaders().getCacheControl());
  }
  @Test void arbitraryPathsCannotBeRead(){
    var controller=new PayrollReferenceController(folder.toString());
    assertEquals(404,assertThrows(ResponseStatusException.class,()->controller.read("../secrets/runtime.env",identity())).getStatusCode().value());
  }
  @Test void renamedOrTamperedPdfIsRejected() throws Exception {
    Files.writeString(folder.resolve("datev-lodas-2025-robert-muster.pdf"),"%PDF-fake");
    assertEquals(503,assertThrows(ResponseStatusException.class,()->new PayrollReferenceController(folder.toString()).read("robert",identity())).getStatusCode().value());
  }
  @Test void noUnverifiedIdentityCanRead(){
    assertThrows(org.springframework.security.access.AccessDeniedException.class,()->new PayrollReferenceController(folder.toString()).read(null,null));
  }
}
