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
        &&d.pages().stream().noneMatch(p->EvidenceGuard.suspicious(p.text()))).toList();
    var named=eligible.stream().filter(d->EvidenceGuard.terms(d.name()).stream()
        .filter(t->!Set.of("datev","lodas","muster","pdf","payroll","payslip","gehaltsabrechnung").contains(t))
        .filter(t->t.length()>2&&!t.matches("[0-9]+"))
        .anyMatch(terms::contains)).map(CreditCase.Document::id).collect(java.util.stream.Collectors.toSet());
    var retrieved=hits.stream().map(RagEngine.Hit::documentId).collect(java.util.stream.Collectors.toSet());
    var result=new ArrayList<CreditAssistantService.Source>();
    for(var d:eligible.stream().filter(d->named.isEmpty()?retrieved.contains(d.id()):named.contains(d.id())).limit(3).toList()) {
      var pages=d.fields().stream().filter(f->f.page()>0&&!f.evidence().isBlank()
          &&!EvidenceGuard.suspicious(f.evidence())&&d.pages().stream().anyMatch(p->p.number()==f.page()))
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
