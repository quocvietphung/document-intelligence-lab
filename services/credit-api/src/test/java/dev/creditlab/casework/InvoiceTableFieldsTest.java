package dev.creditlab.casework;

import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class InvoiceTableFieldsTest {
  private CreditCase.Table summary(String value){return new CreditCase.Table(1,3,5,List.of(new CreditCase.TableCell(0,2,"Net Worth"),new CreditCase.TableCell(0,3,"VAT"),new CreditCase.TableCell(0,4,"Gross Worth"),new CreditCase.TableCell(2,0,"Total"),new CreditCase.TableCell(2,2,"INR 1,676,976.00"),new CreditCase.TableCell(2,3,"INR 167,697.60"),new CreditCase.TableCell(2,4,value)));}
  private CreditCase.Document doc(String type,List<CreditCase.Table> tables){return new CreditCase.Document("doc","source.pdf",type,"review",99,List.of(),List.of(),true,"azure-document-intelligence","prebuilt-layout","application/pdf",tables);}
  @Test void selectsObservedGrossTotalNotNetOrVatAndDoesNotInventConfidence(){
    var fields=InvoiceTableFields.extract(doc("invoice",List.of(summary("INR 1,844,673.60"))));
    assertThat(fields).hasSize(1);var field=fields.getFirst();assertThat(field.label()).isEqualTo("invoiceTotal");assertThat(field.value()).isEqualTo("INR 1,844,673.60");assertThat(field.confidence()).isNull();assertThat(field.page()).isEqualTo(1);assertThat(field.evidence()).contains("Gross Worth","Total");
  }
  @Test void rejectsAmbiguousTotalsAndNonInvoiceDocuments(){
    assertThat(InvoiceTableFields.extract(doc("invoice",List.of(summary("EUR 100.00"),summary("EUR 200.00"))))).isEmpty();
    assertThat(InvoiceTableFields.extract(doc("insurance-wording",List.of(summary("EUR 100.00"))))).isEmpty();
    assertThat(InvoiceTableFields.extract(doc("invoice",List.of(summary("unreadable"))))).isEmpty();
  }
  @Test void doesNotComputeAnAmountFromLineItemsOrAssumeAGrossColumn(){
    var table=new CreditCase.Table(1,2,2,List.of(new CreditCase.TableCell(0,0,"Description"),new CreditCase.TableCell(0,1,"Net Worth"),new CreditCase.TableCell(1,0,"Total"),new CreditCase.TableCell(1,1,"100.00")));
    assertThat(InvoiceTableFields.extract(doc("invoice",List.of(table)))).isEmpty();
  }
}
