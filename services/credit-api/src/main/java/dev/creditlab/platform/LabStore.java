package dev.creditlab.platform;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Every lookup includes the verified tenant and case; memory mode is explicitly read-only. */
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
  public void save(String tenant,String caseId,String kind,String id,Map<String,Object> value) {
    if(db==null) { memory.put(tenant+"|"+caseId+"|"+kind+"|"+id,Map.copyOf(value));return; }
    db.update("INSERT INTO lab_records(tenant,case_id,kind,id,created_at,payload) VALUES(?,?,?,?,?,?) ON CONFLICT(tenant,case_id,kind,id) DO UPDATE SET payload=EXCLUDED.payload",tenant,caseId,kind,id,java.sql.Timestamp.from(Instant.now()),encode(value));
  }
  public List<Map<String,Object>> list(String tenant,String caseId,String kind) {
    if(db==null) return memory.entrySet().stream().filter(e->e.getKey().startsWith(tenant+"|"+caseId+"|"+kind+"|")).map(Map.Entry::getValue).toList();
    return db.query("SELECT payload FROM lab_records WHERE tenant=? AND case_id=? AND kind=? ORDER BY created_at DESC LIMIT 60",(r,i)->decode(r.getString(1)),tenant,caseId,kind);
  }
}
