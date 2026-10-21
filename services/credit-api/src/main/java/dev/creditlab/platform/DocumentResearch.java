package dev.creditlab.platform;

import dev.creditlab.casework.CreditCase;
import dev.creditlab.casework.CreditCaseService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.text.Normalizer;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.server.ResponseStatusException;

/** Source-bound experiments. No fixture scores, automatic ground truth, or cloud judge claims. */
@Service
public class DocumentResearch {
  public record FieldLabel(@NotBlank @Size(max=80) String documentId, @Min(1) int page,
      @NotBlank @Size(max=120) String field, @NotBlank @Size(max=1000) String expected) {}
  public record QuestionLabel(@NotBlank @Size(max=1000) String question,
      @NotBlank @Size(max=80) String documentId, @Min(1) int page) {}
  public record DatasetRequest(@Min(0) long caseVersion, @NotBlank @Size(max=100) String name,
      @NotNull @Size(max=100) List<@NotNull @Valid FieldLabel> fields,
      @NotNull @Size(max=30) List<@NotNull @Valid QuestionLabel> questions, @AssertTrue boolean sourceChecked) {}
  public enum Suite { EXTRACTION, RETRIEVAL, CHUNKING, PROMPTING }
  public record RunRequest(@Min(0) long caseVersion, @NotBlank @Size(max=80) String datasetId, @NotNull Suite suite) {}
  public record ExportRequest(@Min(0) long caseVersion) {}
  private final CreditCaseService cases;
  private final LabStore store;
  private final RagEngine rag;
  private final DistributedLimits limits;
  @org.springframework.beans.factory.annotation.Autowired(required=false) private dev.langchain4j.model.chat.ChatModel promptModel;
  @org.springframework.beans.factory.annotation.Value("${app.ai.provider:azure}") private String chatProvider="azure";
  @org.springframework.beans.factory.annotation.Value("${app.platform.worker-enabled:true}") private boolean workerEnabled=true;

  public DocumentResearch(CreditCaseService cases, LabStore store, RagEngine rag, DistributedLimits limits) {
    this.cases=cases; this.store=store; this.rag=rag; this.limits=limits;
  }
  public Map<String,Object> read(String tenant, String id) {
    var item=cases.require(tenant,id);
    var docs=originals(item);
    var value=new LinkedHashMap<String,Object>(Map.of("caseId",id,"caseVersion",item.version(),"domain",item.domain(),"sourceHash",fingerprint(item),
        "persistent",store.persistent(),"documents",docs.stream().map(d->Map.of(
            "id",d.id(),"name",d.name(),"provider",Objects.toString(d.analysisProvider(),"unknown"),
            "model",Objects.toString(d.modelId(),"unknown"),"pages",d.pages().stream().map(CreditCase.Page::number).distinct().sorted().toList(),
            "fields",d.fields().stream().map(CreditCase.Field::label).distinct().sorted().toList(),"tables",d.tables().size())).toList(),
        "datasets",store.list(tenant,id,"document-reference"),"runs",store.list(tenant,id,"document-experiment"),
        "exports",store.list(tenant,id,"data-export"),"retrieval",rag.configuration()));
    value.put("jobs",store.list(tenant,id,"document-experiment-job"));return value;
  }
  public Map<String,Object> save(String tenant,String id,String actor,DatasetRequest request) {
    cases.allowWrite(); var item=current(tenant,id,request.caseVersion());
    if(!request.sourceChecked() || request.fields().isEmpty()&&request.questions().isEmpty())bad("Independently checked source labels required");
    var keys=new HashSet<String>();
    for(var f:request.fields()) {
      source(item,f.documentId(),f.page());
      if(!keys.add(f.documentId()+"|"+f.page()+"|"+f.field().strip().toLowerCase(Locale.ROOT)))bad("Duplicate field label");
    }
    keys.clear();
    for(var q:request.questions()) {
      source(item,q.documentId(),q.page());
      if(EvidenceGuard.suspicious(q.question()))bad("Unsafe evaluation question");
      if(!keys.add(normalize(q.question())))bad("Duplicate evaluation question");
    }
    var value=new LinkedHashMap<String,Object>();
    value.put("id","reference-"+UUID.randomUUID());value.put("time",Instant.now().toString());value.put("name",request.name().strip());
    value.put("caseVersion",item.version());value.put("sourceHash",fingerprint(item));value.put("actor",actor);
    value.put("fields",request.fields().stream().map(f->Map.of("documentId",f.documentId(),"page",f.page(),"field",f.field().strip(),"expected",f.expected().strip())).toList());
    value.put("questions",request.questions().stream().map(q->Map.of("question",q.question().strip(),"documentId",q.documentId(),"page",q.page())).toList());
    value.put("sourceChecked",true);
    store.insert(tenant,id,"document-reference",value.get("id").toString(),value);return value;
  }
  public Map<String,Object> run(String tenant,String id,String actor,RunRequest request) {
    return run(tenant,id,actor,request,"experiment-"+UUID.randomUUID(),true);
  }
  private Map<String,Object> reference(String tenant,String id,CreditCase item,RunRequest request) {
    var dataset=store.find(tenant,id,"document-reference",request.datasetId()).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
    if(!fingerprint(item).equals(dataset.get("sourceHash")))throw new ResponseStatusException(HttpStatus.CONFLICT,"Source documents changed; create a new checked reference version");
    if(rows(dataset.get(request.suite()==Suite.EXTRACTION||request.suite()==Suite.PROMPTING?"fields":"questions")).isEmpty())bad("No labels for this experiment");
    if(request.suite()==Suite.PROMPTING&&(promptModel==null||!chatProvider.equals("ollama")))throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Prompt comparison requires the configured local Nova model; no cloud fallback");
    return dataset;
  }
  public Map<String,Object> enqueue(String tenant,String id,String actor,RunRequest request) {
    cases.allowWrite();var item=current(tenant,id,request.caseVersion());reference(tenant,id,item,request);
    if(!store.persistent()||!workerEnabled)throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Persistent experiment worker required");
    limits.reserve(tenant,actor,"document-experiment",6);
    var job=new LinkedHashMap<String,Object>();job.put("id","experiment-"+UUID.randomUUID());job.put("time",Instant.now().toString());
    job.put("actor",actor);job.put("caseVersion",request.caseVersion());job.put("datasetId",request.datasetId());job.put("suite",request.suite().name());
    job.put("status","QUEUED");job.put("attempt",0);job.put("leaseUntil",Instant.now().toString());job.put("errorCode","");
    store.insert(tenant,id,"document-experiment-job",job.get("id").toString(),job);return job;
  }
  /** Durable queue + compare-and-swap lease; deterministic result ID makes recovery idempotent. */
  @Scheduled(fixedDelay=2500,initialDelay=10000)
  public void work() {
    if(!store.persistent()||!workerEnabled)return;
    var candidates=store.database().queryForList("SELECT tenant,case_id,id,payload FROM lab_records WHERE kind='document-experiment-job' AND (payload::jsonb->>'status'='QUEUED' OR (payload::jsonb->>'status'='RUNNING' AND (payload::jsonb->>'leaseUntil')::timestamptz<CURRENT_TIMESTAMP)) ORDER BY created_at LIMIT 1");
    if(candidates.isEmpty())return;
    var candidate=candidates.getFirst();String tenant=candidate.get("tenant").toString(),caseId=candidate.get("case_id").toString(),id=candidate.get("id").toString();
    var previous=store.decode(candidate.get("payload").toString());var claimed=new LinkedHashMap<>(previous);
    int attempt=number(previous.get("attempt"));claimed.put("status",attempt>=3?"FAILED":"RUNNING");claimed.put("attempt",attempt+1);
    claimed.put("leaseUntil",Instant.now().plusSeconds(900).toString());
    if(attempt>=3)claimed.put("errorCode","ATTEMPTS_EXHAUSTED");
    if(!store.replace(tenant,caseId,"document-experiment-job",id,previous,claimed)||attempt>=3)return;
    var completed=new LinkedHashMap<>(claimed);
    try {
      if(store.find(tenant,caseId,"document-experiment",id).isEmpty())run(tenant,caseId,claimed.get("actor").toString(),
          new RunRequest(((Number)claimed.get("caseVersion")).longValue(),claimed.get("datasetId").toString(),Suite.valueOf(claimed.get("suite").toString())),id,false);
      completed.put("status","COMPLETE");
    }catch(RuntimeException error){
      completed.put("status","FAILED");completed.put("errorCode",error instanceof ResponseStatusException r&&r.getStatusCode().value()==409?"SOURCE_CHANGED":"EXPERIMENT_UNAVAILABLE");
    }
    store.replace(tenant,caseId,"document-experiment-job",id,claimed,completed);
  }
  private Map<String,Object> run(String tenant,String id,String actor,RunRequest request,String resultId,boolean reserve) {
    cases.allowWrite(); var item=current(tenant,id,request.caseVersion());
    var dataset=reference(tenant,id,item,request);
    var labels=rows(dataset.get(request.suite()==Suite.EXTRACTION||request.suite()==Suite.PROMPTING?"fields":"questions"));
    if(labels.isEmpty())bad("No labels for this experiment");
    if(reserve)limits.reserve(tenant,actor,"document-experiment",6);
    long start=System.nanoTime();
    var variants=new ArrayList<Map<String,Object>>();
    if(request.suite()==Suite.EXTRACTION)variants.add(extraction(item,labels));
    else if(request.suite()==Suite.PROMPTING){
      var label=labels.getFirst();var doc=source(item,label.get("documentId").toString(),number(label.get("page")));
      variants.addAll(dev.creditlab.assistant.PromptExperiment.compare(promptModel,doc,number(label.get("page")),label.get("field").toString(),label.get("expected").toString()));
    }
    else if(request.suite()==Suite.RETRIEVAL)for(var strategy:RagEngine.Strategy.values())variants.add(retrieval(item,labels,strategy,rag.chunks(item),strategy.name()));
    else for(var strategy:DocumentChunking.Strategy.values()) {
      if(strategy==DocumentChunking.Strategy.SEMANTIC&&!Boolean.TRUE.equals(rag.configuration().get("semantic")))continue;
      long prepare=System.nanoTime();var chunks=rag.chunks(item,strategy);
      var variant=new LinkedHashMap<>(retrieval(item,labels,RagEngine.Strategy.HYBRID,chunks,strategy.name()));
      variant.put("preparationMs",(System.nanoTime()-prepare)/1_000_000);variants.add(variant);
    }
    var result=new LinkedHashMap<String,Object>();
    result.put("id",resultId);result.put("time",Instant.now().toString());result.put("actor",actor);
    result.put("caseVersion",item.version());result.put("sourceHash",fingerprint(item));result.put("datasetId",dataset.get("id"));
    result.put("datasetName",dataset.get("name"));result.put("suite",request.suite().name());result.put("variants",variants);
    result.put("durationMs",(System.nanoTime()-start)/1_000_000);result.put("azureCalls",0);
    result.put("localModelCalls",request.suite()==Suite.PROMPTING?2:0);
    result.put("methodVersion","source-evaluation-v1");result.put("configuration",rag.configuration());
    store.insert(tenant,id,"document-experiment",result.get("id").toString(),result);return result;
  }
  private Map<String,Object> extraction(CreditCase item,List<Map<String,Object>> labels) {
    int tp=0,fp=0,fn=0;var results=new ArrayList<Map<String,Object>>();
    for(var label:labels) {
      var doc=source(item,label.get("documentId").toString(),number(label.get("page")));
      var matches=doc.fields().stream().filter(f->f.page()==number(label.get("page"))&&f.label().equalsIgnoreCase(label.get("field").toString())).toList();
      String expected=label.get("expected").toString();
      boolean pass=matches.size()==1&&normalize(expected).equals(normalize(matches.getFirst().value()));
      if(pass)tp++;else {fn++;fp+=matches.size();}
      var row=new LinkedHashMap<>(label);row.put("actual",matches.stream().map(CreditCase.Field::value).reduce((a,b)->a+" | "+b).orElse(""));
      row.put("passed",pass);row.put("reason",pass?"MATCH":matches.isEmpty()?"MISSING":matches.size()>1?"AMBIGUOUS":"MISMATCH");results.add(row);
    }
    var metrics=new LinkedHashMap<String,Object>();metrics.put("truePositive",tp);metrics.put("falsePositive",fp);metrics.put("falseNegative",fn);
    metrics.put("precision",ratio(tp,tp+fp));metrics.put("recall",ratio(tp,tp+fn));metrics.put("f1",ratio(2*tp,2*tp+fp+fn));
    return Map.of("method","EXTRACTION","samples",labels.size(),"metrics",metrics,"rows",results);
  }
  private Map<String,Object> retrieval(CreditCase item,List<Map<String,Object>> labels,RagEngine.Strategy strategy,List<RagEngine.Chunk> chunks,String method) {
    // Only actual original pages/fields/tables. No generated case summary or policy can be a gold hit.
    var corpus=chunks.stream().filter(c->originals(item).stream().anyMatch(d->d.id().equals(c.documentId()))).toList();
    var results=new ArrayList<Map<String,Object>>();double reciprocal=0;int found=0;
    for(var label:labels) {
      var search=rag.benchmark(item,corpus,label.get("question").toString(),5,strategy);
      int rank=0;for(int i=0;i<search.hits().size();i++){var h=search.hits().get(i);if(h.documentId().equals(label.get("documentId"))&&h.page()==number(label.get("page"))){rank=i+1;break;}}
      if(rank>0){found++;reciprocal+=1.0/rank;}
      var row=new LinkedHashMap<>(label);row.put("rank",rank);row.put("passed",rank>0);row.put("hits",search.hits().stream().map(h->Map.of("id",h.id(),"documentId",h.documentId(),"page",h.page(),"score",h.score())).toList());results.add(row);
    }
    return Map.of("method",method,"samples",labels.size(),"chunks",corpus.size(),"averageCharacters",Math.round(corpus.stream().mapToInt(c->c.text().length()).average().orElse(0)),
        "metrics",Map.of("hitRateAt5",ratio(found,labels.size()),"mrrAt5",Math.round(reciprocal/labels.size()*10000)/100.0),"rows",results);
  }
  /** Private, explicit download. Original PDFs never leave their private store through this export. */
  public Map<String,Object> export(String tenant,String id,String actor,long version) {
    cases.allowWrite();var item=current(tenant,id,version);
    String hash=fingerprint(item),exportId="export-"+UUID.randomUUID();
    var datasets=store.list(tenant,id,"document-reference").stream().filter(d->hash.equals(d.get("sourceHash"))).toList();
    var bundle=new LinkedHashMap<String,Object>();
    bundle.put("format","document-research-assets-v1");bundle.put("id",exportId);bundle.put("time",Instant.now().toString());
    bundle.put("caseId",id);bundle.put("caseVersion",item.version());bundle.put("domain",item.domain());bundle.put("sourceHash",hash);
    bundle.put("destination","browser-download-only");bundle.put("cloudUploaded",false);
    bundle.put("bronze",originals(item).stream().map(d->Map.of("documentId",d.id(),"name",d.name(),"originalIncluded",false)).toList());
    bundle.put("silver",originals(item).stream().map(d->Map.of("documentId",d.id(),"provider",Objects.toString(d.analysisProvider(),"unknown"),"model",Objects.toString(d.modelId(),"unknown"),"pages",d.pages(),"fields",d.fields(),"tables",d.tables())).toList());
    bundle.put("gold",datasets);bundle.put("experiments",store.list(tenant,id,"document-experiment").stream().filter(r->hash.equals(r.get("sourceHash"))).toList());
    // JSONL-ready retrieval inputs for a separately configured Foundry evaluation. No generated answers or judge scores.
    bundle.put("evaluationInputs",datasets.stream().flatMap(d->rows(d.get("questions")).stream()).map(q->{
      var doc=source(item,q.get("documentId").toString(),number(q.get("page")));
      String context=doc.pages().stream().filter(p->p.number()==number(q.get("page"))).map(CreditCase.Page::text).findFirst().orElse("");
      return Map.of("query",q.get("question"),"context",context,"documentId",q.get("documentId"),"page",q.get("page"));
    }).toList());
    store.insert(tenant,id,"data-export",exportId,Map.of("id",exportId,"time",bundle.get("time"),"actor",actor,"sourceHash",hash,"caseVersion",item.version(),"documents",originals(item).size(),"destination","browser-download-only"));
    return bundle;
  }
  private CreditCase current(String tenant,String id,long version) {
    var item=cases.require(tenant,id);if(item.version()!=version)throw new ResponseStatusException(HttpStatus.CONFLICT,"Dossier changed; refresh first");return item;
  }
  static List<CreditCase.Document> originals(CreditCase item) {
    return item.documents().stream().filter(d->d.originalAvailable()&&!d.pages().isEmpty()&&!"missing".equals(d.status())).sorted(Comparator.comparing(CreditCase.Document::id)).toList();
  }
  private CreditCase.Document source(CreditCase item,String id,int page) {
    return originals(item).stream().filter(d->d.id().equals(id)&&d.pages().stream().anyMatch(p->p.number()==page)).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Original document/page not available in this dossier"));
  }
  String fingerprint(CreditCase item) {return RagEngine.hash(store.encode(originals(item)));}
  static String normalize(String value) {return Normalizer.normalize(value,Normalizer.Form.NFKC).strip().replaceAll("\\s+"," ").toLowerCase(Locale.ROOT);}
  private static int number(Object value){return ((Number)value).intValue();}
  private static Double ratio(int numerator,int denominator){return denominator==0?null:Math.round(numerator*10000.0/denominator)/100.0;}
  @SuppressWarnings("unchecked") private static List<Map<String,Object>> rows(Object value){return (List<Map<String,Object>>)value;}
  private static void bad(String message){throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,message);}
}
