package dev.creditlab.casework;

import java.time.Instant;
import java.util.*;
import jakarta.validation.constraints.*;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CreditCaseService {
  private final CaseStore store;
  private final boolean sourceOnly;
  @Value("${app.writes-enabled:false}") private boolean writesEnabled;
  @Autowired(required=false) private dev.creditlab.platform.LabStore reviewStore;
  public CreditCaseService() { this(new CaseStore()); }
  public CreditCaseService(CaseStore store){this(store,true);}
  @Autowired public CreditCaseService(CaseStore store,@Value("${app.demo-seed-enabled:false}") boolean seedFixtures) {
    this.store=store;this.sourceOnly=!seedFixtures;
    if(!seedFixtures)return; // Fixtures are explicit test input, never startup application data.
    store.insert(new CreditCase("CR-2026-1048","praxisbank-demo","Dr. Lea Hoffmann","Praxisübernahme",480_000,0,"HUMAN_REVIEW",
      List.of("Praxisbewertung"), List.of(new CreditCase.ValidationIssue("MONTHLY_RATE_CONFLICT","MEDIUM","Kontoauszug: 1250 EUR; Selbstauskunft: 980 EUR",true)),
      "Jonas Hoffmann","2026-10-08T14:32:00Z",List.of(
        new CreditCase.Document("doc-1","datev-lodas-2025-robert-muster.pdf","income","review",null,
          List.of(new CreditCase.Field("netIncome","2.967,11 EUR",null,1,"DATEV LODAS 2025 Robert-Muster reference value; not extracted"),
                  new CreditCase.Field("payoutAmount","2.882,11 EUR",null,1,"DATEV LODAS 2025 Robert-Muster reference value; not extracted")),
          List.of(new CreditCase.Page(1,"DATEV LODAS 2025 publisher page 2 reference values only. Original not uploaded; no OCR or Azure analysis. Robert-Muster is not the applicant. Import the approved official page before evidence review.","publisher-reference-values")),false,
          "datev-reference-values","publisher-reference-not-ai","text/plain"),
        fixture("doc-2","Kontoauszug_Q3.pdf","statement","review",List.of(new CreditCase.Field("monthlyRate","1250 EUR",null,1,"Synthetic fixture: Monatliche Rate 1250 EUR"))),
        fixture("doc-3","Identitätsnachweis","identity","verified",List.of()),
        fixture("doc-4","Praxisbewertung","valuation","missing",List.of())),List.of(event("FIXTURE_CREATED","synthetic-seed")),0));
    store.insert(new CreditCase("CR-2026-1049","praxisbank-demo","Dr. Felix Weber","Modernisierung",120_000,0,"DRAFT",List.of("income","statement"),List.of(),"","2026-10-09T10:00:00Z",List.of(),List.of(event("FIXTURE_CREATED","synthetic-seed")),0));
  }
  private CreditCase.Document fixture(String id,String name,String type,String status,List<CreditCase.Field> fields) {
    return new CreditCase.Document(id,name,type,status,null,fields,List.of(new CreditCase.Page(1,"Synthetic fixture; no original uploaded.","fixture")),false,
        "synthetic","fixture-v1","text/plain");
  }
  public List<CreditCase> findAll(String tenant) { return store.list(tenant).stream().filter(c->!sourceOnly||!Set.of("CR-2026-1048","CR-2026-1049").contains(c.id())||c.documents().stream().anyMatch(CreditCase.Document::originalAvailable)).map(c->sourceOnly?documentView(c):c).toList(); }
  public Optional<CreditCase> findById(String tenant,String id) { return store.get(tenant,id).map(c->sourceOnly?documentView(c):c); }
  private CreditCase stored(String tenant,String id){return store.get(tenant,id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));}
  private CreditCase visible(CreditCase item){return sourceOnly?documentView(item):item;}
  /** Keep archived metadata/documents in storage while persisting current source-derived workflow state. */
  private CreditCase canonical(CreditCase item){
    if(!sourceOnly)return item;
    var view=documentView(item);
    return new CreditCase(item.id(),item.tenantId(),item.applicant(),item.purpose(),item.amountEuro(),view.completeness(),view.status(),view.missingDocuments(),view.validationIssues(),item.coApplicant(),item.submittedAt(),item.documents(),item.audit(),item.version(),item.domain());
  }
  /** Non-destructive projection: stored originals/history retained; placeholders never become evidence. */
  static CreditCase documentView(CreditCase c){
    var docs=c.documents().stream().filter(CreditCase.Document::originalAvailable).toList();
    var missing=new ArrayList<String>();for(String type:DocumentDomain.required(c.domain()))if(docs.stream().noneMatch(d->d.type().equals(type)))missing.add(type);
    var issues=new ArrayList<CreditCase.ValidationIssue>();var rates=new HashSet<String>();
    for(var doc:docs){if(!doc.status().equals("verified"))issues.add(new CreditCase.ValidationIssue("UNREVIEWED_DOCUMENT","MEDIUM",doc.id(),true));for(var f:doc.fields())if(f.label().equals("monthlyRate"))rates.add(FieldValueNormalizer.normalize(f.label(),f.value()));}
    if(rates.size()>1)issues.add(new CreditCase.ValidationIssue("MONTHLY_RATE_CONFLICT","HIGH","Different monthlyRate values extracted from uploaded documents",true));
    int progress=docs.isEmpty()?0:(int)(100*docs.stream().filter(d->d.status().equals("verified")).count()/Math.max(Math.max(1,DocumentDomain.required(c.domain()).size()),docs.size()));
    return new CreditCase(c.id(),c.tenantId(),c.applicant(),c.purpose(),c.amountEuro(),progress,docs.isEmpty()?"DRAFT":issues.isEmpty()&&missing.isEmpty()?"REVIEW_COMPLETE":"HUMAN_REVIEW",missing,issues,c.coApplicant(),c.submittedAt(),docs,c.audit(),c.version(),c.domain());
  }
  public CreditCase require(String tenant,String id) { return findById(tenant,id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND)); }
  public record Draft(@NotBlank @Size(max=120) String applicant,@NotBlank @Size(max=160) String purpose,
      @Min(0) @Max(10_000_000) long amountEuro,@Size(max=120) String coApplicant,@Min(0) long version,
      @Pattern(regexp="banking|insurance|general") String domain) {
    public Draft(String applicant,String purpose,long amountEuro,String coApplicant,long version) {
      this(applicant,purpose,amountEuro,coApplicant,version,null);
    }
  }
  public void allowWrite() {
    if(!writesEnabled || !(store instanceof SqlCaseStore)) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Persistent writing is not configured");
  }
  public CreditCase create(String tenant,String actor,Draft draft) {
    allowWrite();
    String domain=DocumentDomain.normalize(draft.domain());
    var item=new CreditCase("CR-"+UUID.randomUUID().toString().substring(0,12),tenant,draft.applicant().strip(),draft.purpose().strip(),draft.amountEuro(),0,"DRAFT",DocumentDomain.required(domain),List.of(),Objects.requireNonNullElse(draft.coApplicant(),""),Instant.now().toString(),List.of(),List.of(event("CASE_CREATED",actor)),0,domain);
    store.insert(item); return item;
  }
  public CreditCase edit(String tenant,String id,String actor,Draft draft) {
    allowWrite(); var old=stored(tenant,id); checkVersion(old,draft.version());
    String domain=draft.domain()==null?old.domain():DocumentDomain.normalize(draft.domain());
    var item=new CreditCase(id,tenant,draft.applicant().strip(),draft.purpose().strip(),draft.amountEuro(),old.completeness(),old.status(),old.missingDocuments(),old.validationIssues(),Objects.requireNonNullElse(draft.coApplicant(),""),old.submittedAt(),old.documents(),audit(old,"CASE_EDITED",actor),old.version()+1,domain);
    item=canonical(item);save(item,old.version()); return visible(item);
  }
  public CreditCase attach(String tenant,String id,String actor,byte[] bytes,CreditCase.Document doc,long version) {
    allowWrite(); var old=stored(tenant,id); checkVersion(old,version);
    if(visible(old).documents().size()>=12) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Document limit reached");
    var docs=new ArrayList<>(old.documents()); docs.add(doc);
    var updated=rebuild(old,docs,"DOCUMENT_EXTRACTED",actor);
    ((SqlCaseStore)store).attach(updated,old.version(),doc.id(),bytes); return visible(updated);
  }
  public record Review(@Min(0) long version,@Size(max=20) List<@NotBlank @Size(max=300) String> values) {}
  @org.springframework.transaction.annotation.Transactional
  public CreditCase review(String tenant,String id,String docId,String actor,Review review) {
    allowWrite(); var old=stored(tenant,id); checkVersion(old,review.version());
    var doc=old.documents().stream().filter(d->d.id().equals(docId)).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
    if(!doc.originalAvailable() || doc.fields().isEmpty() || review.values()==null || review.values().size()!=doc.fields().size()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Evidence-backed fields required");
    var fields=new ArrayList<CreditCase.Field>();
    for(int i=0;i<doc.fields().size();i++) { var f=doc.fields().get(i); fields.add(new CreditCase.Field(f.label(),review.values().get(i).strip(),f.confidence(),f.page(),f.evidence(),f.originalValue())); }
    var revised=new CreditCase.Document(doc.id(),doc.name(),doc.type(),"verified",doc.confidence(),fields,doc.pages(),true,
        doc.analysisProvider(),doc.modelId(),doc.contentType(),doc.tables(),doc.ocrCorrections());
    var docs=old.documents().stream().map(d->d.id().equals(docId)?revised:d).toList();
    var updated=rebuild(old,docs,"DOCUMENT_REVIEWED",actor); save(updated,old.version());
    if(reviewStore!=null){long changed=java.util.stream.IntStream.range(0,fields.size()).filter(i->!fields.get(i).value().equals(doc.fields().get(i).value())).count();
      reviewStore.insert(tenant,id,"field-review",docId+"-v"+updated.version(),Map.of("documentId",docId,"caseVersion",updated.version(),"fieldsReviewed",fields.size(),"fieldsChanged",changed,"time",Instant.now().toString()));}
    return visible(updated);
  }
  public record OcrEdit(@Min(0) long version,@Min(1) @Max(4) int page,
      @NotBlank @Size(max=80) String sourceId,@NotBlank @Size(max=1000) String originalText,
      @NotBlank @Size(max=1000) String correctedText,@NotBlank @Size(max=500) String reason) {}

  /** Append a human transcription; never rewrite OCR, fields, old answers, or approval. */
  @org.springframework.transaction.annotation.Transactional
  public CreditCase correctOcr(String tenant,String id,String docId,String actor,OcrEdit edit) {
    allowWrite();var old=stored(tenant,id);checkVersion(old,edit.version());
    var doc=old.documents().stream().filter(d->d.id().equals(docId)&&d.originalAvailable()).findFirst()
        .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
    var page=doc.pages().stream().filter(p->p.number()==edit.page()).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown source page"));
    boolean source=page.regions().stream().anyMatch(r->r.id().equals(edit.sourceId())&&r.text().equals(edit.originalText()))
        ||(edit.sourceId().equals("page")&&page.text().equals(edit.originalText()))
        ||java.util.stream.IntStream.range(0,doc.fields().size()).anyMatch(i->edit.sourceId().equals("field-"+i)&&doc.fields().get(i).page()==edit.page()&&doc.fields().get(i).originalValue().equals(edit.originalText()));
    if(!source||edit.originalText().equals(edit.correctedText().strip())||doc.ocrCorrections().size()>=100)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Exact stored OCR source and a changed transcription required");
    var corrections=new ArrayList<>(doc.ocrCorrections());
    corrections.add(new CreditCase.OcrCorrection(UUID.randomUUID().toString(),edit.page(),edit.sourceId(),edit.originalText(),edit.correctedText().strip(),edit.reason().strip(),actor,Instant.now().toString()));
    var revised=new CreditCase.Document(doc.id(),doc.name(),doc.type(),"review",doc.confidence(),doc.fields(),doc.pages(),true,doc.analysisProvider(),doc.modelId(),doc.contentType(),doc.tables(),corrections);
    var updated=rebuild(old,old.documents().stream().map(d->d.id().equals(docId)?revised:d).toList(),"OCR_TRANSCRIPTION_RECORDED",actor);
    save(updated,old.version());return visible(updated);
  }
  private CreditCase rebuild(CreditCase old,List<CreditCase.Document> docs,String action,String actor) {
    var issues=new ArrayList<CreditCase.ValidationIssue>(); var values=new HashSet<String>();
    for(var doc:docs) {
      if(doc.status().equals("review")) issues.add(new CreditCase.ValidationIssue("UNREVIEWED_DOCUMENT","MEDIUM",doc.id(),true));
      for(var f:doc.fields()) if(f.label().equals("monthlyRate")) values.add(FieldValueNormalizer.normalize(f.label(),f.value()));
    }
    if(values.size()>1) issues.add(new CreditCase.ValidationIssue("MONTHLY_RATE_CONFLICT","HIGH","Different monthlyRate values in documents",true));
    var missing=new ArrayList<String>();
    for(String type:DocumentDomain.required(old.domain())) if(docs.stream().noneMatch(d->d.type().equals(type))) missing.add(type);
    long reviewed=docs.stream().filter(d->d.originalAvailable()&&d.status().equals("verified")).count();
    int progress=docs.isEmpty()?0:(int)(100*reviewed/Math.max(Math.max(1,DocumentDomain.required(old.domain()).size()),docs.size()));
    return canonical(new CreditCase(old.id(),old.tenantId(),old.applicant(),old.purpose(),old.amountEuro(),progress,issues.isEmpty()&&missing.isEmpty()?"REVIEW_COMPLETE":"HUMAN_REVIEW",missing,issues,old.coApplicant(),old.submittedAt(),docs,audit(old,action,actor),old.version()+1,old.domain()));
  }
  private void checkVersion(CreditCase old,long expected) { if(old.version()!=expected) throw new ResponseStatusException(HttpStatus.CONFLICT,"Reload latest case version"); }
  private void save(CreditCase item,long previous) { if(!store.update(item,previous)) throw new ResponseStatusException(HttpStatus.CONFLICT,"Concurrent change; reload case"); }
  private List<String> event(String action,String actor) { return List.of(Instant.now().toString(),action,actor); }
  private List<List<String>> audit(CreditCase old,String action,String actor) { var rows=new ArrayList<>(old.audit()); rows.add(event(action,actor)); return rows; }
  public Optional<byte[]> file(String tenant,String id,String doc) { require(tenant,id); return store.file(tenant,id,doc); }
  public void expirePipelineDocument(String tenant,String id,String docId) {
    allowWrite();var old=stored(tenant,id);
    if(old.documents().stream().noneMatch(d->d.id().equals(docId)))return;
    var docs=old.documents().stream().filter(d->!d.id().equals(docId)).toList();
    var updated=rebuild(old,docs,"PIPELINE_DOCUMENT_EXPIRED","retention-worker");
    ((SqlCaseStore)store).expire(updated,old.version(),docId);
  }
  public void reserve(String tenant,String id,String actor,int tokens) { require(tenant,id); store.reserve(tenant,actor,tokens); }
  public dev.creditlab.assistant.AiQuotaPolicy quotaPolicy(){return store.quotaPolicy();}
  public void recordAiUse(String requestId,String tenant,String id,String actor,String mode) {
    require(tenant,id); store.recordAiUse(requestId,tenant,id,actor,mode);
  }
}
