package dev.creditlab.platform;

import dev.creditlab.casework.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** A durable intake receipt, not an OCR engine or an exactly-once inference guarantee. */
@Service
public class DocumentBatches {
  private final LabStore store; private final CreditCaseService cases; private final DocumentJobs jobs;
  public DocumentBatches(LabStore store,CreditCaseService cases,DocumentJobs jobs){this.store=store;this.cases=cases;this.jobs=jobs;}
  public record Input(String name,String contentType,byte[] bytes) {}
  static final Map<String,List<String>> PROFILES=Map.of("general",List.of(),"invoice",List.of("invoiceNumber","invoiceTotal"),"payroll",List.of("netIncome","payoutAmount"),"insurance-wording",List.of());
  static String hash(byte[] bytes){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(Exception e){throw new IllegalStateException(e);}}
  private static String text(String value,int max){if(value==null||value.isBlank()||value.length()>max||value.chars().anyMatch(Character::isISOControl))throw fail(422,"Invalid batch metadata");return value.strip();}
  static void validate(List<Input> files){
    if(files==null||files.isEmpty()||files.size()>4)throw fail(422,"Select one to four files");
    for(var f:files)if(f.bytes()==null||f.bytes().length==0||f.bytes().length>3_000_000||f.name()==null||!f.name().toLowerCase(Locale.ROOT).matches(".*\\.(pdf|png|jpe?g|txt)$"))throw fail(422,"Use supported files, each at most 3 MB");
  }
  public Map<String,Object> submit(String tenant,String caseId,String actor,String requestId,String name,String source,String profile,List<Input> files){
    cases.allowWrite();cases.require(tenant,caseId);
    if(!store.persistent())throw fail(503,"Persistent storage required");
    if(requestId==null||!requestId.matches("[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}"))throw fail(422,"Invalid request ID");
    validate(files);name=text(name,100);source=text(source,160);
    if(!PROFILES.containsKey(profile))throw fail(422,"Unknown extraction profile");
    String batchId="batch-"+requestId;
    var items=new ArrayList<Map<String,Object>>();
    for(var file:files){var entry=new LinkedHashMap<String,Object>();entry.put("name",file.name().replaceAll("[^\\p{L}\\p{N}._ -]","_").substring(0,Math.min(120,file.name().length())));entry.put("sha256",hash(file.bytes()));entry.put("size",file.bytes().length);entry.put("state","NOT_SUBMITTED");items.add(entry);}
    String fingerprint=hash(store.encode(List.of(name,source,profile,items.stream().map(e->List.of(e.get("name"),e.get("sha256"),e.get("size"))).toList())).getBytes(StandardCharsets.UTF_8));
    var previous=store.find(tenant,caseId,"document-batch",batchId);
    if(previous.isPresent())return replay(previous.get(),fingerprint,tenant,caseId);
    var batch=new LinkedHashMap<String,Object>();batch.put("id",batchId);batch.put("name",name);batch.put("source",source);batch.put("profile",profile);batch.put("profileVersion","field-checks-v1");batch.put("actor",actor);batch.put("time",Instant.now().toString());batch.put("state","SUBMITTING");batch.put("items",items);batch.put("manifestHash",fingerprint);batch.put("persistent",true);
    if(!store.insert(tenant,caseId,"document-batch",batchId,batch))return replay(store.find(tenant,caseId,"document-batch",batchId).orElseThrow(),fingerprint,tenant,caseId);
    // Only the intake owner enqueues. A repeated HTTP request receives the same receipt.
    for(int i=0;i<files.size();i++){
      var file=files.get(i);var entry=items.get(i);
      try{var result=jobs.enqueue(tenant,caseId,actor,file.name(),file.contentType(),file.bytes());entry.put("jobId",result.get("id"));entry.put("state","ACCEPTED");}
      catch(ResponseStatusException e){int code=e.getStatusCode().value();entry.put("state",code==409?"DUPLICATE":"REJECTED");entry.put("errorCode",code==409?"DUPLICATE":code==429?"QUEUE_OR_RATE_LIMIT":code==422?"INVALID_FILE":"INTAKE_UNAVAILABLE");
        if(code==409){var existing=store.database().queryForList("SELECT id FROM lab_jobs WHERE tenant=? AND case_id=? AND sha256=? AND status NOT IN ('FAILED','EXPIRED','CANCELLED') ORDER BY created_at DESC LIMIT 1",tenant,caseId,entry.get("sha256"));if(!existing.isEmpty())entry.put("jobId",existing.getFirst().get("id"));}
      }
      catch(RuntimeException e){entry.put("state","REJECTED");entry.put("errorCode","INTAKE_UNAVAILABLE");}
      persist(tenant,caseId,batchId,batch);
    }
    batch.put("state","SUBMITTED");persist(tenant,caseId,batchId,batch);
    return enrich(tenant,caseId,batch);
  }
  private Map<String,Object> replay(Map<String,Object> batch,String hash,String tenant,String id){if(!hash.equals(batch.get("manifestHash")))throw fail(409,"Request ID already used with different content");return enrich(tenant,id,batch);}
  private void persist(String tenant,String caseId,String id,Map<String,Object> batch){if(store.database().update("UPDATE lab_records SET payload=? WHERE tenant=? AND case_id=? AND kind='document-batch' AND id=?",store.encode(batch),tenant,caseId,id)!=1)throw fail(409,"Batch receipt unavailable");}
  public Map<String,Object> list(String tenant,String id){cases.require(tenant,id);return Map.of("batches",store.list(tenant,id,"document-batch").stream().map(b->enrich(tenant,id,b)).toList(),"adfConnected",false,"cloudIngestionConnected",false);}
  @SuppressWarnings("unchecked")
  private Map<String,Object> enrich(String tenant,String id,Map<String,Object> original){
    var batch=new LinkedHashMap<>(original);var item=cases.require(tenant,id);var result=new ArrayList<Map<String,Object>>();
    for(var stored:(List<Map<String,Object>>)original.get("items")){
      var entry=new LinkedHashMap<>(stored);Object jobId=entry.get("jobId");
      if(jobId!=null&&store.persistent()){
        var rows=store.database().queryForList("SELECT id,status,document_id FROM lab_jobs WHERE tenant=? AND case_id=? AND id=?",tenant,id,jobId);
        if(!rows.isEmpty()){var current=rows.getFirst();
          // Follow explicit retry links, never another unrelated same-name submission.
          for(int depth=0;depth<10;depth++){var next=store.database().queryForList("SELECT id,status,document_id FROM lab_jobs WHERE tenant=? AND case_id=? AND retry_of=? ORDER BY created_at DESC LIMIT 1",tenant,id,current.get("id"));if(next.isEmpty())break;current=next.getFirst();}
          final var job=current;entry.put("currentJobId",job.get("id"));entry.put("status",job.get("status"));entry.put("documentId",job.get("document_id"));
          item.documents().stream().filter(d->d.id().equals(job.get("document_id"))).findFirst().ifPresent(doc->{
            entry.put("reviewStatus",doc.status());entry.put("missingFields",missingFields(original.get("profile").toString(),doc));entry.put("profileMismatch",mismatch(original.get("profile").toString(),doc.type()));
          });
        }
      }
      result.add(entry);
    }
    if("SUBMITTING".equals(original.get("state"))&&Instant.parse(original.get("time").toString()).isBefore(Instant.now().minusSeconds(300)))batch.put("state","INTERRUPTED");
    batch.put("items",result);return batch;
  }
  static List<String> missingFields(String profile,CreditCase.Document doc){return PROFILES.getOrDefault(profile,List.of()).stream().filter(key->doc.fields().stream().noneMatch(f->f.label().equals(key)&&!f.value().isBlank())).toList();}
  static boolean mismatch(String profile,String type){return !profile.equals("general")&&!type.equals(profile.equals("payroll")?"income":profile);}
  private static ResponseStatusException fail(int code,String message){return new ResponseStatusException(HttpStatus.valueOf(code),message);}
}
