package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.*;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.request.ChatRequest;
import dev.langchain4j.model.chat.response.ChatResponse;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.UserMessage;
import java.util.List;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;

class LocalInferenceModelTest {
  private static final ChatRequest REQUEST=ChatRequest.builder().messages(UserMessage.from("fictional local test")).build();
  private static ChatResponse response(){return ChatResponse.builder().aiMessage(AiMessage.from("draft")).build();}
  @Test void simultaneousChatAndExperimentCallsAreRejectedWithoutQueueOrRetry()throws Exception {
    var started=new CountDownLatch(1);var release=new CountDownLatch(1);var calls=new java.util.concurrent.atomic.AtomicInteger();
    ChatModel delegate=new ChatModel(){@Override public ChatResponse doChat(ChatRequest request){calls.incrementAndGet();started.countDown();try{assertThat(release.await(3,TimeUnit.SECONDS)).isTrue();}catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException(e);}return response();}};
    var guarded=new LocalInferenceModel(delegate);
    try(var pool=Executors.newVirtualThreadPerTaskExecutor()){
      var first=pool.submit(()->guarded.chat(REQUEST));
      try{assertThat(started.await(3,TimeUnit.SECONDS)).isTrue();assertThatThrownBy(()->guarded.chat(REQUEST)).isInstanceOfSatisfying(LocalInferenceException.class,e->assertThat(e.code()).isEqualTo("LOCAL_MODEL_BUSY"));assertThat(calls.get()).isEqualTo(1);}
      finally{release.countDown();}
      assertThat(first.get(3,TimeUnit.SECONDS).aiMessage().text()).isEqualTo("draft");
      assertThat(guarded.chat(REQUEST).aiMessage().text()).isEqualTo("draft");
    }
  }
  @Test void timeoutsHaveASafeCodeAndReleaseTheSlotWithoutRetry(){
    var calls=new java.util.concurrent.atomic.AtomicInteger();
    ChatModel delegate=new ChatModel(){@Override public ChatResponse doChat(ChatRequest request){if(calls.getAndIncrement()==0)throw new RuntimeException("private prompt",new java.net.http.HttpTimeoutException("private provider body"));return response();}};
    var guarded=new LocalInferenceModel(delegate);
    assertThatThrownBy(()->guarded.chat(REQUEST)).isInstanceOfSatisfying(LocalInferenceException.class,e->{assertThat(e.code()).isEqualTo("LOCAL_MODEL_TIMEOUT");assertThat(e.getStatusCode().value()).isEqualTo(504);assertThat(e.getMessage()).doesNotContain("private");});
    assertThat(calls.get()).isEqualTo(1);assertThat(guarded.chat(REQUEST).aiMessage().text()).isEqualTo("draft");
    assertThat(LocalInferenceModel.TIMEOUT.toSeconds()).isEqualTo(360);
  }
  @Test void publicErrorsAreBoundedAndOnlyBusyHasARetryHint(){
    var handler=new LocalInferenceHandler();
    for(String code:List.of("LOCAL_MODEL_BUSY","LOCAL_MODEL_TIMEOUT")){
      var response=handler.handle(new LocalInferenceException(code));
      assertThat(response.getBody()).containsOnlyKeys("code").containsEntry("code",code);
      assertThat(response.getHeaders().getFirst("Cache-Control")).isEqualTo("no-store");
      assertThat(response.getHeaders().getFirst("Retry-After")).isEqualTo(code.equals("LOCAL_MODEL_BUSY")?"5":null);
    }
  }
  @Test void compactPromptPreservesEverySelectedExcerptAndHasOneQuestion(){
    var sources=List.of(new CreditAssistantService.Source("doc-1:p1:fields","Invoice","invoiceNumber: 51109301; evidence=Invoice no: 51109301"),new CreditAssistantService.Source("doc-1:p1:c1","Invoice","Total INR 1,844,673.60"));
    String question="What is the invoice number?",prompt=DocumentReviewModel.prompt("general","English",question,sources);
    for(var source:sources)assertThat(prompt).contains("["+source.id()+"] "+source.text());
    assertThat(prompt.indexOf(question)).isEqualTo(prompt.lastIndexOf(question));assertThat(prompt).contains("End of untrusted evidence","English","missing evidence");
    assertThat(prompt.length()).isLessThan(650);
  }
}
