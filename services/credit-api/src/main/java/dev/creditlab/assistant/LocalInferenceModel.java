package dev.creditlab.assistant;

import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.request.ChatRequest;
import dev.langchain4j.model.chat.request.ChatRequestParameters;
import dev.langchain4j.model.chat.response.ChatResponse;
import java.time.Duration;
import java.util.Set;
import java.util.concurrent.Semaphore;

/** One CPU inference at a time, shared by Nova and experiments in this local API process. */
final class LocalInferenceModel implements ChatModel {
  static final Duration TIMEOUT=Duration.ofSeconds(360);
  private final ChatModel delegate;
  private final Semaphore slot=new Semaphore(1);
  LocalInferenceModel(ChatModel delegate){this.delegate=delegate;}
  @Override public ChatRequestParameters defaultRequestParameters(){return delegate.defaultRequestParameters();}
  @Override public Set<dev.langchain4j.model.chat.Capability> supportedCapabilities(){return delegate.supportedCapabilities();}
  @Override public ChatResponse doChat(ChatRequest request){
    if(!slot.tryAcquire())throw new LocalInferenceException("LOCAL_MODEL_BUSY");
    try{AssistantRuns.markInference();return delegate.chat(request);}
    catch(RuntimeException error){
      int depth=0;
      for(Throwable cause=error;cause!=null&&depth++<8;cause=cause.getCause())
        if(cause instanceof java.net.http.HttpTimeoutException||cause instanceof java.util.concurrent.TimeoutException)
          throw new LocalInferenceException("LOCAL_MODEL_TIMEOUT");
      throw error;
    }finally{slot.release();}
  }
}
