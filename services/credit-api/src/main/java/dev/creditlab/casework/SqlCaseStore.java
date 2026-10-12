package dev.creditlab.casework;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

public class SqlCaseStore extends CaseStore {
  private final JdbcTemplate db;
  private final ObjectMapper mapper;
  private final TransactionTemplate tx;
  private final boolean h2;
  private final dev.creditlab.assistant.AiQuotaPolicy quota;
  public SqlCaseStore(DataSource source, ObjectMapper mapper) {
    this(source,mapper,dev.creditlab.assistant.AiQuotaPolicy.defaults());
  }
  public SqlCaseStore(DataSource source,ObjectMapper mapper,dev.creditlab.assistant.AiQuotaPolicy quota) {
    this.quota=quota;
    this.db = new JdbcTemplate(source); this.mapper = mapper;
    this.tx = new TransactionTemplate(new DataSourceTransactionManager(source));
    try (var connection=source.getConnection()) { this.h2=connection.getMetaData().getDatabaseProductName().equalsIgnoreCase("H2"); }
    catch (java.sql.SQLException error) { throw new IllegalStateException("Database metadata unavailable",error); }
    db.execute("CREATE TABLE IF NOT EXISTS credit_cases (id varchar(80) PRIMARY KEY, tenant varchar(120) NOT NULL, version bigint NOT NULL, payload text NOT NULL)");
    db.execute("CREATE INDEX IF NOT EXISTS credit_cases_tenant ON credit_cases(tenant)");
    db.execute("CREATE TABLE IF NOT EXISTS credit_files (id varchar(80) PRIMARY KEY, tenant varchar(120) NOT NULL, case_id varchar(80) NOT NULL, content bytea NOT NULL)");
    db.execute("CREATE TABLE IF NOT EXISTS ai_quota (bucket varchar(300) PRIMARY KEY, used bigint NOT NULL)");
    db.execute("CREATE TABLE IF NOT EXISTS ai_audit (id varchar(80) PRIMARY KEY, tenant varchar(120) NOT NULL, case_id varchar(80) NOT NULL, actor varchar(160) NOT NULL, mode varchar(80) NOT NULL, created_at timestamp NOT NULL)");
    db.execute("CREATE INDEX IF NOT EXISTS ai_audit_tenant_case ON ai_audit(tenant,case_id,created_at)");
  }
  private CreditCase decode(String json) {
    try { return mapper.readValue(json, CreditCase.class); } catch (Exception e) { throw new IllegalStateException("Invalid stored case"); }
  }
  private String encode(CreditCase item) {
    try { return mapper.writeValueAsString(item); } catch (Exception e) { throw new IllegalStateException("Invalid case payload"); }
  }
  @Override public List<CreditCase> list(String tenant) {
    return db.query("SELECT payload FROM credit_cases WHERE tenant=? ORDER BY id", (row,i)->decode(row.getString(1)), tenant);
  }
  @Override public Optional<CreditCase> get(String tenant, String id) {
    return db.query("SELECT payload FROM credit_cases WHERE tenant=? AND id=?", (row,i)->decode(row.getString(1)), tenant,id).stream().findFirst();
  }
  @Override public void insert(CreditCase item) {
    db.update(h2?"MERGE INTO credit_cases(id,tenant,version,payload) KEY(id) VALUES(?,?,?,?)":"INSERT INTO credit_cases(id,tenant,version,payload) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING", item.id(),item.tenantId(),item.version(),encode(item));
  }
  @Override public boolean update(CreditCase item, long previous) {
    return db.update("UPDATE credit_cases SET payload=?,version=? WHERE tenant=? AND id=? AND version=?",encode(item),item.version(),item.tenantId(),item.id(),previous)==1;
  }
  @Override public void saveFile(String tenant,String caseId,String id,byte[] bytes) {
    db.update("INSERT INTO credit_files(id,tenant,case_id,content) VALUES(?,?,?,?)",id,tenant,caseId,bytes);
  }
  public void attach(CreditCase item,long previous,String docId,byte[] bytes) {
    tx.executeWithoutResult(status -> {
      if(!update(item,previous)) throw new ResponseStatusException(HttpStatus.CONFLICT,"Concurrent update");
      saveFile(item.tenantId(),item.id(),docId,bytes);
    });
  }
  @Override public Optional<byte[]> file(String tenant,String caseId,String id) {
    return db.query("SELECT content FROM credit_files WHERE tenant=? AND case_id=? AND id=?",(r,i)->r.getBytes(1),tenant,caseId,id).stream().findFirst();
  }
  public void expire(CreditCase item,long previous,String docId) {
    tx.executeWithoutResult(status->{if(!update(item,previous))throw new ResponseStatusException(HttpStatus.CONFLICT,"Concurrent retention update");
      db.update("DELETE FROM credit_files WHERE tenant=? AND case_id=? AND id=?",item.tenantId(),item.id(),docId);});
  }
  @Override public void reserve(String tenant,String actor,int tokens) {
    if(tokens<1||tokens>30_000)throw new IllegalArgumentException("Invalid reservation size");
    var now=Instant.now(); var minute=now.getEpochSecond()/60; var day=LocalDate.now(ZoneOffset.UTC);
    tx.executeWithoutResult(status -> {
      // Always lock tenant first. All instances share these counters; failed reservations roll back.
      charge("tenant:"+tenant+":m:"+minute,1,quota.tenantRequestsPerMinute(),"AI_MINUTE_LIMIT",now,false);
      charge("actor:"+tenant+":"+actor+":m:"+minute,1,quota.requestsPerMinute(),"AI_MINUTE_LIMIT",now,false);
      charge("budget:"+tenant+":d:"+day,tokens,quota.dailyTenantBudget(),"AI_DAILY_TENANT_LIMIT",now,true);
      charge("budget:"+tenant+":"+actor+":d:"+day,tokens,quota.dailyAccountBudget(),"AI_DAILY_ACCOUNT_LIMIT",now,true);
    });
  }
  @Override public dev.creditlab.assistant.AiQuotaPolicy quotaPolicy(){return quota;}
  private void charge(String bucket,int amount,int limit,String code,Instant now,boolean daily) {
    db.update(h2?"MERGE INTO ai_quota(bucket,used) KEY(bucket) VALUES(?,COALESCE((SELECT used FROM ai_quota WHERE bucket=?),0))":"INSERT INTO ai_quota(bucket,used) VALUES(?,0) ON CONFLICT(bucket) DO NOTHING",h2?new Object[]{bucket,bucket}:new Object[]{bucket});
    long used=db.queryForObject("SELECT used FROM ai_quota WHERE bucket=? FOR UPDATE",Long.class,bucket);
    if(used+amount>limit) throw new dev.creditlab.assistant.AiUsageLimitException(code,now,daily);
    db.update("UPDATE ai_quota SET used=used+? WHERE bucket=?",amount,bucket);
  }
  @Override public void recordAiUse(String requestId,String tenant,String caseId,String actor,String mode) {
    db.update("INSERT INTO ai_audit(id,tenant,case_id,actor,mode,created_at) VALUES(?,?,?,?,?,?)",
        requestId,tenant,caseId,actor,mode,java.sql.Timestamp.from(Instant.now()));
  }
}
