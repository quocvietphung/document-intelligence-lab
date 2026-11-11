package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.creditlab.casework.CreditCaseService;
import dev.creditlab.platform.AgentSupervisor;
import dev.creditlab.platform.PlatformService;
import dev.creditlab.platform.RagEngine;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.azure.AzureOpenAiTokenCountEstimator;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.request.ChatRequest;
import dev.langchain4j.model.chat.response.ChatResponse;
import dev.langchain4j.model.output.FinishReason;
import java.util.*;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Estimated Azure prompt size for the old and the static-first layout, on the bundled fictional PDFs.
 * Nothing is sent to Azure: tokens are counted locally with the o200k tokenizer used by GPT-4o-class models,
 * so the numbers are estimates, not provider measurements. Run with:
 * mvn test -Dtest=NovaPromptSizeReportTest -Dnova.promptReport=true
 */
@EnabledIfSystemProperty(named="nova.promptReport",matches="true")
class NovaPromptSizeReportTest {
  private static final List<String> PDFS=List.of("use-cases/projektbewertung-musterquartier.pdf","use-cases/projektstatus-musterquartier.pdf",
      "use-cases/bauvertrag-musterquartier.pdf","use-cases/eingangsrechnung-musterquartier.pdf","use-cases/email-nachtragsangebot-musterquartier.pdf",
      "use-cases/esg-nachweise-musterquartier.pdf","real-estate/fictional-construction-order.pdf","real-estate/fictional-change-order.pdf",
      "real-estate/fictional-construction-invoice.pdf","real-estate/fictional-acceptance-report.pdf","real-estate/fictional-site-meeting-minutes.pdf");
  // The construction questions of scripts/benchmark-nova.mjs.
  private static final List<String[]> QUESTIONS=List.of(new String[]{"de","Welche prognostizierten Gesamtkosten nennt die Projektbewertung?"},
      new String[]{"vi","Hóa đơn RE-2026-0311 nêu tổng tiền sau thuế (Bruttobetrag) là bao nhiêu?"},new String[]{"en","Which change-order amount does the offer NA-2026-007 state?"},
      new String[]{"de","Wann ist das Richtfest geplant?"},new String[]{"en","Until when is the energy certificate valid?"},
      new String[]{"en","For order AUF-2026-081, list the order sum, the approved change-order sum and the invoice amount, each with its document source."},
      new String[]{"de","Wie hoch ist der Verkehrswert laut Gutachten?"},new String[]{"en","Has invoice RE-2026-0311 already been paid?"});
  record Captured(String system,String user,String tools){String all(){return tools+"\n"+system+"\n"+user;}}

  @Test void azurePromptLayoutBeforeAndAfter() throws Exception {
    var pages=new ArrayList<RagEngine.Hit>();
    for(String path:PDFS)try(var in=getClass().getClassLoader().getResourceAsStream(path);var pdf=Loader.loadPDF(Objects.requireNonNull(in,path).readAllBytes())){
      for(int page=1;page<=pdf.getNumberOfPages();page++){
        var stripper=new PDFTextStripper();stripper.setStartPage(page);stripper.setEndPage(page);
        String id=path.substring(path.lastIndexOf('/')+1,path.length()-4);
        pages.add(new RagEngine.Hit(id+":p"+page+":c1",id,id+".pdf",page,"page",stripper.getText(pdf).strip(),0,0,0,false));
      }
    }
    var estimator=new AzureOpenAiTokenCountEstimator("gpt-4o");
    var report=new StringBuilder("| Layout | Question | System tokens | Tool tokens (≈) | User tokens | Total tokens |\n|---|---|---|---|---|---|\n");
    var totals=new LinkedHashMap<String,int[]>();var prefixes=new LinkedHashMap<String,Integer>();
    for(boolean staticFirst:new boolean[]{false,true}){
      String layout=staticFirst?"static-first":"legacy";var captured=new ArrayList<Captured>();
      for(String[] question:QUESTIONS){
        var service=service(pages,captured);ReflectionTestUtils.setField(service,"staticFirstPrompt",staticFirst);
        service.answer("praxisbank-demo","tester",new CreditAssistantService.AssistantRequest("CR-2026-1048",question[0],question[1]));
        var c=captured.getLast();int system=estimator.estimateTokenCountInText(c.system()),tools=estimator.estimateTokenCountInText(c.tools()),user=estimator.estimateTokenCountInText(c.user());
        totals.computeIfAbsent(layout,k->new int[2]);totals.get(layout)[0]+=user;totals.get(layout)[1]+=system+tools+user;
        report.append("| ").append(layout).append(" | ").append(question[1],0,Math.min(40,question[1].length())).append("… | ").append(system).append(" | ").append(tools).append(" | ").append(user).append(" | ").append(system+tools+user).append(" |\n");
      }
      String prefix=captured.getFirst().all();for(var c:captured){String all=c.all();int n=0;while(n<prefix.length()&&n<all.length()&&prefix.charAt(n)==all.charAt(n))n++;prefix=prefix.substring(0,n);}
      prefixes.put(layout,estimator.estimateTokenCountInText(prefix));
    }
    report.append("\nIdentical prefix across all questions (tokens, ≈): ").append(prefixes).append("\nUser-message tokens summed: legacy=").append(totals.get("legacy")[0])
        .append(", static-first=").append(totals.get("static-first")[0]).append("; whole request: legacy=").append(totals.get("legacy")[1]).append(", static-first=").append(totals.get("static-first")[1]);
    System.out.println(report);
    assertThat(totals.get("static-first")[1]).isLessThan(totals.get("legacy")[1]);
    assertThat(prefixes.get("static-first")).isGreaterThan(prefixes.get("legacy"));
  }

  /** Real service in Azure mode with a capturing model; retrieval returns the five pages sharing most words with the question. */
  private CreditAssistantService service(List<RagEngine.Hit> pages,List<Captured> captured){
    var cases=Mockito.mock(CreditCaseService.class);
    Mockito.when(cases.require("praxisbank-demo","CR-2026-1048")).thenReturn(new CreditCaseService().require("praxisbank-demo","CR-2026-1048"));
    var platform=Mockito.mock(PlatformService.class);
    Mockito.when(platform.plan(Mockito.anyString())).thenReturn(new AgentSupervisor.Plan("Document",List.of(),false,""));
    Mockito.when(platform.retrieve(Mockito.any(),Mockito.anyString())).thenAnswer(call->{
      String question=call.getArgument(1,String.class).toLowerCase(Locale.ROOT);
      var terms=Arrays.stream(question.split("[^\\p{L}\\p{N}.,-]+")).filter(t->t.length()>2).toList();
      var ranked=pages.stream().sorted(Comparator.comparingLong((RagEngine.Hit h)->terms.stream().filter(h.text().toLowerCase(Locale.ROOT)::contains).count()).reversed()).limit(5).toList();
      return new RagEngine.Search(ranked,pages.size(),"report","none","term overlap",List.of());
    });
    ChatModel model=new ChatModel(){@Override public ChatResponse doChat(ChatRequest request){
      String tools=request.toolSpecifications()==null?"":request.toolSpecifications().stream().map(t->t.name()+" "+t.description()+" "+t.parameters()).reduce("",(a,b)->a+"\n"+b);
      captured.add(new Captured(((SystemMessage)request.messages().getFirst()).text(),((UserMessage)request.messages().getLast()).singleText(),tools));
      return ChatResponse.builder().finishReason(FinishReason.STOP).aiMessage(AiMessage.from("Not stated in the supplied evidence [policy].")).build();
    }};
    var service=new CreditAssistantService(cases,new ObjectMapper(),Optional.of(model),null,platform,null);
    ReflectionTestUtils.setField(service,"chatProvider","azure");
    return service;
  }
}
