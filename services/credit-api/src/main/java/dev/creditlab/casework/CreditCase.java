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
  public record Field(String label, String value, Integer confidence, int page, String evidence) {}
  public record Page(int number, String text, String method) {}
  public record TableCell(int row,int column,String text) {}
  public record Table(int page,int rows,int columns,List<TableCell> cells) {}
  public record Document(String id, String name, String type, String status, Integer confidence,
      List<Field> fields, List<Page> pages, boolean originalAvailable, String analysisProvider,
      String modelId, String contentType,List<Table> tables) {
    public Document { tables=tables==null?List.of():List.copyOf(tables); }
    public Document(String id,String name,String type,String status,Integer confidence,List<Field> fields,List<Page> pages,
        boolean originalAvailable,String analysisProvider,String modelId,String contentType) {
      this(id,name,type,status,confidence,fields,pages,originalAvailable,analysisProvider,modelId,contentType,List.of());
    }
  }
}
