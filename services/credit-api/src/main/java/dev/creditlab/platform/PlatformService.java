package dev.creditlab.platform;

import dev.creditlab.casework.*;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class PlatformService {
  private final CreditCaseService cases;private final LabStore store;private final RagEngine rag;private final AgentSupervisor supervisor;
  private final DocumentJobs jobs;private final BankingInsights insights;private final LabEvaluation evaluation;private final DistributedLimits limits;private final MeterRegistry metrics;
  public PlatformService(CreditCaseService cases,LabStore store,RagEngine rag,AgentSupervisor supervisor,DocumentJobs jobs,BankingInsights insights,LabEvaluation evaluation,DistributedLimits limits,MeterRegistry metrics){this.cases=cases;this.store=store;this.rag=rag;this.supervisor=supervisor;this.jobs=jobs;this.insights=insights;this.evaluation=evaluation;this.limits=limits;this.metrics=metrics;}
  public Map<String,Object> snapshot(String tenant,String id) {
    var item=cases.require(tenant,id);var data=new LinkedHashMap<String,Object>();
    data.put("persistent",store.persistent());data.put("caseId",id);data.put("documentPipeline",jobs.status());data.put("jobs",jobs.list(tenant,id));data.put("evaluations",List.of());data.put("runs",store.list(tenant,id,"agent-run").stream().filter(run->!"synthetic-demo".equals(run.get("mode"))).toList());data.put("reviews",store.list(tenant,id,"compliance-review"));data.put("banking",insights.read(item));data.put("limits",limits.status());data.put("generatedAt",Instant.now().toString());
    data.put("agents",List.of(Map.of("name","Supervisor","tools",List.of("route","tenant scope","request guard")),Map.of("name","Document","tools",List.of("caseSummary","documentEvidence","retrievedEvidence")),Map.of("name","Banking","tools",List.of("caseSummary","documentEvidence","retrievedEvidence")),Map.of("name","Compliance","tools",List.of("caseSummary","retrievedEvidence")),Map.of("name","Risk","tools",List.of("caseSummary","retrievedEvidence")),Map.of("name","Explanation","tools",List.of("caseSummary","retrievedEvidence"))));
    data.put("architecture","Supervised intent routing with one LLM specialist per request; read-only tools; deterministic routing and verification.");return data;
  }
  public Map<String,Object> search(String tenant,String id,String actor,String question) {
    var item=cases.require(tenant,id);limits.reserve(tenant,actor,"evidence-search",30);
    if(EvidenceGuard.suspicious(question))throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY,"Request instruction override blocked");
    long start=System.nanoTime();var result=rag.search(item,question,5);metrics.timer("lab.rag.search").record(System.nanoTime()-start,java.util.concurrent.TimeUnit.NANOSECONDS);
    return Map.of("search",result,"plan",supervisor.route(question),"durationMs",(System.nanoTime()-start)/1_000_000);
  }
  public Map<String,Object> evaluate(String tenant,String id,String actor){cases.require(tenant,id);throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,"Fixture benchmark is not part of the document workspace");}
  public void record(String tenant,String id,String requestId,String mode,AgentSupervisor.Plan plan,String answer,List<RagEngine.Hit> hits,long durationMs) {
    var quality=EvidenceGuard.verify(answer,hits);store.save(tenant,id,"agent-run",requestId,Map.of("id",requestId,"time",Instant.now().toString(),"mode",mode,"specialist",plan.specialist(),"steps",plan.steps(),"quality",quality,"durationMs",durationMs,"sources",hits.stream().map(RagEngine.Hit::id).toList()));
    metrics.counter("lab.agent.requests","mode",mode,"specialist",plan.specialist()).increment();metrics.timer("lab.agent.duration","specialist",plan.specialist()).record(durationMs,java.util.concurrent.TimeUnit.MILLISECONDS);
  }
  public Map<String,Object> review(String tenant,String id,String actor,String alert,String note) {
    cases.allowWrite();var item=cases.require(tenant,id);var bank=insights.read(item);
    @SuppressWarnings("unchecked")var alerts=(List<Map<String,Object>>)bank.get("alerts");
    if(alerts.stream().noneMatch(a->alert.equals(a.get("id"))))throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND);
    String reviewId="review-"+UUID.randomUUID();
    var value=Map.<String,Object>of("id",reviewId,"alertId",alert,"note",note.strip(),"actor",actor,"time",Instant.now().toString(),"state","ACKNOWLEDGED","caseVersion",item.version());store.save(tenant,id,"compliance-review",reviewId,value);return value;
  }
  public AgentSupervisor.Plan plan(String question){return supervisor.route(question);}
  public RagEngine.Search retrieve(CreditCase item,String question){return rag.search(item,question,5);}
}
