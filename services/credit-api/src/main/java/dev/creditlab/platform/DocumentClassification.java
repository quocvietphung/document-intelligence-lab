package dev.creditlab.platform;

import dev.creditlab.casework.*;
import jakarta.validation.constraints.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Authored PDF benchmark, never a replacement for the operational type/review. */
@Service
public class DocumentClassification {
  static final String METHOD="insurance-tfidf-logreg-v1";
  static final List<String> LABELS=List.of("insurance-claim","insurance-policy","invoice","other");
  public record Request(@NotNull UUID requestId,@Min(0) long caseVersion,
      @NotBlank @Pattern(regexp="[a-f0-9]{64}") String datasetFingerprint,@AssertTrue boolean consent) {}
  private final CreditCaseService cases;
  private final LabStore store;
  private final DocumentAnalytics analytics;
  private final DistributedLimits limits;
  private final Path root;
  private final Map<String,Object> manifest,input;

  public DocumentClassification(CreditCaseService cases,LabStore store,DocumentExtractor extractor,
      DocumentAnalytics analytics,DistributedLimits limits,@Value("${app.platform.analytics-root:/app/analytics}") String root){
    this.cases=cases;this.store=store;this.analytics=analytics;this.limits=limits;
    this.root=Path.of(root).toAbsolutePath().normalize();
    try(var stream=new ClassPathResource("classification/manifest.json").getInputStream()){
      manifest=store.decode(new String(stream.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8));
      var observations=new ArrayList<Map<String,Object>>();
      var groups=new HashMap<String,String>();var identities=new HashSet<String>();
      for(var sample:DocumentAnalytics.rows(manifest.get("samples"))){
        String id=sample.get("id").toString(),split=sample.get("split").toString(),group=sample.get("group").toString();
        if(!id.matches("bench-[0-9]{4}")||!identities.add(id)||!sample.get("file").equals(id+".pdf"))throw new IllegalStateException("Invalid PDF identity");
        String previous=groups.putIfAbsent(group,split);if(previous!=null&&!previous.equals(split))throw new IllegalStateException("Template group crosses splits");
        byte[] bytes=fixture(sample);
        try(var pdf=Loader.loadPDF(bytes)){
          if(pdf.isEncrypted()||pdf.getNumberOfPages()!=1)throw new IllegalStateException("One native PDF page required");
          var stripper=new PDFTextStripper();stripper.setSortByPosition(true);String text=stripper.getText(pdf).strip();
          if(text.isBlank()||text.length()>24000)throw new IllegalStateException("Invalid PDF text");
          // Use the actual Java rules, not a Python reimplementation of them.
          var parsed=extractor.parse(id,List.of(new CreditCase.Page(1,text,"pdfbox-native-benchmark")),null);
          var row=new LinkedHashMap<>(sample);row.put("text",text);row.put("ruleType",parsed.type());
          row.put("ruleLabel",LABELS.contains(parsed.type())?parsed.type():"other");observations.add(row);
        }
      }
      String json=store.encode(observations);
      input=Map.of("format","classification-input-v1","datasetVersion",manifest.get("version"),"datasetJson",json,
          "datasetFingerprint",RagEngine.hash(json));
    }catch(Exception e){throw new IllegalStateException("Classification PDF corpus unavailable",e);}
  }
  private byte[] fixture(Map<String,Object> sample)throws Exception{
    String name=sample.get("file").toString();if(!name.matches("bench-[0-9]{4}\\.pdf"))throw new IllegalStateException();
    try(var stream=new ClassPathResource("classification/"+name).getInputStream()){
      byte[] bytes=stream.readAllBytes();
      if(bytes.length>100000||!HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)).equals(sample.get("sha256")))throw new IllegalStateException("PDF checksum changed");
      return bytes;
    }
  }
  public Map<String,Object> read(String tenant,String id){
    var item=cases.require(tenant,id);var response=new LinkedHashMap<String,Object>();
    response.put("caseId",id);response.put("caseVersion",item.version());response.put("datasetFingerprint",input.get("datasetFingerprint"));
    response.put("dataset",manifest);response.put("workerReady",analytics.workerReady());response.put("cloudCalls",0);
    response.put("runs",store.list(tenant,id,"classification-run").stream().map(r->{var copy=new LinkedHashMap<>(r);
      copy.put("current",input.get("datasetFingerprint").equals(r.get("datasetFingerprint")));return copy;}).toList());
    return response;
  }
  public Map<String,Object> benchmarkInput(String tenant,String id){cases.require(tenant,id);return input;}
  public byte[] pdf(String tenant,String id,String sampleId){
    cases.require(tenant,id);
    var sample=DocumentAnalytics.rows(manifest.get("samples")).stream().filter(r->r.get("id").equals(sampleId)).findFirst().orElseThrow(()->fail(404,"Benchmark PDF not found"));
    try{return fixture(sample);}catch(Exception e){throw fail(503,"Benchmark PDF unavailable");}
  }
  public Map<String,Object> enqueue(String tenant,String id,String actor,Request request){
    cases.allowWrite();var item=cases.require(tenant,id);
    if(item.version()!=request.caseVersion()||!input.get("datasetFingerprint").equals(request.datasetFingerprint()))throw fail(409,"Source version changed");
    if(!request.consent())throw fail(422,"Local classification experiment consent required");
    String runId="class-"+request.requestId(),scope=RagEngine.hash(tenant+"|"+id);
    var prior=store.find(tenant,id,"classification-run",runId);
    if(prior.isPresent()){
      if(!request.datasetFingerprint().equals(prior.get().get("datasetFingerprint")))throw fail(409,"Request ID already used");return prior.get();
    }
    if(!store.persistent()||!analytics.workerReady())throw fail(503,"Optional local ML worker unavailable");
    if(store.list(tenant,id,"classification-run").stream().anyMatch(r->"QUEUED".equals(r.get("status"))))throw fail(409,"A classification experiment is pending");
    limits.reserve(tenant,actor,"classification-experiment",4);
    var payload=new LinkedHashMap<>(input);payload.put("id",runId);payload.put("scope",scope);
    var run=new LinkedHashMap<String,Object>();run.put("id",runId);run.put("actor",actor);run.put("time",Instant.now().toString());
    run.put("status","QUEUED");run.put("datasetFingerprint",input.get("datasetFingerprint"));run.put("caseVersion",item.version());run.put("method",METHOD);
    if(!store.insert(tenant,id,"classification-run",runId,run))return store.find(tenant,id,"classification-run",runId).orElseThrow();
    try{
      Path directory=root.resolve("classification-queue").resolve(scope);Files.createDirectories(directory);
      Path temp=Files.createTempFile(directory,"classification-",".tmp");Files.writeString(temp,store.encode(payload));
      Files.move(temp,directory.resolve(runId+".input.json"),StandardCopyOption.ATOMIC_MOVE);
    }catch(Exception e){var failed=new LinkedHashMap<>(run);failed.put("status","FAILED");failed.put("errorCode","CLASSIFICATION_SPOOL_UNAVAILABLE");store.replace(tenant,id,"classification-run",runId,run,failed);throw fail(503,"Classification spool unavailable");}
    return run;
  }
  @Scheduled(fixedDelay=2500,initialDelay=10000)
  public void reconcile(){
    if(!store.persistent())return;
    for(var row:store.database().queryForList("SELECT tenant,case_id,id,payload FROM lab_records WHERE kind='classification-run' AND payload::jsonb->>'status'='QUEUED' ORDER BY created_at LIMIT 20")){
      String tenant=row.get("tenant").toString(),id=row.get("case_id").toString(),runId=row.get("id").toString();
      var before=store.decode(row.get("payload").toString());var after=new LinkedHashMap<>(before);
      try{
        if(!runId.matches("class-[a-f0-9-]{36}"))throw new IllegalStateException();
        Path path=root.resolve("classification-queue").resolve(RagEngine.hash(tenant+"|"+id)).resolve(runId+".result.json");
        if(!Files.isRegularFile(path,LinkOption.NOFOLLOW_LINKS)){
          if(Instant.parse(before.get("time").toString()).isAfter(Instant.now().minusSeconds(600)))continue;
          after.put("status","FAILED");after.put("errorCode","CLASSIFICATION_TIMEOUT");
        }else{
          if(Files.size(path)>2_000_000)throw new IllegalStateException();var receipt=store.decode(Files.readString(path));
          if(!runId.equals(receipt.get("id"))||!before.get("datasetFingerprint").equals(receipt.get("datasetFingerprint")))throw new IllegalStateException();
          if("COMPLETE".equals(receipt.get("status"))){
            var result=DocumentAnalytics.object(receipt.get("result"));
            if(!METHOD.equals(result.get("method"))||!before.get("datasetFingerprint").equals(result.get("datasetFingerprint"))||!LABELS.equals(result.get("labels"))||!List.of("pageText").equals(result.get("modelInputs")))throw new IllegalStateException();
            after.put("status","COMPLETE");after.put("result",result);
          }else{after.put("status","FAILED");after.put("errorCode","CLASSIFICATION_EVALUATION_FAILED");}
          after.put("finishedAt",receipt.get("finishedAt"));
        }
      }catch(Exception e){after.put("status","FAILED");after.put("errorCode","CLASSIFICATION_RECEIPT_UNAVAILABLE");}
      store.replace(tenant,id,"classification-run",runId,before,after);
    }
  }
  private static ResponseStatusException fail(int code,String message){return new ResponseStatusException(HttpStatus.valueOf(code),message);}
}
