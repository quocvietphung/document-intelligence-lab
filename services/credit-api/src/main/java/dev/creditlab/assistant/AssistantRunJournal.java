package dev.creditlab.assistant;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.function.Supplier;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/** Durable metadata and row-lock boundary shared by cancellation and answer persistence. */
final class AssistantRunJournal {
  private final JdbcTemplate db;
  private final TransactionTemplate tx;
  AssistantRunJournal(DataSource source){db=new JdbcTemplate(source);tx=new TransactionTemplate(new DataSourceTransactionManager(source));}
  private static Timestamp now(){return Timestamp.from(Instant.now());}
  private static Timestamp lease(){return Timestamp.from(Instant.now().plusSeconds(90));}
  boolean reserve(String tenant,String actor,String caseId,String id,String owner,boolean cancelled){
    try{return db.update("INSERT INTO lab_assistant_runs VALUES(?,?,?,?,?,?,?,?,?,?,?)",tenant,actor,id,caseId,owner,
        cancelled?"CANCELLED_BEFORE_START":"RUNNING","PREPARING",cancelled,now(),now(),lease())==1;}
    catch(org.springframework.dao.DuplicateKeyException duplicate){return false;}
  }
  private List<Map<String,Object>> rows(String tenant,String actor,String id,boolean lock){return db.queryForList(
      "SELECT * FROM lab_assistant_runs WHERE tenant=? AND actor=? AND request_id=?"+(lock?" FOR UPDATE":""),tenant,actor,id);}
  private Map<String,Object> require(String tenant,String actor,String caseId,String id,boolean lock){
    var rows=rows(tenant,actor,id,lock);if(rows.isEmpty()||!caseId.equals(rows.getFirst().get("case_id")))throw fail(HttpStatus.NOT_FOUND,"RUN_UNKNOWN");return rows.getFirst();
  }
  Map<String,Object> read(String tenant,String actor,String caseId,String id){
    // No redispatch after an abandoned lease: provider termination and response delivery are unknown.
    db.update("UPDATE lab_assistant_runs SET status='INTERRUPTED',cancelled=true,updated_at=? WHERE tenant=? AND actor=? AND request_id=? AND case_id=? AND status IN ('RUNNING','CANCEL_REQUESTED') AND lease_until<?",now(),tenant,actor,id,caseId,now());
    var row=require(tenant,actor,caseId,id,false);
    return Map.of("id",id,"status",row.get("status"),"phase",row.get("phase"),"startedAt",((Timestamp)row.get("started_at")).toInstant().toString(),"providerStopConfirmed",false,"runtimeScope","postgresql");
  }
  void cancel(String tenant,String actor,String caseId,String id,String owner){
    reserve(tenant,actor,caseId,id,owner,true);
    tx.executeWithoutResult(ignored->{require(tenant,actor,caseId,id,true);db.update("UPDATE lab_assistant_runs SET cancelled=true,status='CANCEL_REQUESTED',updated_at=? WHERE tenant=? AND actor=? AND request_id=? AND status='RUNNING'",now(),tenant,actor,id);});
  }
  boolean renew(String tenant,String actor,String id,String owner,String phase){return db.update(
      "UPDATE lab_assistant_runs SET phase=?,updated_at=?,lease_until=? WHERE tenant=? AND actor=? AND request_id=? AND owner_id=? AND status='RUNNING' AND cancelled=false AND lease_until>=?",phase,now(),lease(),tenant,actor,id,owner,now())==1;}
  <T>T commit(String tenant,String actor,String caseId,String id,String owner,Supplier<T> save){
    return tx.execute(ignored->{var row=require(tenant,actor,caseId,id,true);
      if(!owner.equals(row.get("owner_id"))||Boolean.TRUE.equals(row.get("cancelled"))||!"RUNNING".equals(row.get("status"))||((Timestamp)row.get("lease_until")).toInstant().isBefore(Instant.now()))throw fail(HttpStatus.CONFLICT,"RESPONSE_DISCARDED_AFTER_CANCEL");
      T value=save.get();db.update("UPDATE lab_assistant_runs SET status='COMPLETE',updated_at=? WHERE tenant=? AND actor=? AND request_id=?",now(),tenant,actor,id);return value;
    });
  }
  void failed(String tenant,String actor,String id,String owner,boolean cancelled){db.update("UPDATE lab_assistant_runs SET status=CASE WHEN cancelled THEN 'RESPONSE_DISCARDED' ELSE ? END,updated_at=? WHERE tenant=? AND actor=? AND request_id=? AND owner_id=? AND status IN ('RUNNING','CANCEL_REQUESTED')",cancelled?"RESPONSE_DISCARDED":"FAILED",now(),tenant,actor,id,owner);}
  private static ResponseStatusException fail(HttpStatus status,String code){return new ResponseStatusException(status,code);}
}
