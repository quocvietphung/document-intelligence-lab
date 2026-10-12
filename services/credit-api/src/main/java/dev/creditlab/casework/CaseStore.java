package dev.creditlab.casework;

import java.util.*;

/** In-memory store is explicitly read-only/demo outside the persistent profile. */
public class CaseStore {
  protected final Map<String, CreditCase> cases = new LinkedHashMap<>();
  protected final Map<String, byte[]> files = new HashMap<>();
  public synchronized List<CreditCase> list(String tenant) {
    return cases.values().stream().filter(c -> c.tenantId().equals(tenant)).toList();
  }
  public synchronized Optional<CreditCase> get(String tenant, String id) {
    return list(tenant).stream().filter(c -> c.id().equals(id)).findFirst();
  }
  public synchronized void insert(CreditCase item) { cases.putIfAbsent(item.id(), item); }
  public synchronized boolean update(CreditCase item, long previous) {
    var current = get(item.tenantId(), item.id());
    if (current.isEmpty() || current.get().version() != previous) return false;
    cases.put(item.id(), item); return true;
  }
  public void saveFile(String tenant, String caseId, String id, byte[] bytes) { files.put(tenant+":"+caseId+":"+id, bytes); }
  public Optional<byte[]> file(String tenant, String caseId, String id) { return Optional.ofNullable(files.get(tenant+":"+caseId+":"+id)); }
  public void reserve(String tenant, String actor, int tokens) { throw new IllegalStateException("Persistent quota storage required"); }
  public dev.creditlab.assistant.AiQuotaPolicy quotaPolicy(){return dev.creditlab.assistant.AiQuotaPolicy.defaults();}
  public void recordAiUse(String requestId,String tenant,String caseId,String actor,String mode) { }
}
