package dev.creditlab.platform;

import dev.creditlab.casework.CreditCaseService;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Read-only configuration and private, explicit evaluation exports. Never probes cloud services. */
@Service
public class ResearchIntegrations {
  private final CreditCaseService cases;private final BlobSources blob;private final LabStore store;
  @Value("${app.ai.provider:azure}") private String nova="azure";
  @Value("${app.ai.local-model:}") private String localModel="";
  @Value("${app.platform.embedding-provider:minilm}") private String embedding="minilm";
  @Value("${app.platform.learned-reranker:false}") private boolean reranker;
  @Value("${app.document-intelligence.mode:local}") private String documents="local";
  @Value("${app.integrations.adf-resource:}") private String adf="";
  @Value("${app.integrations.foundry-endpoint:}") private String foundry="";
  @Value("${app.integrations.telemetry:false}") private boolean telemetry;
  @Value("${app.ai.vision-model:}") private String vision="";
  public ResearchIntegrations(CreditCaseService cases,BlobSources blob,LabStore store){this.cases=cases;this.blob=blob;this.store=store;}
  private static Map<String,Object> entry(String id,boolean configured,String provider,String action){return Map.of("id",id,"configured",configured,"verification","NOT_LIVE_TESTED","provider",provider,"action",action);}
  private Map<String,Object> localNova(String tenant,String id){
    var value=new LinkedHashMap<>(entry("nova-local",nova.equals("ollama"),"Ollama","explicit-chat"));
    if(nova.equals("ollama"))store.list(tenant,id,"trust-answer").stream()
        .filter(a->"local-ollama".equals(a.get("mode"))&&localModel.equals(a.get("modelId")))
        .findFirst().ifPresent(a->{value.put("verification","SAVED_RESPONSE");value.put("recordedAt",a.get("time"));});
    return value; // Historical response only, never a current-health or quality probe.
  }
  public Map<String,Object> status(String tenant,String id){cases.require(tenant,id);return Map.of("caseId",id,"automaticCalls",false,"integrations",List.of(
      entry("blob",blob.configured(),"Azure Blob Storage","explicit-scan-and-import"),entry("adf",!adf.isBlank(),"Azure Data Factory","operator-cli"),
      entry("foundry",!foundry.isBlank(),"Azure AI Evaluation SDK","private-export-and-operator-cli"),entry("monitoring",telemetry,"Application Insights / OpenTelemetry","operator-opt-in"),
      localNova(tenant,id),entry("bge",embedding.equals("bge-m3"),"BAAI/bge-m3","versioned-separate-index"),
      entry("reranker",reranker,"BAAI/bge-reranker-v2-m3","explicit-search"),entry("paddle",documents.equals("paddleocr"),"PP-StructureV3","explicit-document-analysis"),
      entry("vision",!vision.isBlank(),"Ollama vision","explicit-page-question")),"exports",store.list(tenant,id,"judge-export"));}
  public Map<String,Object> export(String tenant,String id,String actor,String answerId,long version,boolean consent){
    cases.allowWrite();var item=cases.require(tenant,id);if(item.version()!=version)throw new ResponseStatusException(HttpStatus.CONFLICT,"STALE_CASE");
    if(!consent)throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"PRIVATE_EXPORT_CONSENT_REQUIRED");
    var answer=store.find(tenant,id,"trust-answer",answerId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"ANSWER_NOT_FOUND"));
    // A case summary or fixture alone is not a valid groundedness test against original documents.
    @SuppressWarnings("unchecked") var sources=(List<Map<String,Object>>)answer.getOrDefault("sources",List.of());
    var originals=sources.stream().filter(s->Boolean.TRUE.equals(s.get("originalAvailable"))&&"DOCUMENT".equals(s.get("kind"))).limit(30).toList();
    if(originals.isEmpty())throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"ORIGINAL_EVIDENCE_REQUIRED");
    String exportId="judge-"+UUID.randomUUID();String context=originals.stream().map(s->"["+s.get("id")+"] "+s.get("excerpt")).reduce("",(a,b)->a+"\n"+b);
    var metadata=Map.<String,Object>of("id",exportId,"time",Instant.now().toString(),"actor",actor,"answerId",answerId,"caseVersion",answer.get("caseVersion"),"destination","private-local-file","cloudSubmitted",false);
    store.insert(tenant,id,"judge-export",exportId,metadata);
    return Map.of("schemaVersion","foundry-evaluation-input-v1","exportId",exportId,"rows",List.of(Map.of("id",answerId,"query",answer.get("question"),"response",answer.get("answer"),"context",context,"ground_truth","")),"warning","Private source excerpts; no cloud submission. Add independently checked ground truth before completeness evaluation.");
  }
}
