package dev.creditlab.platform;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Every lookup includes the verified tenant and case. Memory mode is non-durable test/demo storage. */
@Component
public class LabStore {
  private final JdbcTemplate db;
  private final ObjectMapper mapper;
  private final Map<String,Map<String,Object>> memory=new ConcurrentHashMap<>();
  public LabStore(Optional<DataSource> source,ObjectMapper mapper) { this.db=source.map(JdbcTemplate::new).orElse(null); this.mapper=mapper; }
  public boolean persistent() { return db!=null; }
  public JdbcTemplate database() { if(db==null) throw new IllegalStateException("Persistent lab required"); return db; }
  public Map<String,Object> decode(String text) {
    try { return mapper.readValue(text,new TypeReference<>(){}); } catch(Exception e) { throw new IllegalStateException("Invalid lab record",e); }
  }
  public String encode(Object value) {
    try { return mapper.writeValueAsString(value); } catch(Exception e) { throw new IllegalStateException("Invalid lab payload",e); }
  }
  public Optional<Map<String,Object>> find(String tenant,String caseId,String kind,String id) {
    if(db==null)return Optional.ofNullable(memory.get(tenant+"|"+caseId+"|"+kind+"|"+id));
    return db.query("SELECT payload FROM lab_records WHERE tenant=? AND case_id=? AND kind=? AND id=?",(r,i)->decode(r.getString(1)),tenant,caseId,kind,id).stream().findFirst();
  }
  /** Immutable records and idempotency keys never overwrite previous evidence. */
  public boolean insert(String tenant,String caseId,String kind,String id,Map<String,Object> value) {
    if(db==null)return memory.putIfAbsent(tenant+"|"+caseId+"|"+kind+"|"+id,Map.copyOf(value))==null;
    try {db.update("INSERT INTO lab_records(tenant,case_id,kind,id,created_at,payload) VALUES(?,?,?,?,?,?)",tenant,caseId,kind,id,java.sql.Timestamp.from(Instant.now()),encode(value));return true;}
    catch(org.springframework.dao.DuplicateKeyException duplicate){return false;}
  }
  /** Optimistic concurrency; every caller supplies a tenant/case-scoped previous payload. */
  public boolean replace(String tenant,String caseId,String kind,String id,Map<String,Object> previous,Map<String,Object> next) {
    if(db==null)return memory.replace(tenant+"|"+caseId+"|"+kind+"|"+id,previous,Map.copyOf(next));
    return db.update("UPDATE lab_records SET payload=? WHERE tenant=? AND case_id=? AND kind=? AND id=? AND payload=?",encode(next),tenant,caseId,kind,id,encode(previous))==1;
  }
  public void save(String tenant,String caseId,String kind,String id,Map<String,Object> value) {
    if(db==null) { memory.put(tenant+"|"+caseId+"|"+kind+"|"+id,Map.copyOf(value));return; }
    db.update("INSERT INTO lab_records(tenant,case_id,kind,id,created_at,payload) VALUES(?,?,?,?,?,?) ON CONFLICT(tenant,case_id,kind,id) DO UPDATE SET payload=EXCLUDED.payload",tenant,caseId,kind,id,java.sql.Timestamp.from(Instant.now()),encode(value));
  }
  public List<Map<String,Object>> list(String tenant,String caseId,String kind) {
    if(db==null) return memory.entrySet().stream().filter(e->e.getKey().startsWith(tenant+"|"+caseId+"|"+kind+"|")).map(Map.Entry::getValue).sorted(Comparator.comparing((Map<String,Object> row)->row.getOrDefault("time","").toString()).reversed()).limit(60).toList();
    return db.query("SELECT payload FROM lab_records WHERE tenant=? AND case_id=? AND kind=? ORDER BY created_at DESC LIMIT 60",(r,i)->decode(r.getString(1)),tenant,caseId,kind);
  }
}
