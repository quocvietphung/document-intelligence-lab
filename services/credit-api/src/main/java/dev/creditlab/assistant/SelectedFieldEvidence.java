package dev.creditlab.assistant;

import dev.creditlab.casework.CreditCase;
import dev.creditlab.platform.EvidenceGuard;
import dev.creditlab.platform.RagEngine;
import java.util.*;

/** Preserve structured evidence when an English-focused passage ranking misses a payroll label. */
final class SelectedFieldEvidence {
  private SelectedFieldEvidence() {}
  static List<CreditAssistantService.Source> sources(CreditCase item,String question,List<RagEngine.Hit> hits) {
    var terms=EvidenceGuard.terms(question);
    var eligible=item.documents().stream().filter(d->d.originalAvailable()&&!d.status().equals("missing")
        &&!Set.of("synthetic","datev-reference-values").contains(Objects.requireNonNullElse(d.analysisProvider(),""))
        &&!EvidenceGuard.suspicious(d.name())&&d.pages().stream().noneMatch(p->EvidenceGuard.suspicious(p.text()))).toList();
    var named=eligible.stream().filter(d->EvidenceGuard.terms(d.name()).stream()
        .filter(t->!Set.of("datev","lodas","muster","pdf","payroll","payslip","gehaltsabrechnung").contains(t))
        .filter(t->t.length()>2&&!t.matches("[0-9]+"))
        .anyMatch(terms::contains)).map(CreditCase.Document::id).collect(java.util.stream.Collectors.toSet());
    var retrieved=hits.stream().map(RagEngine.Hit::documentId).collect(java.util.stream.Collectors.toSet());
    var result=new ArrayList<CreditAssistantService.Source>();
    // Explicit location IDs select stored OCR occurrences, not the first matching quote.
    for(var d:eligible)for(var page:d.pages())for(var region:page.regions()){
      String id=d.id()+":p"+page.number()+":"+region.id();
      if(question.contains("["+id+"]")&&!EvidenceGuard.suspicious(region.text())&&result.size()<6){
        String context="";
        if(region.table()!=null&&region.table()>=0&&region.table()<d.tables().size()){
          var cells=d.tables().get(region.table()).cells();boolean typed=cells.stream().anyMatch(c->Boolean.TRUE.equals(c.columnHeader())||Boolean.TRUE.equals(c.rowHeader()));
          context=cells.stream().filter(c->Objects.equals(c.row(),region.row())
              ||Boolean.TRUE.equals(c.columnHeader())&&region.column()!=null&&region.column()>=c.column()&&region.column()<c.column()+c.columnSpan()
              ||Boolean.TRUE.equals(c.rowHeader())&&region.row()!=null&&region.row()>=c.row()&&region.row()<c.row()+c.rowSpan()
              ||!typed&&(c.row()==0||c.column()==0)).map(c->"[row="+(c.row()+1)+",column="+(c.column()+1)+"] "+c.text()).reduce("",(a,b)->a+"\n"+b);
        }
        if(context.length()>1500)context=context.substring(0,1500);
        result.add(new CreditAssistantService.Source(id,d.name()+" · p. "+page.number()+" · "+region.id(),
            "Provider-recorded OCR occurrence, not visually verified: "+region.text()+"\nRaw table context (labels and units are not inferred): "+context));
      }
    }
    if(!result.isEmpty())return List.copyOf(result);
    for(var d:eligible.stream().filter(d->named.isEmpty()?retrieved.contains(d.id()):named.contains(d.id())).limit(3).toList()) {
      var pages=d.fields().stream().filter(f->f.page()>0&&!f.evidence().isBlank()
          &&!EvidenceGuard.suspicious(f.label()+" "+f.value()+" "+f.evidence())&&d.pages().stream().anyMatch(p->p.number()==f.page()))
          .collect(java.util.stream.Collectors.groupingBy(CreditCase.Field::page,TreeMap::new,java.util.stream.Collectors.toList()));
      for(var entry:pages.entrySet()) {
        String text="Current extracted fields; review status="+d.status()+". Compare with original PDF; not a guarantee of accuracy.\n";
        for(var f:entry.getValue()) {
          String line=f.label()+": "+f.value()+"; evidence="+f.evidence()+"\n";
          if(text.length()+line.length()>2400)break;
          text+=line;
        }
        result.add(new CreditAssistantService.Source(d.id()+":p"+entry.getKey()+":fields",d.name()+" · p. "+entry.getKey(),text));
        if(result.size()>=6)return List.copyOf(result);
      }
    }
    return List.copyOf(result);
  }
}
