package dev.creditlab.platform;

import dev.creditlab.casework.CreditCaseService;
import jakarta.validation.constraints.*;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/** Versioned findings and explicit cohort experiments. No finding changes source approval. */
@Service
public class DocumentAnalytics {
  public record Request(@NotNull UUID requestId,@Min(0) long caseVersion,@NotBlank @Pattern(regexp="etl-[a-f0-9-]{36}") String etlRunId,@AssertTrue boolean consent) {}
  public record Review(@NotNull UUID requestId,@Min(0) long caseVersion,@NotBlank @Pattern(regexp="(?:etl|ml)-[a-f0-9-]{36}") String runId,
      @NotBlank @Pattern(regexp="[a-f0-9]{24}") String findingId,@Pattern(regexp="CONFIRMED|DISMISSED") @NotNull String state,@NotBlank @Size(max=1000) String note) {}
  private final CreditCaseService cases;private final LabStore store;private final DocumentResearch research;private final DistributedLimits limits;
  private final Path root,etlRoot;private final boolean enabled;
  public DocumentAnalytics(CreditCaseService cases,LabStore store,DocumentResearch research,DistributedLimits limits,
      @Value("${app.platform.analytics-enabled:false}") boolean enabled,@Value("${app.platform.analytics-root:/app/analytics}") String root,
      @Value("${app.platform.etl-root:/app/etl}") String etlRoot){
    this.cases=cases;this.store=store;this.research=research;this.limits=limits;this.enabled=enabled;
    this.root=Path.of(root).toAbsolutePath().normalize();this.etlRoot=Path.of(etlRoot).toAbsolutePath().normalize();
  }
  private boolean ready(){try{return enabled&&Files.isRegularFile(root.resolve("heartbeat"),LinkOption.NOFOLLOW_LINKS)&&Files.getLastModifiedTime(root.resolve("heartbeat")).toInstant().isAfter(Instant.now().minusSeconds(90));}catch(Exception e){return false;}}
  private Optional<Map<String,Object>> currentEtl(String tenant,String id,String hash){return store.list(tenant,id,"medallion-run").stream()
      .filter(r->"COMPLETE".equals(r.get("status"))&&hash.equals(r.get("sourceHash"))&&LocalDataPipeline.currentMethod(r)).findFirst();}
  @SuppressWarnings("unchecked") static Map<String,Object> object(Object value){return value instanceof Map<?,?>?(Map<String,Object>)value:Map.of();}
  @SuppressWarnings("unchecked") static List<Map<String,Object>> rows(Object value){return value instanceof List<?>?(List<Map<String,Object>>)value:List.of();}
  public Map<String,Object> read(String tenant,String id){
    var item=cases.require(tenant,id);String hash=research.fingerprint(item);var report=currentEtl(tenant,id,hash).orElse(null);
    if(report!=null&&store.persistent())project(tenant,id,report,object(object(report.get("result")).get("analytics")),((Number)report.get("caseVersion")).longValue());
    var response=new LinkedHashMap<String,Object>();response.put("caseId",id);response.put("caseVersion",item.version());response.put("sourceHash",hash);
    response.put("enabled",enabled);response.put("workerReady",ready());response.put("cloudCalls",0);response.put("report",report);
    response.put("experiments",store.list(tenant,id,"cohort-run").stream().map(r->{var copy=new LinkedHashMap<>(r);copy.put("current",hash.equals(r.get("sourceHash")));return copy;}).toList());
    response.put("reviews",store.persistent()?store.database().queryForList("SELECT request_id,run_id,finding_id,state,note,actor,created_at FROM document_analytics_reviews WHERE tenant=? AND case_id=? ORDER BY created_at DESC LIMIT 100",tenant,id):List.of());
    return response;
  }
  private void project(String tenant,String id,Map<String,Object> run,Map<String,Object> result,long version){
    if(result.isEmpty())return;var db=store.database();String runId=run.get("id").toString();
    new TransactionTemplate(new DataSourceTransactionManager(Objects.requireNonNull(db.getDataSource()))).executeWithoutResult(tx->{
      if(!db.queryForList("SELECT id FROM document_analytics_runs WHERE tenant=? AND case_id=? AND id=?",tenant,id,runId).isEmpty())return;
      int inserted=db.update("INSERT INTO document_analytics_runs(tenant,case_id,id,case_version,source_hash,method,created_at,payload) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
          tenant,id,runId,version,run.get("sourceHash"),Objects.toString(result.getOrDefault("method",result.get("schemaVersion"))),java.sql.Timestamp.from(Instant.now()),store.encode(result));
      if(inserted==0)return;
      for(var f:rows(result.get("findings")))db.update("INSERT INTO document_analytics_findings(tenant,case_id,run_id,id,document_id,page,field_key,code,category,source_ids) VALUES(?,?,?,?,?,?,?,?,?,?)",
          tenant,id,runId,f.get("id"),f.get("documentId"),f.get("page"),f.get("field"),f.get("code"),f.get("category"),store.encode(f.get("sourceIds")));
    });
  }
  public Map<String,Object> enqueue(String tenant,String id,String actor,Request request){
    cases.allowWrite();var item=cases.require(tenant,id);String hash=research.fingerprint(item),runId="ml-"+request.requestId();
    if(!request.consent())throw fail(422,"Private cohort experiment consent required");
    if(item.version()!=request.caseVersion())throw fail(409,"Source changed");
    var prior=store.find(tenant,id,"cohort-run",runId);
    if(prior.isPresent()){
      if(!hash.equals(prior.get().get("sourceHash"))||!request.etlRunId().equals(prior.get().get("etlRunId")))throw fail(409,"Request ID already used for different data");return prior.get();
    }
    if(!store.persistent()||!ready())throw fail(503,"Optional analytics worker unavailable");
    var etl=currentEtl(tenant,id,hash).filter(r->request.etlRunId().equals(r.get("id"))).orElseThrow(()->fail(409,"Build current data layers first"));
    if(store.list(tenant,id,"cohort-run").stream().anyMatch(r->"QUEUED".equals(r.get("status"))))throw fail(409,"A cohort experiment is pending");
    String scope=RagEngine.hash(tenant+"|"+id),checksum;
    try{Path manifest=etlRoot.resolve("assets").resolve(scope).resolve(request.etlRunId()).resolve("manifest.json");
      if(!Files.isRegularFile(manifest,LinkOption.NOFOLLOW_LINKS)||Files.size(manifest)>500000)throw new IllegalStateException();checksum=RagEngine.hash(Files.readString(manifest));
    }catch(Exception e){throw fail(409,"Current analytical manifest unavailable");}
    limits.reserve(tenant,actor,"cohort-experiment",4);
    var input=new LinkedHashMap<String,Object>();input.put("id",runId);input.put("format","document-cohort-v1");input.put("scope",scope);input.put("etlRunId",etl.get("id"));input.put("sourceHash",hash);input.put("manifestSha256",checksum);
    var run=new LinkedHashMap<>(input);run.put("actor",actor);run.put("time",Instant.now().toString());run.put("status","QUEUED");run.put("caseVersion",item.version());
    if(!store.insert(tenant,id,"cohort-run",runId,run)){
      var existing=store.find(tenant,id,"cohort-run",runId).orElseThrow();
      if(!hash.equals(existing.get("sourceHash"))||!request.etlRunId().equals(existing.get("etlRunId")))throw fail(409,"Request ID already used for different data");return existing;
    }
    try{Path directory=root.resolve("queue").resolve(scope);Files.createDirectories(directory);Path temp=Files.createTempFile(directory,"cohort-",".tmp");Files.writeString(temp,store.encode(input));Files.move(temp,directory.resolve(runId+".input.json"),StandardCopyOption.ATOMIC_MOVE);}
    catch(Exception e){var next=new LinkedHashMap<>(run);next.put("status","FAILED");next.put("errorCode","ANALYTICS_SPOOL_UNAVAILABLE");store.replace(tenant,id,"cohort-run",runId,run,next);throw fail(503,"Analytics spool unavailable");}
    return run;
  }
  public Map<String,Object> review(String tenant,String id,String actor,Review request){
    cases.allowWrite();var item=cases.require(tenant,id);if(item.version()!=request.caseVersion())throw fail(409,"Source changed");
    if(!store.persistent())throw fail(503,"Persistent storage required");String hash=research.fingerprint(item);var db=store.database();
    var finding=db.queryForList("SELECT f.id FROM document_analytics_findings f JOIN document_analytics_runs r ON r.tenant=f.tenant AND r.case_id=f.case_id AND r.id=f.run_id WHERE f.tenant=? AND f.case_id=? AND f.run_id=? AND f.id=? AND r.source_hash=?",tenant,id,request.runId(),request.findingId(),hash);
    if(finding.isEmpty())throw fail(409,"Finding unavailable or source changed");
    String requestId=request.requestId().toString(),note=request.note().strip();
    db.update("INSERT INTO document_analytics_reviews(tenant,case_id,request_id,run_id,finding_id,state,note,actor,created_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",tenant,id,requestId,request.runId(),request.findingId(),request.state(),note,actor,java.sql.Timestamp.from(Instant.now()));
    var p=db.queryForMap("SELECT run_id,finding_id,state,note,actor FROM document_analytics_reviews WHERE tenant=? AND case_id=? AND request_id=?",tenant,id,requestId);
    if(!request.runId().equals(p.get("run_id"))||!request.findingId().equals(p.get("finding_id"))||!request.state().equals(p.get("state"))||!note.equals(p.get("note"))||!actor.equals(p.get("actor")))throw fail(409,"Review ID already used");
    return Map.of("id",requestId,"state",request.state(),"documentApprovalChanged",false);
  }
  @Scheduled(fixedDelay=2500,initialDelay=10000)
  public void reconcile(){
    if(!enabled||!store.persistent())return;
    for(var row:store.database().queryForList("SELECT tenant,case_id,id,payload FROM lab_records WHERE kind='cohort-run' AND payload::jsonb->>'status'='QUEUED' ORDER BY created_at LIMIT 20")){
      String tenant=row.get("tenant").toString(),id=row.get("case_id").toString(),runId=row.get("id").toString();var before=store.decode(row.get("payload").toString());
      if(!runId.matches("ml-[a-f0-9-]{36}"))continue;var after=new LinkedHashMap<>(before);
      try{Path result=root.resolve("queue").resolve(RagEngine.hash(tenant+"|"+id)).resolve(runId+".result.json");
        if(!Files.isRegularFile(result,LinkOption.NOFOLLOW_LINKS)){
          if(Instant.parse(before.get("time").toString()).isAfter(Instant.now().minusSeconds(600)))continue;after.put("status","FAILED");after.put("errorCode","ANALYTICS_TIMEOUT");
        }else{
          if(Files.size(result)>2000000)throw new IllegalStateException();var receipt=store.decode(Files.readString(result));
          if(!runId.equals(receipt.get("id"))||!before.get("sourceHash").equals(receipt.get("sourceHash")))throw new IllegalStateException();
          boolean current=research.fingerprint(cases.require(tenant,id)).equals(before.get("sourceHash"));
          after.put("status",current?receipt.get("status"):"STALE");after.put("finishedAt",receipt.get("finishedAt"));
          if("COMPLETE".equals(receipt.get("status"))){var output=object(receipt.get("result"));
            if(!before.get("sourceHash").equals(output.get("sourceHash"))||!before.get("manifestSha256").equals(output.get("manifestSha256"))||!before.get("etlRunId").equals(output.get("etlRunId"))||!"isolation-forest-heldout-v1".equals(output.get("method")))throw new IllegalStateException();
            after.put("result",output);project(tenant,id,after,output,((Number)before.get("caseVersion")).longValue());
          }else after.put("errorCode","COHORT_EVALUATION_FAILED");
        }
      }catch(Exception e){after.put("status","FAILED");after.put("errorCode","ANALYTICS_RECEIPT_UNAVAILABLE");}
      store.replace(tenant,id,"cohort-run",runId,before,after);
    }
  }
  private static ResponseStatusException fail(int code,String message){return new ResponseStatusException(HttpStatus.valueOf(code),message);}
}
