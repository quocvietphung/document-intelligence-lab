package dev.creditlab.casework;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.assertj.core.api.Assertions.*;

/** Opt-in validation of a private recorded provider response; no download or model call. */
class DoclingSourceContractTest {
  @Test @EnabledIfEnvironmentVariable(named="RAG_DOCLING_RESULT",matches=".+")
  void actualPrivateSourceResponseMeetsTheEvidenceContract() throws Exception {
    var response=new ObjectMapper().readTree(Files.readAllBytes(Path.of(System.getenv("RAG_DOCLING_RESULT"))));
    var document=new DoclingDocumentAnalysisProvider(new DocumentExtractor(),"http://localhost:5001").parse("source.pdf","application/pdf",response);
    assertThat(document.pages()).isNotEmpty();assertThat(document.analysisProvider()).isEqualTo("docling");
    System.out.println("Private Docling response checked: "+document.pages().size()+" pages; "+document.tables().size()+" tables.");
  }
}
