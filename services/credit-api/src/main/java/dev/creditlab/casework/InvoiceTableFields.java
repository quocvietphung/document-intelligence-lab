package dev.creditlab.casework;

import java.util.*;

/** Conservative table-label rules over observed OCR, never calculated or guessed invoice totals. */
final class InvoiceTableFields {
  private InvoiceTableFields() {}
  private static String key(String value){return value.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}]","");}
  static List<CreditCase.Field> extract(CreditCase.Document document){
    if(!"invoice".equals(document.type()))return List.of();
    var candidates=new ArrayList<CreditCase.Field>();
    for(var table:document.tables()){
      var headers=table.cells().stream().filter(c->Set.of("grossworth","grosstotal","totalgross","bruttobetrag","totalincludingvat").contains(key(c.text()))).toList();
      if(headers.size()!=1)continue;
      var header=headers.getFirst();
      for(var label:table.cells()){
        if(label.column()>1||label.row()<=header.row()||!Set.of("total","grandtotal","gesamt","gesamtbetrag","endbetrag").contains(key(label.text())))continue;
        var values=table.cells().stream().filter(c->c.row()==label.row()&&c.column()==header.column()).toList();
        if(values.size()!=1)continue;String value=values.getFirst().text().strip();
        if(!value.matches("(?i)(?:[A-Z]{3}|[€$£])?\\s*-?\\d[\\d.,\\s]*"))continue;
        candidates.add(new CreditCase.Field("invoiceTotal",value,null,table.page(),"Table: "+label.text()+" / "+header.text()+" → "+value));
      }
    }
    // Multiple candidate totals require a person to disambiguate, even if confidence is high.
    return candidates.size()==1?List.of(candidates.getFirst()):List.of();
  }
}
