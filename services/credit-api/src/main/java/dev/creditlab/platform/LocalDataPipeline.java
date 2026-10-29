package dev.creditlab.platform;

import dev.creditlab.casework.CreditCaseService;
import jakarta.validation.constraints.*;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/** Authenticated snapshot -> private Docker spool -> immutable analytics receipt. No cloud or OCR call. */
@Service
public class LocalDataPipeline {
  static final String METHOD="document-medallion-v3";
  public record Request(@Min(0) long caseVersion,@NotNull UUID requestId,@AssertTrue boolean consent) {}
  private final CreditCaseService cases;private final LabStore store;private final DocumentResearch research;
  private final Path root;private final boolean enabled;private final DistributedLimits limits;
  public LocalDataPipeline(CreditCaseService cases,LabStore store,DocumentResearch research,DistributedLimits limits,
      @Value("${app.platform.etl-enabled:false}") boolean enabled,@Value("${app.platform.etl-root:/app/etl}") String root){
    this.cases=cases;this.store=store;this.research=research;this.limits=limits;this.enabled=enabled;this.root=Path.of(root).toAbsolutePath().normalize();
  }
  public Map<String,Object> read(String tenant,String id){
    var item=cases.require(tenant,id);String hash=research.fingerprint(item);
    return Map.of("caseId",id,"caseVersion",item.version(),"sourceHash",hash,"enabled",enabled,"workerReady",ready(),"cloudCalls",0,
        "runs",store.list(tenant,id,"medallion-run").stream().map(r->{var value=new LinkedHashMap<>(r);value.put("current",hash.equals(r.get("sourceHash"))&&(!"COMPLETE".equals(r.get("status"))||currentMethod(r)));return value;}).toList());
  }
  public Map<String,Object> enqueue(String tenant,String id,String actor,Request request){
    cases.allowWrite();var item=cases.require(tenant,id);
    if(!request.consent())throw fail(422,"Private analytics consent required");
    if(item.version()!=request.caseVersion())throw fail(409,"Source changed");
    if(!enabled||!store.persistent()||!ready())throw fail(503,"Local ETL worker is not ready");
    String runId="etl-"+request.requestId(),hash=research.fingerprint(item);
    var alias=store.find(tenant,id,"medallion-request",runId);
    if(alias.isPresent()){
      if(!hash.equals(alias.get().get("sourceHash")))throw fail(409,"Request ID already used for another snapshot");
      return store.find(tenant,id,"medallion-run",alias.get().get("actualId").toString()).orElseThrow(()->fail(409,"Original receipt unavailable"));
    }
    var previous=store.find(tenant,id,"medallion-run",runId);
    if(previous.isPresent()){if(!hash.equals(previous.get().get("sourceHash")))throw fail(409,"Request ID already used for another snapshot");return previous.get();}
    var reusable=store.list(tenant,id,"medallion-run").stream().filter(r->"COMPLETE".equals(r.get("status"))&&hash.equals(r.get("sourceHash"))&&currentMethod(r)).findFirst();
    if(reusable.isPresent()){
      store.insert(tenant,id,"medallion-request",runId,Map.of("id",runId,"actualId",reusable.get().get("id"),"sourceHash",hash,"time",Instant.now().toString()));
      var replay=new LinkedHashMap<>(reusable.get());replay.put("reused",true);return replay;
    }
    if(store.list(tenant,id,"medallion-run").stream().anyMatch(r->Set.of("QUEUED","RUNNING").contains(r.get("status"))))throw fail(409,"An analytics snapshot is already pending");
    var docs=DocumentResearch.originals(item);if(docs.isEmpty()||docs.size()>40)throw fail(422,"Select a dossier with one to forty analyzed originals");
    limits.reserve(tenant,actor,"local-etl",4);
    String scope=RagEngine.hash(tenant+"|"+id),time=Instant.now().toString();
    var input=new LinkedHashMap<String,Object>();input.put("format","document-etl-v1");input.put("id",runId);input.put("scope",scope);input.put("caseId",id);
    input.put("caseVersion",item.version());input.put("sourceHash",hash);input.put("time",time);input.put("domain",item.domain());
    input.put("documents",docs.stream().map(doc->{
      var value=store.decode(store.encode(doc));
      var hashes=store.database().queryForList("SELECT sha256 FROM lab_jobs WHERE tenant=? AND case_id=? AND document_id=? AND status='COMPLETE' ORDER BY created_at DESC LIMIT 1",tenant,id,doc.id());
      if(!hashes.isEmpty())value.put("originalSha256",hashes.getFirst().get("sha256"));
      return value;
    }).toList());
    String encoded=store.encode(input);if(encoded.length()>8_000_000)throw fail(413,"Analytics snapshot is too large");
    var job=new LinkedHashMap<String,Object>();job.put("id",runId);job.put("time",time);job.put("actor",actor);job.put("caseVersion",item.version());job.put("sourceHash",hash);
    job.put("status","QUEUED");job.put("errorCode","");job.put("scope",scope);job.put("inputHash",RagEngine.hash(encoded));
    if(!store.insert(tenant,id,"medallion-run",runId,job))return store.find(tenant,id,"medallion-run",runId).orElseThrow();
    try{Path directory=root.resolve("queue").resolve(scope);Files.createDirectories(directory);Path temporary=Files.createTempFile(directory,"snapshot-",".tmp");
      Files.writeString(temporary,encoded);Files.move(temporary,directory.resolve(runId+".input.json"),StandardCopyOption.ATOMIC_MOVE);
    }catch(Exception e){var failed=new LinkedHashMap<>(job);failed.put("status","FAILED");failed.put("errorCode","ETL_SPOOL_UNAVAILABLE");store.replace(tenant,id,"medallion-run",runId,job,failed);throw fail(503,"Private ETL spool unavailable");}
    return job;
  }
  static boolean currentMethod(Map<String,Object> run){return run.get("result") instanceof Map<?,?> result&&METHOD.equals(result.get("method"));}
  public byte[] artifact(String tenant,String caseId,String id,String layer){
    cases.require(tenant,caseId);
    if(!enabled||!id.matches("etl-[a-f0-9-]{36}")||!Set.of("bronze","silver","gold","document-facts","field-observations","invoice-lines","quality-findings").contains(layer))throw fail(404,"Artifact unavailable");
    var run=store.find(tenant,caseId,"medallion-run",id).orElseThrow(()->fail(404,"Artifact unavailable"));
    if(!"COMPLETE".equals(run.get("status")))throw fail(409,"Run has no published artifacts");
    String scope=RagEngine.hash(tenant+"|"+caseId);Path path=root.resolve("assets").resolve(scope).resolve(id).resolve(layer.replace('-','_')+".parquet");
    try{if(!Files.isRegularFile(path,LinkOption.NOFOLLOW_LINKS)||Files.size(path)>20_000_000)throw fail(404,"Artifact unavailable");return Files.readAllBytes(path);}
    catch(java.io.IOException e){throw fail(404,"Artifact unavailable");}
  }
  private boolean ready(){try{return enabled&&Files.isRegularFile(root.resolve("heartbeat"),LinkOption.NOFOLLOW_LINKS)&&Files.getLastModifiedTime(root.resolve("heartbeat")).toInstant().isAfter(Instant.now().minusSeconds(90));}catch(Exception e){return false;}}
  @Scheduled(fixedDelay=2500,initialDelay=10000)
  public void reconcile(){
    if(!enabled||!store.persistent())return;
    var rows=store.database().queryForList("SELECT tenant,case_id,id,payload FROM lab_records WHERE kind='medallion-run' AND payload::jsonb->>'status' IN ('QUEUED','RUNNING') ORDER BY created_at LIMIT 20");
    for(var row:rows){String tenant=row.get("tenant").toString(),caseId=row.get("case_id").toString(),id=row.get("id").toString();var previous=store.decode(row.get("payload").toString());
      if(!id.matches("etl-[a-f0-9-]{36}")||!previous.get("scope").toString().matches("[a-f0-9]{64}"))continue;
      Path result=root.resolve("queue").resolve(previous.get("scope").toString()).resolve(id+".result.json");
      try{
        if(!Files.isRegularFile(result,LinkOption.NOFOLLOW_LINKS)||Files.size(result)>2_000_000){
          if(Instant.parse(previous.get("time").toString()).isBefore(Instant.now().minusSeconds(600))){var expired=new LinkedHashMap<>(previous);expired.put("status","FAILED");expired.put("errorCode","ETL_TIMEOUT");store.replace(tenant,caseId,"medallion-run",id,previous,expired);}continue;
        }
        var receipt=store.decode(Files.readString(result));
        if(!id.equals(receipt.get("id"))||!previous.get("sourceHash").equals(receipt.get("sourceHash")))continue;
        var next=new LinkedHashMap<>(previous);next.put("finishedAt",receipt.get("finishedAt"));
        if(!research.fingerprint(cases.require(tenant,caseId)).equals(previous.get("sourceHash"))){next.put("status","STALE");next.put("errorCode","SOURCE_CHANGED");}
        else if("COMPLETE".equals(receipt.get("status"))){next.put("status","COMPLETE");next.put("result",receipt.get("result"));}
        else{next.put("status","FAILED");next.put("errorCode","ETL_VALIDATION_FAILED");}
        store.replace(tenant,caseId,"medallion-run",id,previous,next);
      }catch(Exception ignored){
        var failed=new LinkedHashMap<>(previous);failed.put("status","FAILED");failed.put("errorCode","ETL_RECEIPT_UNAVAILABLE");
        store.replace(tenant,caseId,"medallion-run",id,previous,failed);
      }
    }
  }
  private static ResponseStatusException fail(int code,String message){return new ResponseStatusException(HttpStatus.valueOf(code),message);}
}
