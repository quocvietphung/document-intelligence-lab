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
  public List<Map<String,Object>> list(String tenant,String id){var item=cases.require(tenant,id);if(!store.persistent())return List.of();return store.database().query("SELECT * FROM lab_jobs WHERE tenant=? AND case_id=? ORDER BY created_at DESC LIMIT 30",(r,i)->{
    var v=new LinkedHashMap<String,Object>();for(String key:List.of("id","name","status","stage","document_id","scan_result","error_code","sha256"))v.put(key,r.getString(key));
    v.put("reviewStatus",reviewStatus(item,r.getString("document_id")));
    v.put("createdAt",r.getTimestamp("created_at").toInstant().toString());v.put("expiresAt",r.getTimestamp("expires_at").toInstant().toString());v.put("attempt",r.getInt("attempt"));return v;},tenant,id);}
  public Map<String,Object> enqueue(String tenant,String id,String actor,String name,String type,byte[] bytes) {
    cases.allowWrite();cases.require(tenant,id);if(bytes.length==0||bytes.length>3_000_000)throw fail(422,"Use a file between 1 byte and 3 MB");
    if(!name.toLowerCase(Locale.ROOT).matches(".*\\.(pdf|png|jpe?g|txt)$"))throw fail(422,"Unsupported file extension");
    if(name.toLowerCase(Locale.ROOT).endsWith(".txt")&&"azure".equals(analysis.status().get("mode")))throw fail(422,"Azure layout accepts PDF or image files, not plain text");
    limits.reserve(tenant,actor,"document-upload",12);
    String digest;try{digest=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(Exception e){throw new IllegalStateException(e);}
    var db=store.database();var duplicates=db.queryForList("SELECT id FROM lab_jobs WHERE tenant=? AND case_id=? AND sha256=? AND status NOT IN ('FAILED','EXPIRED')",tenant,id,digest);
    if(!duplicates.isEmpty())throw fail(409,"Duplicate document already queued or processed");
    if(db.queryForObject("SELECT COUNT(*) FROM lab_jobs WHERE tenant=? AND status IN ('QUEUED','PROCESSING','RETRY')",Integer.class,tenant)>=12)throw fail(429,"Upload queue is full");
    String job="job-"+UUID.randomUUID(),key=RagEngine.hash(tenant+"|"+id)+"/"+job;objects.put(key,bytes);Instant now=Instant.now();
    try{db.update("INSERT INTO lab_jobs(id,tenant,case_id,actor,name,content_type,object_key,sha256,status,stage,created_at,updated_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",job,tenant,id,actor,name.replaceAll("[^\\p{L}\\p{N}._ -]","_").substring(0,Math.min(name.length(),120)),type,key,digest,"QUEUED","SCAN",ts(now),ts(now),ts(now.plus(retention,java.time.temporal.ChronoUnit.DAYS)));}
    catch(org.springframework.dao.DuplicateKeyException e){objects.delete(key);throw fail(409,"Duplicate document already queued or processed");}
    catch(RuntimeException e){objects.delete(key);throw e;}
    return Map.of("id",job,"status","QUEUED","expiresAt",now.plus(retention,java.time.temporal.ChronoUnit.DAYS).toString());
  }
  static boolean retryableCode(String code){return Set.of("AZURE_AUTH_UNAVAILABLE","AZURE_ACCESS_DENIED","AZURE_SERVICE_UNAVAILABLE","ANALYSIS_HTTP_503","ANALYSIS_HTTP_429","PROCESSING_UNAVAILABLE").contains(Objects.requireNonNullElse(code,""));}
  public Map<String,Object> retry(String tenant,String id,String actor,String sourceJob) {
    cases.require(tenant,id);cases.allowWrite();
    var rows=store.database().queryForList("SELECT * FROM lab_jobs WHERE tenant=? AND case_id=? AND id=?",tenant,id,sourceJob);
    if(rows.isEmpty())throw fail(404,"Job unavailable");
    var row=rows.getFirst();
    if(!"FAILED".equals(row.get("status"))||!retryableCode((String)row.get("error_code")))throw fail(409,"This job cannot be retried");
    if(!((java.sql.Timestamp)row.get("expires_at")).toInstant().isAfter(Instant.now()))throw fail(410,"Stored file has expired");
    String name=(String)row.get("name");
    if(!ApprovedDatevSamples.matchesDigest(name,(String)row.get("sha256")))throw fail(403,"Only approved DATEV references may be retried");
    byte[] bytes=objects.read((String)row.get("object_key"));
    if(!ApprovedDatevSamples.matches(name,bytes))throw fail(403,"Stored reference no longer matches approved bytes");
    // A new bounded job preserves the failure history and repeats all scan checks.
    var result=new LinkedHashMap<String,Object>(enqueue(tenant,id,actor,name,(String)row.get("content_type"),bytes));
    result.put("retryOf",sourceJob);return result;
  }
  static String errorCode(Exception error){
    if(error instanceof IllegalArgumentException)return Set.of("MALWARE_BLOCKED","ACTIVE_CONTENT_BLOCKED","INJECTION_QUARANTINED").contains(Objects.requireNonNullElse(error.getMessage(),""))?error.getMessage():"DOCUMENT_REJECTED";
    if(error instanceof ResponseStatusException response){
      String reason=response.getReason();
      if(Set.of("AZURE_AUTH_UNAVAILABLE","AZURE_ACCESS_DENIED","AZURE_SERVICE_UNAVAILABLE").contains(Objects.requireNonNullElse(reason,"")))return reason;
      return "ANALYSIS_HTTP_"+response.getStatusCode().value();
    }
    return "PROCESSING_UNAVAILABLE";
  }
  @Scheduled(fixedDelay=3000,initialDelay=10000)
  public void work() {
    if(!worker||!store.persistent())return;var db=store.database();
    db.update("UPDATE lab_jobs SET status='FAILED',stage='STOPPED',error_code='WORKER_ATTEMPTS_EXHAUSTED' WHERE status='PROCESSING' AND attempt>=3 AND updated_at<CURRENT_TIMESTAMP-INTERVAL '5 minutes'");
    var rows=db.queryForList("UPDATE lab_jobs SET status='PROCESSING',updated_at=CURRENT_TIMESTAMP,attempt=attempt+1 WHERE id=(SELECT id FROM lab_jobs WHERE (status='QUEUED' OR (status='RETRY' AND updated_at<CURRENT_TIMESTAMP-INTERVAL '30 seconds') OR (status='PROCESSING' AND updated_at<CURRENT_TIMESTAMP-INTERVAL '5 minutes')) AND attempt<3 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *");
    if(rows.isEmpty())return;var row=rows.getFirst();String job=(String)row.get("id"),tenant=(String)row.get("tenant"),id=(String)row.get("case_id"),actor=(String)row.get("actor"),object=(String)row.get("object_key");
    try {
      byte[] bytes=objects.read(object);String scan=scanner.scan(bytes);db.update("UPDATE lab_jobs SET stage='EXTRACT',scan_result=? WHERE id=?",scan,job);
      var saved=store.find(tenant,id,"job-analysis",job);
      CreditCase.Document document;
      if(saved.isPresent())document=new com.fasterxml.jackson.databind.ObjectMapper().readValue((String)saved.get().get("document"),CreditCase.Document.class);
      else {document=analysis.analyze((String)row.get("name"),(String)row.get("content_type"),bytes);store.save(tenant,id,"job-analysis",job,Map.of("id",job,"document",store.encode(document)));}
      if(document.pages().stream().anyMatch(p->EvidenceGuard.suspicious(p.text())))throw new IllegalArgumentException("INJECTION_QUARANTINED");
      db.update("UPDATE lab_jobs SET stage='ATTACH' WHERE id=?",job);
      boolean attached=false;
      for(int attempt=0;attempt<3&&!attached;attempt++) {
        var current=cases.require(tenant,id);String docId=document.id();
        if(current.documents().stream().anyMatch(d->d.id().equals(docId))){attached=true;break;}
        try{cases.attach(tenant,id,actor,bytes,document,current.version());attached=true;}catch(ResponseStatusException e){if(e.getStatusCode().value()!=409)throw e;}
      }
      if(!attached)throw fail(409,"Concurrent document update");
      db.update("UPDATE lab_jobs SET status='COMPLETE',stage='HUMAN_REVIEW',document_id=?,error_code=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",document.id(),job);
    } catch(Exception error) {
      boolean retry=!(error instanceof IllegalArgumentException)&&((Number)row.get("attempt")).intValue()<3;
      String code=errorCode(error);
      db.update("UPDATE lab_jobs SET status=?,stage='STOPPED',error_code=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",retry?"RETRY":"FAILED",code,job);
    }
  }
  public Map<String,Object> status(){return Map.of("worker",worker,"persistent",store.persistent(),"storage",objects.mode(),"scanner",scanner.mode(),"retentionDays",retention,"provider",analysis.status());}
  @Scheduled(fixedDelay=3600000,initialDelay=60000)
  public void expire() {
    if(!worker||!store.persistent())return;
    var db=store.database();var rows=db.queryForList("SELECT * FROM lab_jobs WHERE expires_at<CURRENT_TIMESTAMP AND status IN ('COMPLETE','FAILED','RETRY','QUEUED') LIMIT 20");
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
