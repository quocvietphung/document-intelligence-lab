package dev.creditlab.casework;

import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.*;
import javax.imageio.ImageIO;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DocumentExtractor {
  @Value("${app.ocr-enabled:false}") private boolean ocrEnabled;
  private final Semaphore slots=new Semaphore(2);
  public CreditCase.Document extract(String name,byte[] bytes) {
    return extract(name,"application/octet-stream",bytes);
  }
  public CreditCase.Document extract(String name,String contentType,byte[] bytes) {
    if(bytes.length==0 || bytes.length>3_000_000) throw bad("Empty file or file exceeds 3 MB");
    if(!slots.tryAcquire()) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"OCR busy; retry later");
    try {
      var pages=new ArrayList<CreditCase.Page>(); Integer confidence=null;
      if(bytes.length>4 && new String(bytes,0,4,StandardCharsets.US_ASCII).equals("%PDF")) {
        try(var pdf=Loader.loadPDF(bytes)) {
          if(pdf.isEncrypted() || pdf.getNumberOfPages()>4) throw bad("Use unencrypted PDF, maximum 4 pages");
          var renderer=new PDFRenderer(pdf);
          for(int p=1;p<=pdf.getNumberOfPages();p++) {
            var stripper=new PDFTextStripper(); stripper.setStartPage(p); stripper.setEndPage(p);
            String text=stripper.getText(pdf).strip(); String method="pdf-text";
            if(text.length()<20) {
              var box=pdf.getPage(p-1).getCropBox();
              if(box.getWidth()<=0 || box.getHeight()<=0) throw bad("Invalid page dimensions");
              float scale=Math.min(2f,1600f/Math.max(box.getWidth(),box.getHeight()));
              var result=ocr(renderer.renderImage(p-1,scale)); text=result.text(); confidence=result.confidence(); method="tesseract-deu-eng";
            }
            pages.add(new CreditCase.Page(p,bounded(text),method));
          }
        }
      } else if(name.toLowerCase(Locale.ROOT).endsWith(".txt")) {
        if(bytes.length>50_000) throw bad("Text file too large");
        String text=new String(bytes,StandardCharsets.UTF_8);
        if(text.indexOf('\0')>=0) throw bad("Invalid text file");
        pages.add(new CreditCase.Page(1,bounded(text),"utf8-text"));
      } else {
        try(var input=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
          var readers=ImageIO.getImageReaders(input); if(!readers.hasNext()) throw bad("Only PDF, PNG, JPEG or UTF-8 TXT supported");
          var reader=readers.next();
          try { reader.setInput(input); String format=reader.getFormatName();
            if(!format.equalsIgnoreCase("png")&&!format.equalsIgnoreCase("jpeg")) throw bad("Only PNG or JPEG images supported");
            if((long)reader.getWidth(0)*reader.getHeight(0)>6_000_000) throw bad("Image exceeds 6 megapixels");
            var result=ocr(reader.read(0)); confidence=result.confidence(); pages.add(new CreditCase.Page(1,bounded(result.text()),"tesseract-deu-eng"));
          } finally { reader.dispose(); }
        }
      }
      if(pages.stream().allMatch(p->p.text().isBlank())) throw bad("No readable text; use a clearer document");
      return parse(name,pages,confidence,"local","pdfbox-tesseract-rules",contentType);
    } catch(ResponseStatusException e) { throw e; }
      catch(Exception e) { throw bad("Document could not be read safely"); }
      finally { slots.release(); }
  }
  private String bounded(String text) { if(text.length()>12_000) throw bad("Page text exceeds safe processing limit"); return text; }
  private ResponseStatusException bad(String reason) { return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,reason); }
  private record OcrResult(String text,Integer confidence) {}
  private OcrResult ocr(BufferedImage image) throws Exception {
    if(!ocrEnabled) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"OCR not configured");
    Path directory=Files.createTempDirectory("credit-ocr-");
    Path input=directory.resolve("page.png"), output=directory.resolve("words.tsv");
    Process process=null;
    try {
      ImageIO.write(image,"png",input.toFile());
      process=new ProcessBuilder("tesseract",input.toString(),"stdout","-l","deu+eng","--psm","6","tsv")
        .redirectOutput(output.toFile()).redirectError(ProcessBuilder.Redirect.DISCARD).start();
      if(!process.waitFor(8,TimeUnit.SECONDS)) { process.destroyForcibly(); throw bad("OCR timeout"); }
      if(process.exitValue()!=0 || Files.size(output)>1_000_000) throw bad("OCR failed or output too large");
      var text=new StringBuilder(); double sum=0; int count=0; String previous="";
      for(String line:Files.readAllLines(output)) {
        String[] c=line.split("\t",12); if(c.length!=12 || !c[0].equals("5") || c[11].isBlank()) continue;
        String group=c[1]+":"+c[2]+":"+c[3]+":"+c[4];
        text.append(group.equals(previous)?" ":"\n").append(c[11]); previous=group;
        double v=Double.parseDouble(c[10]); if(v>=0) { sum+=v; count++; }
      }
      return new OcrResult(text.toString().strip(),count==0?null:(int)Math.round(sum/count));
    } finally {
      if(process!=null && process.isAlive()) process.destroyForcibly();
      Files.deleteIfExists(input); Files.deleteIfExists(output); Files.deleteIfExists(directory);
    }
  }
  /** Transparent label rules, not a trained financial classifier. Values always retain page evidence. */
  public CreditCase.Document parse(String name,List<CreditCase.Page> pages,Integer confidence) {
    return parse(name,pages,confidence,"local","transparent-label-rules","text/plain");
  }
  public CreditCase.Document parse(String name,List<CreditCase.Page> pages,Integer confidence,
      String provider,String modelId,String contentType) {
    String all=pages.stream().map(CreditCase.Page::text).reduce("",(a,b)->a+"\n"+b).toLowerCase(Locale.ROOT);
    String type=classify(all);
    String[][] labels={{"netIncome","Nettoeinkommen|Net income|Netto-Verdienst|Nettoverdienst|Nettogehalt|Nettolohn"},{"payoutAmount","Auszahlungsbetrag|Nettoauszahlung|Payout amount"},{"employer","Arbeitgeber|Employer"},{"monthlyRate","Monatliche Rate|Monthly rate"},{"balance","Kontostand|Balance"},{"date","Datum|Date"},
      {"policyNumber","Versicherungsnummer|Versicherungsschein-Nr\\.?|Policennummer|Policy number"},
      {"insurer","Versicherer|Insurance company|Insurer"},{"policyholder","Versicherungsnehmer(?:in)?|Policyholder"},
      {"premium","Jahresbeitrag|Versicherungsbeitrag|Annual premium|Premium"},{"deductible","Selbstbeteiligung|Deductible"},
      {"coverageAmount","Deckungssumme|Versicherungssumme|Coverage amount"},{"coverageStart","Versicherungsbeginn|Coverage start"},
      {"coverageEnd","Versicherungsende|Coverage end"},{"claimNumber","Schadennummer|Claim number"},
      {"claimDate","Schadendatum|Date of loss"},{"invoiceNumber","Rechnungsnummer|Invoice number"},
      {"invoiceTotal","Gesamtbetrag|Rechnungsbetrag|Invoice total"},{"contractNumber","Vertragsnummer|Contract number"}};
    var fields=new ArrayList<CreditCase.Field>();
    for(var page:pages) for(String[] label:labels) {
      var pattern=Pattern.compile("(?im)^\\s*(?:"+label[1]+")\\s*:\\s*([^\\r\\n]{1,300})");
      var match=pattern.matcher(page.text());
      while(match.find()) fields.add(new CreditCase.Field(label[0],match.group(1).strip(),null,page.number(),match.group().strip()));
    }
    if(fields.size()>20) throw bad("Too many extracted fields");
    return new CreditCase.Document("doc-"+UUID.randomUUID(),name,type,"review",confidence,fields,pages,true,
        provider,modelId,contentType);
  }

  static String classify(String all) {
    if(all.contains("gehaltsabrechnung")||all.contains("entgeltabrechnung")||all.contains("abrechnung der brutto/netto-bezüge"))return "income";
    if(all.contains("kontoauszug")||all.contains("account statement"))return "statement";
    if(all.contains("schadenmeldung")||all.contains("claim notification"))return "insurance-claim";
    if(all.contains("versicherungsschein")||all.contains("insurance policy")||all.contains("policennummer"))return "insurance-policy";
    if(all.contains("rechnungsnummer")||all.contains("invoice number"))return "invoice";
    if(all.contains("vertragsnummer")||all.contains("contract number"))return "contract";
    return all.contains("selbstauskunft")?"disclosure":all.contains("praxisbewertung")?"valuation":"unknown";
  }

  static Optional<String> canonicalFieldLabel(String rawLabel) {
    String label=rawLabel.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}]","");
    if(Set.of("nettoeinkommen","netincome","nettoverdienst","nettogehalt","nettolohn").contains(label)) return Optional.of("netIncome");
    if(Set.of("auszahlungsbetrag","nettoauszahlung","payoutamount").contains(label)) return Optional.of("payoutAmount");
    if(label.contains("arbeitgeber")||label.contains("employer")) return Optional.of("employer");
    if(label.contains("monatlicherate")||label.contains("monthlyrate")) return Optional.of("monthlyRate");
    if(label.contains("kontostand")||label.contains("balance")) return Optional.of("balance");
    if(label.equals("datum")||label.equals("date")) return Optional.of("date");
    if(Set.of("versicherungsnummer","versicherungsscheinnr","policennummer","policynumber").contains(label))return Optional.of("policyNumber");
    if(Set.of("versicherer","insurer","insurancecompany").contains(label))return Optional.of("insurer");
    if(Set.of("versicherungsnehmer","versicherungsnehmerin","policyholder").contains(label))return Optional.of("policyholder");
    if(Set.of("jahresbeitrag","versicherungsbeitrag","annualpremium","premium").contains(label))return Optional.of("premium");
    if(Set.of("selbstbeteiligung","deductible").contains(label))return Optional.of("deductible");
    if(Set.of("deckungssumme","versicherungssumme","coverageamount").contains(label))return Optional.of("coverageAmount");
    if(Set.of("versicherungsbeginn","coveragestart").contains(label))return Optional.of("coverageStart");
    if(Set.of("versicherungsende","coverageend").contains(label))return Optional.of("coverageEnd");
    if(Set.of("schadennummer","claimnumber").contains(label))return Optional.of("claimNumber");
    if(Set.of("schadendatum","dateofloss").contains(label))return Optional.of("claimDate");
    if(Set.of("rechnungsnummer","invoicenumber").contains(label))return Optional.of("invoiceNumber");
    if(Set.of("gesamtbetrag","rechnungsbetrag","invoicetotal").contains(label))return Optional.of("invoiceTotal");
    if(Set.of("vertragsnummer","contractnumber").contains(label))return Optional.of("contractNumber");
    return Optional.empty();
  }
}
