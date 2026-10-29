package dev.creditlab.assistant;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/** Durable lifecycle in PostgreSQL; in-memory fallback is for nonpersistent tests only. */
@Service
public class AssistantRuns {
  private static final ThreadLocal<Run> CURRENT=new ThreadLocal<>();
  private final Map<String,Run> runs=new ConcurrentHashMap<>();
  private final String owner=UUID.randomUUID().toString();
  private final AssistantRunJournal journal;
  public AssistantRuns(){journal=null;}
  @Autowired public AssistantRuns(Optional<DataSource> source){journal=source.map(AssistantRunJournal::new).orElse(null);}
  private static final class Run {
    final String id,caseId;final Instant time=Instant.now();String status="RUNNING",phase="PREPARING";boolean cancelled;Thread thread;
    Run(String id,String caseId){this.id=id;this.caseId=caseId;}
    AssistantRuns registry;String tenant,actor;
  }
  private String key(String tenant,String actor,String id){return tenant+"|"+actor+"|"+id;}
  public <T>T execute(String tenant,String actor,String caseId,String id,Supplier<T> action){
    if(id==null)id=UUID.randomUUID().toString();
    try{UUID.fromString(id);}catch(Exception e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"INVALID_REQUEST_ID");}
    if(runs.size()>=1000)throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"RUN_REGISTRY_FULL");
    if(journal!=null&&!journal.reserve(tenant,actor,caseId,id,owner,false))throw new ResponseStatusException(HttpStatus.CONFLICT,"REQUEST_ALREADY_REGISTERED");
    var run=new Run(id,caseId);run.thread=Thread.currentThread();run.registry=this;run.tenant=tenant;run.actor=actor;
    if(runs.putIfAbsent(key(tenant,actor,id),run)!=null)throw new ResponseStatusException(HttpStatus.CONFLICT,"REQUEST_ALREADY_REGISTERED");
    CURRENT.set(run);
    try{T value=action.get();synchronized(run){if(!run.status.equals("COMPLETE"))commit(()->null);if(run.cancelled)throw cancelled();run.status="COMPLETE";}return value;}
    catch(RuntimeException e){synchronized(run){run.status=run.cancelled?"RESPONSE_DISCARDED":"FAILED";if(journal!=null)journal.failed(tenant,actor,run.id,owner,run.cancelled);}throw e;}
    finally{synchronized(run){run.thread=null;}CURRENT.remove();}
  }
  /** Serialize final persistence against cancellation so cancelled output cannot become an answer. */
  public static <T>T commit(Supplier<T> save){var run=CURRENT.get();if(run==null)return save.get();synchronized(run){if(run.cancelled)throw cancelled();var registry=run.registry;T result=registry.journal==null?save.get():registry.journal.commit(run.tenant,run.actor,run.caseId,run.id,registry.owner,save);run.status="COMPLETE";return result;}}
  static void markInference(){var run=CURRENT.get();if(run!=null)synchronized(run){if(run.cancelled)throw cancelled();run.phase="GENERATING";if(run.registry.journal!=null&&!run.registry.journal.renew(run.tenant,run.actor,run.id,run.registry.owner,run.phase))throw cancelled();}}
  public Map<String,Object> read(String tenant,String actor,String caseId,String id){
    if(journal!=null)return journal.read(tenant,actor,caseId,id);
    var run=runs.get(key(tenant,actor,id));if(run==null||!run.caseId.equals(caseId))throw new ResponseStatusException(HttpStatus.NOT_FOUND,"RUN_UNKNOWN");
    synchronized(run){return Map.of("id",run.id,"status",run.status,"phase",run.phase,"startedAt",run.time.toString(),"providerStopConfirmed",false,"runtimeScope","single-api-process");}
  }
  public Map<String,Object> cancel(String tenant,String actor,String caseId,String id){
    try{UUID.fromString(id);}catch(Exception invalid){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"INVALID_REQUEST_ID");}String key=key(tenant,actor,id);
    if(journal!=null){journal.cancel(tenant,actor,caseId,id,owner);var active=runs.get(key);if(active!=null)synchronized(active){if(active.status.equals("RUNNING")){active.cancelled=true;active.status="CANCEL_REQUESTED";if(active.thread!=null)active.thread.interrupt();}}return read(tenant,actor,caseId,id);}
    var before=new Run(id,caseId);before.cancelled=true;before.status="CANCELLED_BEFORE_START";
    if(runs.size()>=1000&&!runs.containsKey(key))throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"RUN_REGISTRY_FULL");
    var run=runs.computeIfAbsent(key,ignored->before);
    if(!run.caseId.equals(caseId))throw new ResponseStatusException(HttpStatus.NOT_FOUND,"RUN_UNKNOWN");
    synchronized(run){if(run.status.equals("RUNNING")){run.cancelled=true;run.status="CANCEL_REQUESTED";if(run.thread!=null)run.thread.interrupt();}}
    return read(tenant,actor,caseId,id);
  }
  @Scheduled(fixedDelay=60000) public void expire(){runs.entrySet().removeIf(e->{synchronized(e.getValue()){return e.getValue().thread==null&&e.getValue().time.isBefore(Instant.now().minusSeconds(1800));}});}
  @Scheduled(fixedDelay=10000) public void renew(){if(journal==null)return;for(var run:runs.values())synchronized(run){if(run.thread!=null&&run.status.equals("RUNNING")){try{if(!journal.renew(run.tenant,run.actor,run.id,owner,run.phase)){run.cancelled=true;run.status="CANCEL_REQUESTED";run.thread.interrupt();}}catch(RuntimeException unavailable){run.cancelled=true;run.thread.interrupt();}}}}
  private static ResponseStatusException cancelled(){return new ResponseStatusException(HttpStatus.CONFLICT,"RESPONSE_DISCARDED_AFTER_CANCEL");}
}
