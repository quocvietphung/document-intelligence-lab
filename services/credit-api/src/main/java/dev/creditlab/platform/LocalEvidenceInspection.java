package dev.creditlab.platform;

import dev.creditlab.casework.*;
import jakarta.validation.constraints.*;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/** Read-only inspection in the existing private, offline ETL spool. No new HTTP service. */
@Service
public class LocalEvidenceInspection {
  public record Request(@NotNull UUID requestId,@Min(0) long caseVersion,
      @NotBlank @Pattern(regexp="[-a-zA-Z0-9]{1,80}") String documentId,@Min(1) @Max(4) int page,
      @NotBlank @Size(max=500) String value,@Size(max=80) String sourceId,@AssertTrue boolean consent) {}
  private final CreditCaseService cases;private final LabStore store;private final DistributedLimits limits;
  private final boolean enabled;private final Path root;
  public LocalEvidenceInspection(CreditCaseService cases,LabStore store,DistributedLimits limits,
      @Value("${app.platform.etl-enabled:false}") boolean enabled,@Value("${app.platform.etl-root:/app/etl}") String root){
    this.cases=cases;this.store=store;this.limits=limits;this.enabled=enabled;this.root=Path.of(root).toAbsolutePath().normalize();
  }
  private CreditCase.Document document(String tenant,String id,String doc){return cases.require(tenant,id).documents().stream()
      .filter(d->d.id().equals(doc)&&d.originalAvailable()&&"application/pdf".equals(d.contentType())).findFirst().orElseThrow(()->fail(404,"Original PDF unavailable"));}
  private String fingerprint(CreditCase.Document doc){return RagEngine.hash(store.encode(doc));}
  private boolean ready(){try{return enabled&&Files.isRegularFile(root.resolve("heartbeat"),LinkOption.NOFOLLOW_LINKS)&&Files.getLastModifiedTime(root.resolve("heartbeat")).toInstant().isAfter(Instant.now().minusSeconds(90));}catch(Exception e){return false;}}
  public Map<String,Object> read(String tenant,String id){
    var item=cases.require(tenant,id);
    return Map.of("enabled",enabled,"workerReady",ready(),"cloudCalls",0,"runs",store.list(tenant,id,"inspection-run").stream().map(r->{
      var result=new LinkedHashMap<>(r);boolean current=item.documents().stream().anyMatch(d->d.id().equals(r.get("documentId"))&&d.originalAvailable()&&fingerprint(d).equals(r.get("documentFingerprint")));
      result.put("current",current);return result;}).toList());
  }
  public Map<String,Object> enqueue(String tenant,String id,String actor,Request request){
    cases.allowWrite();var item=cases.require(tenant,id);
    if(!request.consent())throw fail(422,"Explicit private inspection consent required");
    if(item.version()!=request.caseVersion())throw fail(409,"Source changed");
    var doc=document(tenant,id,request.documentId());var page=doc.pages().stream().filter(p->p.number()==request.page()).findFirst().orElseThrow(()->fail(422,"Unknown source page"));
    String runId="insp-"+request.requestId(),hash=fingerprint(doc);
    var identity=Map.of("documentFingerprint",hash,"documentId",doc.id(),"page",request.page(),"value",request.value(),"sourceId",Objects.toString(request.sourceId(),""));
    var previous=store.find(tenant,id,"inspection-run",runId);
    if(previous.isPresent()){
      if(!identity.entrySet().stream().allMatch(e->Objects.equals(previous.get().get(e.getKey()),e.getValue())))throw fail(409,"Request ID already used for different evidence");
      return previous.get();
    }
    if(!enabled||!store.persistent()||!ready())throw fail(503,"Local inspection worker is not ready");
    if(store.list(tenant,id,"inspection-run").stream().anyMatch(r->"QUEUED".equals(r.get("status"))))throw fail(409,"An inspection is pending");
    byte[] bytes=cases.file(tenant,id,doc.id()).orElseThrow(()->fail(410,"Original expired"));
    if(bytes.length>3_000_000||bytes.length<5||!new String(bytes,0,5,java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-"))throw fail(422,"Bounded original PDF required");
    String scope=RagEngine.hash(tenant+"|"+id),sha;
    try{sha=HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));}catch(Exception e){throw new IllegalStateException(e);}
    var payload=new LinkedHashMap<String,Object>();payload.put("format","document-inspection-request-v1");payload.put("id",runId);payload.put("scope",scope);payload.put("sha256",sha);
    payload.put("pdf",Base64.getEncoder().encodeToString(bytes));payload.put("page",request.page());payload.put("value",request.value());payload.put("languages","eng");
    if(request.sourceId()!=null&&!request.sourceId().isBlank()){
      var region=page.regions().stream().filter(r->r.id().equals(request.sourceId())).findFirst().orElseThrow(()->fail(422,"Unknown source occurrence"));
      if(!region.text().equals(request.value()))throw fail(422,"Use the exact recorded occurrence text");
      payload.put("recordedText",region.text());payload.put("recordedBox",List.of(region.left(),region.top(),region.right(),region.bottom()));payload.put("recordedPageSize",List.of(region.pageWidth(),region.pageHeight()));
    }
    limits.reserve(tenant,actor,"local-inspection",4);
    var run=new LinkedHashMap<String,Object>(identity);run.put("id",runId);run.put("actor",actor);run.put("time",Instant.now().toString());run.put("scope",scope);run.put("sha256",sha);run.put("status","QUEUED");run.put("caseVersion",item.version());
    if(!store.insert(tenant,id,"inspection-run",runId,run))throw fail(409,"Inspection already submitted");
    try{Path directory=root.resolve("inspection").resolve(scope);Files.createDirectories(directory);Path temporary=Files.createTempFile(directory,"inspection-",".tmp");Files.writeString(temporary,store.encode(payload));Files.move(temporary,directory.resolve(runId+".input.json"),StandardCopyOption.ATOMIC_MOVE);}
    catch(Exception e){var failed=new LinkedHashMap<>(run);failed.put("status","FAILED");failed.put("errorCode","INSPECTION_SPOOL_UNAVAILABLE");store.replace(tenant,id,"inspection-run",runId,run,failed);throw fail(503,"Private inspection spool unavailable");}
    return run;
  }
  public Map<String,Object> report(String tenant,String id,String runId){
    var run=store.find(tenant,id,"inspection-run",runId).orElseThrow(()->fail(404,"Inspection unavailable"));
    var doc=document(tenant,id,Objects.toString(run.get("documentId"),""));
    if(!"COMPLETE".equals(run.get("status"))||!fingerprint(doc).equals(run.get("documentFingerprint")))throw fail(409,"Inspection is pending or source changed");
    var answers=store.list(tenant,id,"trust-answer").stream().filter(a->a.get("sources") instanceof List<?> sources&&sources.stream().anyMatch(s->s instanceof Map<?,?> source&&doc.id().equals(source.get("documentId")))).limit(10).toList();
    return Map.of("format","private-evidence-report-v1","inspection",run,"document",doc,"originalIncluded",false,"answers",answers,"answerSelection","same-document-only-not-proof-of-support",
        "humanReviewRequired",true,"warning","Contains private OCR, source crops and reviewer history. Not a verification certificate.");
  }
  @Scheduled(fixedDelay=2500,initialDelay=10000)
  public void reconcile(){
    if(!enabled||!store.persistent())return;
    var rows=store.database().queryForList("SELECT tenant,case_id,id,payload FROM lab_records WHERE kind='inspection-run' AND payload::jsonb->>'status'='QUEUED' ORDER BY created_at LIMIT 20");
    for(var row:rows){var before=store.decode(row.get("payload").toString());String tenant=row.get("tenant").toString(),id=row.get("case_id").toString(),run=row.get("id").toString();
      if(!run.matches("insp-[a-f0-9-]{36}"))continue;
      Path path=root.resolve("inspection").resolve(RagEngine.hash(tenant+"|"+id)).resolve(run+".result.json");
      try{
        if(!Files.isRegularFile(path,LinkOption.NOFOLLOW_LINKS)){
          if(Instant.parse(before.get("time").toString()).isBefore(Instant.now().minusSeconds(180))){var expired=new LinkedHashMap<>(before);expired.put("status","FAILED");expired.put("errorCode","INSPECTION_TIMEOUT");store.replace(tenant,id,"inspection-run",run,before,expired);Files.deleteIfExists(path.resolveSibling(run+".input.json"));}continue;
        }
        if(Files.size(path)>2_000_000)throw new IllegalArgumentException();var receipt=store.decode(Files.readString(path));
        if(!run.equals(receipt.get("id"))||!before.get("sha256").equals(receipt.get("sha256")))throw new IllegalArgumentException();
        var after=new LinkedHashMap<>(before);after.put("finishedAt",receipt.get("finishedAt"));
        boolean current=fingerprint(document(tenant,id,before.get("documentId").toString())).equals(before.get("documentFingerprint"));
        after.put("status",current&&"COMPLETE".equals(receipt.get("status"))?"COMPLETE":current?"FAILED":"STALE");
        if(after.get("status").equals("COMPLETE")){
          if(!(receipt.get("result") instanceof Map<?,?> result)||!before.get("sha256").equals(result.get("sha256")))throw new IllegalArgumentException();
          after.put("result",result);
        }else after.put("errorCode",Objects.toString(receipt.get("errorCode"),"SOURCE_CHANGED"));
        if(store.replace(tenant,id,"inspection-run",run,before,after))Files.deleteIfExists(path);
      }catch(Exception e){var failed=new LinkedHashMap<>(before);failed.put("status","FAILED");failed.put("errorCode","INSPECTION_RECEIPT_UNAVAILABLE");store.replace(tenant,id,"inspection-run",run,before,failed);}
    }
  }
  private static ResponseStatusException fail(int status,String message){return new ResponseStatusException(HttpStatus.valueOf(status),message);}
}
