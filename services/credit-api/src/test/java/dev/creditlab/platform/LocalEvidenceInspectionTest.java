package dev.creditlab.platform;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LocalEvidenceInspectionTest {
  @TempDir Path root;
  private CreditCase item(){
    var region=new CreditCase.Region("r0","8,500",.7,.3,.8,.32,600,800,null,null,null);
    var doc=new CreditCase.Document("doc-1","synthetic.pdf","invoice","review",null,List.of(),List.of(new CreditCase.Page(1,"8,500","docling",List.of(region))),true,"docling","layout","application/pdf");
    return new CreditCase("case","tenant","Synthetic","Inspection",0,0,"HUMAN_REVIEW",List.of(),List.of(),"","",List.of(doc),List.of(),2,"general");
  }
  private LocalEvidenceInspection.Request request(UUID id,String value,String source,boolean consent,long version){return new LocalEvidenceInspection.Request(id,version,"doc-1",1,value,source,consent);}
  @Test void consentVersionAndAvailabilityAreRequiredWithoutWritingAFile(){
    var cases=mock(CreditCaseService.class);when(cases.require("tenant","case")).thenReturn(item());var store=new LabStore(Optional.empty(),new ObjectMapper());
    var service=new LocalEvidenceInspection(cases,store,mock(DistributedLimits.class),false,root.toString());
    for(var request:List.of(request(UUID.randomUUID(),"8,500","r0",false,2),request(UUID.randomUUID(),"8,500","r0",true,1),request(UUID.randomUUID(),"8,500","r0",true,2)))
      assertThatThrownBy(()->service.enqueue("tenant","case","actor",request)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThat(Files.exists(root.resolve("inspection"))).isFalse();assertThat(store.list("tenant","case","inspection-run")).isEmpty();
  }
  @Test void originalBytesExactStoredTextAndIdempotencyAreBoundTogether()throws Exception{
    Files.writeString(root.resolve("heartbeat"),"ready");var cases=mock(CreditCaseService.class);when(cases.require("tenant","case")).thenReturn(item());when(cases.file("tenant","case","doc-1")).thenReturn(Optional.of("%PDF-test".getBytes()));
    var store=spy(new LabStore(Optional.empty(),new ObjectMapper()));doReturn(true).when(store).persistent();
    var service=new LocalEvidenceInspection(cases,store,mock(DistributedLimits.class),true,root.toString());UUID id=UUID.randomUUID();
    assertThatThrownBy(()->service.enqueue("tenant","case","actor",request(id,"3,500","r0",true,2))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    var queued=service.enqueue("tenant","case","actor",request(id,"8,500","r0",true,2));
    assertThat(queued).containsEntry("status","QUEUED").doesNotContainKey("pdf");
    assertThat(service.enqueue("tenant","case","actor",request(id,"8,500","r0",true,2))).isEqualTo(queued);
    assertThatThrownBy(()->service.enqueue("tenant","case","actor",request(id,"500","r0",true,2))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    try(var paths=Files.walk(root.resolve("inspection"))){var input=paths.filter(p->p.toString().endsWith("input.json")).findFirst().orElseThrow();var payload=store.decode(Files.readString(input));assertThat(payload).containsEntry("recordedText","8,500").containsKey("pdf");}
    assertThatThrownBy(()->service.report("tenant","case",queued.get("id").toString())).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
  }
}
