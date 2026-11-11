package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.*;

import dev.creditlab.assistant.CreditAssistantService.Source;
import java.util.*;
import org.junit.jupiter.api.Test;

class EvidenceContextTest {
  private static Source source(String id,String text){return new Source(id,id,text);}
  private static List<String> ids(EvidenceContext.Selection selection){return selection.sources().stream().map(Source::id).toList();}
  private static final EvidenceContext.Options DEDUPE=new EvidenceContext.Options(true,0);

  @Test void repeatedExcerptOfTheSameDocumentIsSentOnce(){
    var ordered=List.of(
        source("doc-a:p1:c1","Netto-Verdienst 2.967,11 EUR. Auszahlungsbetrag 2.882,11 EUR."),
        source("doc-a:p1:c2","netto-verdienst   2.967,11 EUR."),
        source("case-summary","Applicant=Muster"));
    var selection=EvidenceContext.select(ordered,Map.of(),Set.of(),DEDUPE);
    assertThat(ids(selection)).containsExactly("doc-a:p1:c1","case-summary");
    assertThat(selection.duplicates()).isEqualTo(1);
  }

  @Test void widerExcerptReplacesTheNarrowerOneAtItsRank(){
    var ordered=List.of(source("doc-a:p1:c2","Richtfest 14.11.2026"),source("doc-b:p1:c1","Bauvertrag"),source("doc-a:p1:c1","Projektstatus: Richtfest 14.11.2026, Rohbau fertig."));
    assertThat(ids(EvidenceContext.select(ordered,Map.of(),Set.of(),DEDUPE))).containsExactly("doc-a:p1:c1","doc-b:p1:c1");
  }

  @Test void identicalTextInDifferentDocumentsStaysForComparisons(){
    var ordered=List.of(source("doc-a:p1:c1","Auftragssumme 184.450,00 EUR"),source("doc-b:p1:c1","Auftragssumme 184.450,00 EUR"));
    var selection=EvidenceContext.select(ordered,Map.of(),Set.of(),DEDUPE);
    assertThat(ids(selection)).containsExactly("doc-a:p1:c1","doc-b:p1:c1");
    assertThat(selection.removed()).isZero();
  }

  @Test void fixedSourcesAndExactSelectionsAreNeverRemoved(){
    var ordered=List.of(source("doc-a:p1:fields","Netto: 2.967,11 EUR; Auszahlung: 2.882,11 EUR"),source("doc-a:p1:r2","Netto: 2.967,11 EUR"),
        source("policy","Human review is mandatory."),source("policy","Human review is mandatory."));
    var selection=EvidenceContext.select(ordered,Map.of("doc-a:p1:fields",.9,"doc-a:p1:r2",.01),Set.of("doc-a:p1:r2"),new EvidenceContext.Options(true,.5));
    assertThat(ids(selection)).containsExactly("doc-a:p1:fields","doc-a:p1:r2","policy","policy");
  }

  @Test void relevanceLimitDropsWeakHitsButNeverFixedOrSelectedSources(){
    var ordered=List.of(source("doc-a:p1:c1","Richtfest am 14.11.2026"),source("doc-a:p2:c1","Lenkungsrunde"),source("doc-b:p1:t0:c1","r1 c1: Vertragsstrafe"),
        source("doc-c:p1:r2","Netto: 2.967,11 EUR"),source("policy","Human review is mandatory."));
    var scores=Map.of("doc-a:p1:c1",.37,"doc-a:p2:c1",.15,"doc-b:p1:t0:c1",.14,"doc-c:p1:r2",.01,"policy",.05);
    var selection=EvidenceContext.select(ordered,scores,Set.of("doc-c:p1:r2"),new EvidenceContext.Options(false,.5));
    assertThat(ids(selection)).containsExactly("doc-a:p1:c1","doc-c:p1:r2","policy");
    assertThat(selection.belowRelevance()).isEqualTo(2);
  }

  @Test void comparableDocumentsSurviveTheRelevanceLimit(){
    var ordered=List.of(source("order:p1:fields","Auftragssumme 184.450,00 EUR"),source("change:p1:fields","Nachtragssumme 12.600,00 EUR"),source("invoice:p1:fields","Rechnungsbetrag 198.250,00 EUR"));
    var selection=EvidenceContext.select(ordered,Map.of("order:p1:fields",.655,"change:p1:fields",.58,"invoice:p1:fields",.53),Set.of(),new EvidenceContext.Options(true,.5));
    assertThat(ids(selection)).containsExactly("order:p1:fields","change:p1:fields","invoice:p1:fields");
  }

  @Test void tableRepeatedInThePageTextIsSentOnce(){
    var page=source("doc-a:p1:c1","Rechnung (FIKTIVE DATEN)\nNettobetrag:   42.000,00 EUR\nUmsatzsteuer 19 %:   7.980,00 EUR\nBruttobetrag:   49.980,00 EUR");
    var table=source("doc-a:p1:t0:c1","\nr1 c1: Nettobetrag:\nr1 c2: 42.000,00 EUR\nr2 c1: Umsatzsteuer 19 %:\nr2 c2: 7.980,00 EUR\nr3 c1: Bruttobetrag:\nr3 c2: 49.980,00 EUR");
    var selection=EvidenceContext.select(List.of(table,page),Map.of(),Set.of(),DEDUPE);
    assertThat(ids(selection)).containsExactly("doc-a:p1:c1");assertThat(selection.duplicates()).isEqualTo(1);
    // A cell missing from the page text, another page or another document keeps the table.
    var extra=source("doc-a:p1:t0:c2","\nr4 c1: Zahlungsziel:\nr4 c2: 30 Tage");
    assertThat(ids(EvidenceContext.select(List.of(extra,page),Map.of(),Set.of(),DEDUPE))).containsExactly("doc-a:p1:t0:c2","doc-a:p1:c1");
    assertThat(ids(EvidenceContext.select(List.of(source("doc-a:p2:t0:c1",table.text()),page),Map.of(),Set.of(),DEDUPE))).hasSize(2);
    assertThat(ids(EvidenceContext.select(List.of(source("doc-b:p1:t0:c1",table.text()),page),Map.of(),Set.of(),DEDUPE))).hasSize(2);
  }

  @Test void tableCellsSurviveChunkCuts(){
    assertThat(EvidenceContext.cells("nose: 16.750.000,00 EUR\nr6 c1: Wohnfläche:\nr6 c")).containsExactly("nose: 16.750.000,00 eur","wohnfläche:");
  }

  @Test void baselineChangesNothing(){
    var ordered=List.of(source("doc-a:p1:c1","Netto 2.967,11 EUR"),source("doc-a:p1:c2","Netto 2.967,11 EUR"));
    assertThat(EvidenceContext.select(ordered,Map.of("doc-a:p1:c2",.01),Set.of(),EvidenceContext.Options.baseline()).sources()).isEqualTo(ordered);
  }

  @Test void documentIdsCoverPageChunkFieldAndTableIds(){
    for(String id:List.of("doc-7:p2","doc-7:p2:c3","doc-7:p2:parent1:c4","doc-7:p2:fields","doc-7:p2:t0:c1","doc-7:p2:r5"))assertThat(EvidenceContext.documentOf(id)).isEqualTo("doc-7");
    assertThat(EvidenceContext.documentOf("policy-source")).isEqualTo("policy-source");
  }
}
