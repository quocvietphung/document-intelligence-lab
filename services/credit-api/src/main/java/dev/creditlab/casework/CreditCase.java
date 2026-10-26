package dev.creditlab.casework;

import java.util.List;

public record CreditCase(
    String id,
    String tenantId,
    String applicant,
    String purpose,
    long amountEuro,
    int completeness,
    String status,
    List<String> missingDocuments,
    List<ValidationIssue> validationIssues,
    String coApplicant,
    String submittedAt,
    List<Document> documents,
    List<List<String>> audit,
    long version,
    String domain) {
  public CreditCase {
    // Historical JSON has no domain. Keep those dossiers and DATEV originals in banking.
    domain = DocumentDomain.normalize(domain);
  }
  public CreditCase(String id,String tenantId,String applicant,String purpose,long amountEuro,int completeness,
      String status,List<String> missingDocuments,List<ValidationIssue> validationIssues,String coApplicant,
      String submittedAt,List<Document> documents,List<List<String>> audit,long version) {
    this(id,tenantId,applicant,purpose,amountEuro,completeness,status,missingDocuments,validationIssues,
        coApplicant,submittedAt,documents,audit,version,"banking");
  }
  public record ValidationIssue(String code, String severity, String message, boolean humanReviewRequired) {}
  public record Field(String label, String value, Integer confidence, int page, String evidence, String originalValue) {
    public Field { originalValue=originalValue==null?value:originalValue; }
    public Field(String label,String value,Integer confidence,int page,String evidence){this(label,value,confidence,page,evidence,value);}
  }
  /** Provider-observed location. Coordinates are normalized, top-left; never inferred from a quote. */
  public record Region(String id,String text,double left,double top,double right,double bottom,
      double pageWidth,double pageHeight,Integer table,Integer row,Integer column) {}
  public record Page(int number, String text, String method,List<Region> regions) {
    public Page { regions=regions==null?List.of():List.copyOf(regions); }
    public Page(int number,String text,String method){this(number,text,method,List.of());}
  }
  public record OcrCorrection(String id,int page,String sourceId,String originalText,String correctedText,String reason,String actor,String time) {}
  public record TableCell(int row,int column,String text) {}
  public record Table(int page,int rows,int columns,List<TableCell> cells) {}
  public record Document(String id, String name, String type, String status, Integer confidence,
      List<Field> fields, List<Page> pages, boolean originalAvailable, String analysisProvider,
      String modelId, String contentType,List<Table> tables,List<OcrCorrection> ocrCorrections) {
    public Document { tables=tables==null?List.of():List.copyOf(tables);ocrCorrections=ocrCorrections==null?List.of():List.copyOf(ocrCorrections); }
    public Document(String id,String name,String type,String status,Integer confidence,List<Field> fields,List<Page> pages,
        boolean originalAvailable,String analysisProvider,String modelId,String contentType,List<Table> tables) {
      this(id,name,type,status,confidence,fields,pages,originalAvailable,analysisProvider,modelId,contentType,tables,List.of());
    }
    public Document(String id,String name,String type,String status,Integer confidence,List<Field> fields,List<Page> pages,
        boolean originalAvailable,String analysisProvider,String modelId,String contentType) {
      this(id,name,type,status,confidence,fields,pages,originalAvailable,analysisProvider,modelId,contentType,List.of());
    }
  }
}
