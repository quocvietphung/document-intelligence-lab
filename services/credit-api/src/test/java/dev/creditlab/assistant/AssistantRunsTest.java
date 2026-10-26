package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.*;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;

class AssistantRunsTest {
  @Test void repeatedRequestIdDoesNotGenerateTwiceAndIsNotVisibleToAnotherActor(){
    var runs=new AssistantRuns();String id=UUID.randomUUID().toString();
    assertThat(runs.execute("tenant","owner","case",id,()->AssistantRuns.commit(()->"saved"))).isEqualTo("saved");
    assertThat(runs.read("tenant","owner","case",id)).containsEntry("status","COMPLETE").containsEntry("providerStopConfirmed",false);
    assertThatThrownBy(()->runs.execute("tenant","owner","case",id,()->"duplicate")).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThatThrownBy(()->runs.read("tenant","other","case",id)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThatThrownBy(()->runs.read("foreign","owner","case",id)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
  }
  @Test void cancellationBeforeRegistrationPreventsDispatch(){
    var runs=new AssistantRuns();String id=UUID.randomUUID().toString();var called=new AtomicBoolean();
    assertThat(runs.cancel("tenant","owner","case",id)).containsEntry("status","CANCELLED_BEFORE_START");
    assertThatThrownBy(()->runs.execute("tenant","owner","case",id,()->{called.set(true);return "generated";})).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThat(called).isFalse();
  }
  @Test void cancelledOutputIsNeverPersistedEvenIfTheDelegateIgnoresInterruption()throws Exception{
    var runs=new AssistantRuns();String id=UUID.randomUUID().toString();var started=new CountDownLatch(1);var release=new CountDownLatch(1);var saved=new AtomicBoolean();
    try(var pool=Executors.newVirtualThreadPerTaskExecutor()){
      var task=pool.submit(()->runs.execute("tenant","owner","case",id,()->{
        started.countDown();boolean done=false;while(!done)try{done=release.await(3,TimeUnit.SECONDS);}catch(InterruptedException ignored){/* Simulate a provider that keeps running. */}
        return AssistantRuns.commit(()->{saved.set(true);return "answer";});
      }));
      assertThat(started.await(3,TimeUnit.SECONDS)).isTrue();
      assertThat(runs.cancel("tenant","owner","case",id)).containsEntry("status","CANCEL_REQUESTED").containsEntry("providerStopConfirmed",false);
      release.countDown();assertThatThrownBy(()->task.get(3,TimeUnit.SECONDS)).isInstanceOf(ExecutionException.class);
      assertThat(saved).isFalse();assertThat(runs.read("tenant","owner","case",id)).containsEntry("status","RESPONSE_DISCARDED");
    }
  }
}
