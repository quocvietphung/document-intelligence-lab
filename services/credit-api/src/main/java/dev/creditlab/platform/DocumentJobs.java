package dev.creditlab.platform;

import dev.creditlab.casework.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Durable bounded queue. Claiming is atomic across workers, leases recover after a restart. */
@Service
public class DocumentJobs {
  private final LabStore store;private final CreditCaseService cases;private final DocumentAnalysisService analysis;
  private final DocumentObjectStore objects;private final DocumentScanner scanner;private final DistributedLimits limits;
  private final int retention;private final boolean worker;
  private final RagEngine rag;
  public DocumentJobs(LabStore store,CreditCaseService cases,DocumentAnalysisService analysis,DocumentObjectStore objects,DocumentScanner scanner,DistributedLimits limits,RagEngine rag,
      @Value("${app.platform.retention-days:30}") int retention,@Value("${app.platform.worker-enabled:true}") boolean worker){
    this.store=store;this.cases=cases;this.analysis=analysis;this.objects=objects;this.scanner=scanner;this.limits=limits;this.rag=rag;this.retention=Math.max(1,Math.min(365,retention));this.worker=worker;
  }
  static String reviewStatus(CreditCase item,String documentId){return item.documents().stream().filter(d->d.id().equals(documentId)).map(CreditCase.Document::status).findFirst().orElse(null);}
  public List<Map<String,Object>> list(String tenant,String id){
    var item=cases.require(tenant,id);if(!store.persistent())return List.of();
    var events=new HashMap<String,List<Map<String,Object>>>();
    store.database().query("SELECT * FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY job_id ORDER BY id DESC) AS rn FROM lab_job_events WHERE tenant=? AND case_id=?) e WHERE rn<=30 ORDER BY id",r->{
      var event=new LinkedHashMap<String,Object>();event.put("id",r.getLong("id"));event.put("stage",r.getString("stage"));event.put("status",r.getString("status"));event.put("attempt",r.getInt("attempt"));event.put("errorCode",r.getString("error_code"));event.put("time",r.getTimestamp("occurred_at").toInstant().toString());
      events.computeIfAbsent(r.getString("job_id"),ignored->new ArrayList<>()).add(event);
    },tenant,id);
    return store.database().query("SELECT * FROM lab_jobs WHERE tenant=? AND case_id=? ORDER BY created_at DESC,id DESC LIMIT 30",(r,i)->{
    var v=new LinkedHashMap<String,Object>();for(String key:List.of("id","name","status","stage","document_id","scan_result","error_code","sha256"))v.put(key,r.getString(key));
    v.put("reviewStatus",reviewStatus(item,r.getString("document_id")));
    v.put("createdAt",r.getTimestamp("created_at").toInstant().toString());v.put("expiresAt",r.getTimestamp("expires_at").toInstant().toString());v.put("attempt",r.getInt("attempt"));
    v.put("updatedAt",r.getTimestamp("updated_at").toInstant().toString());
    v.put("finishedAt",r.getTimestamp("finished_at")==null?null:r.getTimestamp("finished_at").toInstant().toString());
    v.put("nextAttemptAt",r.getTimestamp("next_attempt_at")==null?null:r.getTimestamp("next_attempt_at").toInstant().toString());
    v.put("retryOf",r.getString("retry_of"));v.put("events",events.getOrDefault(r.getString("id"),List.of()));
    boolean unexpired=r.getTimestamp("expires_at").toInstant().isAfter(Instant.now());
    v.put("canCancel",unexpired&&Set.of("QUEUED","RETRY").contains(r.getString("status")));
    v.put("retryEligible",unexpired&&"FAILED".equals(r.getString("status"))&&retryableCode(r.getString("error_code"))&&ApprovedResearchSamples.matchesDigest(r.getString("name"),r.getString("sha256")));
    var doc=item.documents().stream().filter(d->d.id().equals(rString(v,"document_id"))).findFirst();
    v.put("extraction",doc.<Object>map(d->Map.of("type",d.type(),"provider",Objects.requireNonNullElse(d.analysisProvider(),"unknown"),"modelId",Objects.requireNonNullElse(d.modelId(),"unknown"),"pages",d.pages().size(),"fields",d.fields().size(),"tables",d.tables().size(),"textCharacters",d.pages().stream().mapToInt(p->p.text().length()).sum(),"originalAvailable",d.originalAvailable())).orElse(null));
    return v;},tenant,id);
  }
  private static String rString(Map<String,Object> row,String key){return Objects.toString(row.get(key),"");}
  public Map<String,Object> enqueue(String tenant,String id,String actor,String name,String type,byte[] bytes) {
    return enqueue(tenant,id,actor,name,type,bytes,null);
  }
  private Map<String,Object> enqueue(String tenant,String id,String actor,String name,String type,byte[] bytes,String retryOf) {
    cases.allowWrite();cases.require(tenant,id);if(bytes.length==0||bytes.length>3_000_000)throw fail(422,"Use a file between 1 byte and 3 MB");
    if(!name.toLowerCase(Locale.ROOT).matches(".*\\.(pdf|png|jpe?g|txt)$"))throw fail(422,"Unsupported file extension");
    if(name.toLowerCase(Locale.ROOT).endsWith(".txt")&&"azure".equals(analysis.status().get("mode")))throw fail(422,"Azure layout accepts PDF or image files, not plain text");
    limits.reserve(tenant,actor,"document-upload",12);
    String digest;try{digest=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(Exception e){throw new IllegalStateException(e);}
    var db=store.database();var duplicates=db.queryForList("SELECT id FROM lab_jobs WHERE tenant=? AND case_id=? AND sha256=? AND status NOT IN ('FAILED','EXPIRED','CANCELLED')",tenant,id,digest);
    if(!duplicates.isEmpty())throw fail(409,"Duplicate document already queued or processed");
    if(db.queryForObject("SELECT COUNT(*) FROM lab_jobs WHERE tenant=? AND status IN ('QUEUED','PROCESSING','RETRY')",Integer.class,tenant)>=12)throw fail(429,"Upload queue is full");
    String job="job-"+UUID.randomUUID(),key=RagEngine.hash(tenant+"|"+id)+"/"+job;objects.put(key,bytes);Instant now=Instant.now();
    try{db.update("INSERT INTO lab_jobs(id,tenant,case_id,actor,name,content_type,object_key,sha256,status,stage,created_at,updated_at,expires_at,retry_of) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",job,tenant,id,actor,name.replaceAll("[^\\p{L}\\p{N}._ -]","_").substring(0,Math.min(name.length(),120)),type,key,digest,"QUEUED","RECEIVED",ts(now),ts(now),ts(now.plus(retention,java.time.temporal.ChronoUnit.DAYS)),retryOf);}
    catch(org.springframework.dao.DuplicateKeyException e){objects.delete(key);throw fail(409,"Duplicate document already queued or processed");}
    catch(RuntimeException e){objects.delete(key);throw e;}
    return Map.of("id",job,"status","QUEUED","expiresAt",now.plus(retention,java.time.temporal.ChronoUnit.DAYS).toString());
  }
  static boolean retryableCode(String code){return Set.of("AZURE_AUTH_UNAVAILABLE","AZURE_ACCESS_DENIED","AZURE_SERVICE_UNAVAILABLE","ANALYSIS_HTTP_503","ANALYSIS_HTTP_429","PROCESSING_UNAVAILABLE","PROCESSING_CONFLICT","WORKER_ATTEMPTS_EXHAUSTED").contains(Objects.requireNonNullElse(code,""));}
  static boolean automaticRetry(String code,int attempt){return attempt<3&&Set.of("AZURE_SERVICE_UNAVAILABLE","ANALYSIS_HTTP_503","ANALYSIS_HTTP_429","PROCESSING_UNAVAILABLE","PROCESSING_CONFLICT").contains(code);}
  static int retryDelaySeconds(int attempt){return Math.min(120,30*(1<<Math.min(2,Math.max(0,attempt-1))));}
  public Map<String,Object> retry(String tenant,String id,String actor,String sourceJob) {
    cases.require(tenant,id);cases.allowWrite();
    var rows=store.database().queryForList("SELECT * FROM lab_jobs WHERE tenant=? AND case_id=? AND id=?",tenant,id,sourceJob);
    if(rows.isEmpty())throw fail(404,"Job unavailable");
    var row=rows.getFirst();
    if(!"FAILED".equals(row.get("status"))||!retryableCode((String)row.get("error_code")))throw fail(409,"This job cannot be retried");
    if(!((java.sql.Timestamp)row.get("expires_at")).toInstant().isAfter(Instant.now()))throw fail(410,"Stored file has expired");
    String name=(String)row.get("name");
    if(!ApprovedResearchSamples.matchesDigest(name,(String)row.get("sha256")))throw fail(403,"Only approved DATEV or Kaggle references may be retried");
    byte[] bytes=objects.read((String)row.get("object_key"));
    if(!ApprovedResearchSamples.matches(name,bytes))throw fail(403,"Stored reference no longer matches approved bytes");
    // A new bounded job preserves the failure history and repeats all scan checks.
    var result=new LinkedHashMap<String,Object>(enqueue(tenant,id,actor,name,(String)row.get("content_type"),bytes,sourceJob));
    // Resume a saved extraction after a later-stage failure, avoiding a second paid OCR call.
    store.find(tenant,id,"job-analysis",sourceJob).ifPresent(saved->store.insert(tenant,id,"job-analysis",result.get("id").toString(),Map.of("id",result.get("id"),"document",saved.get("document"))));
    result.put("retryOf",sourceJob);return result;
  }
  public Map<String,Object> cancel(String tenant,String id,String actor,String job){
    cases.require(tenant,id);cases.allowWrite();limits.reserve(tenant,actor,"document-cancel",12);
    var db=store.database();
    if(db.queryForList("SELECT id FROM lab_jobs WHERE tenant=? AND case_id=? AND id=?",tenant,id,job).isEmpty())throw fail(404,"Job unavailable");
    int changed=db.update("UPDATE lab_jobs SET status='CANCELLED',stage='CANCELLED',last_actor=?,next_attempt_at=NULL,finished_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE tenant=? AND case_id=? AND id=? AND status IN ('QUEUED','RETRY') AND expires_at>CURRENT_TIMESTAMP",actor,tenant,id,job);
    if(changed!=1)throw fail(409,"The worker already started or this job is not waiting");
    return Map.of("id",job,"status","CANCELLED");
  }
  static String errorCode(Exception error){
    if(error instanceof IllegalArgumentException)return Set.of("MALWARE_BLOCKED","ACTIVE_CONTENT_BLOCKED","INJECTION_QUARANTINED","SOURCE_INTEGRITY_FAILED").contains(Objects.requireNonNullElse(error.getMessage(),""))?error.getMessage():"DOCUMENT_REJECTED";
    if(error instanceof ResponseStatusException response){
      String reason=response.getReason();
      if(response.getStatusCode().value()==409)return "PROCESSING_CONFLICT";
      if(Set.of("AZURE_AUTH_UNAVAILABLE","AZURE_ACCESS_DENIED","AZURE_SERVICE_UNAVAILABLE").contains(Objects.requireNonNullElse(reason,"")))return reason;
      return "ANALYSIS_HTTP_"+response.getStatusCode().value();
    }
    return "PROCESSING_UNAVAILABLE";
  }
  @Scheduled(fixedDelay=3000,initialDelay=10000)
  public void work() {
    if(!worker||!store.persistent())return;var db=store.database();
    db.update("UPDATE lab_jobs SET status='FAILED',stage='STOPPED',error_code='WORKER_ATTEMPTS_EXHAUSTED',finished_at=CURRENT_TIMESTAMP WHERE status='PROCESSING' AND attempt>=3 AND updated_at<CURRENT_TIMESTAMP-INTERVAL '5 minutes'");
    var rows=db.queryForList("UPDATE lab_jobs SET status='PROCESSING',stage='SCAN',updated_at=CURRENT_TIMESTAMP,next_attempt_at=NULL,attempt=attempt+1 WHERE id=(SELECT id FROM lab_jobs WHERE expires_at>CURRENT_TIMESTAMP AND (status='QUEUED' OR (status='RETRY' AND (next_attempt_at IS NULL OR next_attempt_at<=CURRENT_TIMESTAMP)) OR (status='PROCESSING' AND updated_at<CURRENT_TIMESTAMP-INTERVAL '5 minutes')) AND attempt<3 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *");
    if(rows.isEmpty())return;var row=rows.getFirst();String job=(String)row.get("id"),tenant=(String)row.get("tenant"),id=(String)row.get("case_id"),actor=(String)row.get("actor"),object=(String)row.get("object_key");
    try {
      int lease=((Number)row.get("attempt")).intValue();
      byte[] bytes=objects.read(object);
      if(!HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)).equals(row.get("sha256")))throw new IllegalArgumentException("SOURCE_INTEGRITY_FAILED");
      String scan=scanner.scan(bytes);
      if(!owns(job,tenant,id,lease))return;
      if(db.update("UPDATE lab_jobs SET stage='EXTRACT',scan_result=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant=? AND case_id=? AND attempt=? AND status='PROCESSING'",scan,job,tenant,id,lease)!=1)return;
      var saved=store.find(tenant,id,"job-analysis",job);
      CreditCase.Document document;
      if(saved.isPresent()){
        if(!stage(job,tenant,id,lease,"REUSE_EXTRACTION"))return;
        document=new com.fasterxml.jackson.databind.ObjectMapper().readValue((String)saved.get().get("document"),CreditCase.Document.class);
      } else {
        document=analysis.analyze((String)row.get("name"),(String)row.get("content_type"),bytes);
        if(!owns(job,tenant,id,lease))return;
        store.insert(tenant,id,"job-analysis",job,Map.of("id",job,"document",store.encode(document)));
        document=new com.fasterxml.jackson.databind.ObjectMapper().readValue((String)store.find(tenant,id,"job-analysis",job).orElseThrow().get("document"),CreditCase.Document.class);
      }
      if(!stage(job,tenant,id,lease,"VALIDATE"))return;
      if(document.pages().stream().anyMatch(p->EvidenceGuard.suspicious(p.text())))throw new IllegalArgumentException("INJECTION_QUARANTINED");
      if(!stage(job,tenant,id,lease,"ATTACH"))return;
      boolean attached=false;
      for(int attempt=0;attempt<3&&!attached;attempt++) {
        var current=cases.require(tenant,id);String docId=document.id();
        if(current.documents().stream().anyMatch(d->d.id().equals(docId))){attached=true;break;}
        try{cases.attach(tenant,id,actor,bytes,document,current.version());attached=true;}catch(ResponseStatusException e){if(e.getStatusCode().value()!=409)throw e;}
      }
      if(!attached)throw fail(409,"Concurrent document update");
      db.update("UPDATE lab_jobs SET status='COMPLETE',stage='HUMAN_REVIEW',document_id=?,error_code=NULL,finished_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant=? AND case_id=? AND attempt=? AND status='PROCESSING'",document.id(),job,tenant,id,lease);
    } catch(Exception error) {
      String code=errorCode(error);
      int lease=((Number)row.get("attempt")).intValue();boolean retry=automaticRetry(code,lease);
      db.update("UPDATE lab_jobs SET status=?,stage='STOPPED',error_code=?,next_attempt_at=?,finished_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant=? AND case_id=? AND attempt=? AND status='PROCESSING'",retry?"RETRY":"FAILED",code,retry?ts(Instant.now().plusSeconds(retryDelaySeconds(lease))):null,retry?null:ts(Instant.now()),job,tenant,id,lease);
    }
  }
  private boolean stage(String job,String tenant,String id,int attempt,String stage){return store.database().update("UPDATE lab_jobs SET stage=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant=? AND case_id=? AND attempt=? AND status='PROCESSING'",stage,job,tenant,id,attempt)==1;}
  private boolean owns(String job,String tenant,String id,int attempt){return !store.database().queryForList("SELECT id FROM lab_jobs WHERE id=? AND tenant=? AND case_id=? AND attempt=? AND status='PROCESSING'",job,tenant,id,attempt).isEmpty();}
  public Map<String,Object> status(){return Map.of("worker",worker,"persistent",store.persistent(),"storage",objects.mode(),"scanner",scanner.mode(),"retentionDays",retention,"provider",analysis.status());}
  @Scheduled(fixedDelay=3600000,initialDelay=60000)
  public void expire() {
    if(!worker||!store.persistent())return;
    var db=store.database();var rows=db.queryForList("SELECT * FROM lab_jobs WHERE expires_at<CURRENT_TIMESTAMP AND status IN ('COMPLETE','FAILED','RETRY','QUEUED','CANCELLED') LIMIT 20");
    for(var row:rows)try{
      String tenant=(String)row.get("tenant"),id=(String)row.get("case_id"),job=(String)row.get("id");
      // Clear vector evidence before removing source data. A failed cleanup is retried, never marked successful.
      rag.invalidate(cases.require(tenant,id));
      if(row.get("document_id")!=null)cases.expirePipelineDocument(tenant,id,(String)row.get("document_id"));
      objects.delete((String)row.get("object_key"));
      db.update("DELETE FROM lab_records WHERE tenant=? AND case_id=? AND kind='job-analysis' AND id=?",tenant,id,job);
      db.update("UPDATE lab_jobs SET status='EXPIRED',stage='PURGED',updated_at=CURRENT_TIMESTAMP WHERE id=?",job);
    }catch(RuntimeException e){ /* retry next cycle; avoid logging document contents */ }
  }
  private java.sql.Timestamp ts(Instant i){return java.sql.Timestamp.from(i);}
  private ResponseStatusException fail(int code,String text){return new ResponseStatusException(HttpStatus.valueOf(code),text);}
}
