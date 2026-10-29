package dev.creditlab.assistant;

import static org.assertj.core.api.Assertions.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class AssistantRunJournalTest {
  private DriverManagerDataSource source()throws Exception{
    var source=new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa","");
    var db=new JdbcTemplate(source);
    for(var sql:Files.readString(Path.of("src/main/resources/db/migration/V3__assistant_run_journal.sql")).split(";"))if(!sql.isBlank())db.execute(sql);
    db.execute("CREATE TABLE saved_answer(answer_text varchar(30))");return source;
  }
  @Test void metadataAndIdempotencySurviveANewApiInstance()throws Exception{
    var source=source();var first=new AssistantRuns(Optional.of(source));String id=UUID.randomUUID().toString();
    first.execute("tenant","advisor","case",id,()->AssistantRuns.commit(()->"answer"));
    var restarted=new AssistantRuns(Optional.of(source));
    assertThat(restarted.read("tenant","advisor","case",id)).containsEntry("status","COMPLETE").containsEntry("runtimeScope","postgresql");
    assertThatThrownBy(()->restarted.execute("tenant","advisor","case",id,()->"duplicate")).hasMessageContaining("REQUEST_ALREADY_REGISTERED");
    assertThatThrownBy(()->restarted.read("other","advisor","case",id)).hasMessageContaining("RUN_UNKNOWN");
    assertThatThrownBy(()->restarted.read("tenant","other","case",id)).hasMessageContaining("RUN_UNKNOWN");
  }
  @Test void crossInstanceCancelPreventsAnswerPersistence()throws Exception{
    var source=source();var db=new JdbcTemplate(source);var first=new AssistantRuns(Optional.of(source));var second=new AssistantRuns(Optional.of(source));
    String id=UUID.randomUUID().toString();var started=new CountDownLatch(1);var release=new CountDownLatch(1);
    try(var pool=Executors.newVirtualThreadPerTaskExecutor()){
      var task=pool.submit(()->first.execute("tenant","advisor","case",id,()->{started.countDown();try{release.await(4,TimeUnit.SECONDS);}catch(InterruptedException ignored){}return AssistantRuns.commit(()->{db.update("INSERT INTO saved_answer VALUES('should not exist')");return "answer";});}));
      assertThat(started.await(3,TimeUnit.SECONDS)).isTrue();
      assertThat(second.cancel("tenant","advisor","case",id)).containsEntry("status","CANCEL_REQUESTED");release.countDown();
      assertThatThrownBy(()->task.get(4,TimeUnit.SECONDS)).isInstanceOf(ExecutionException.class);
      assertThat(db.queryForObject("SELECT count(*) FROM saved_answer",Integer.class)).isZero();
      assertThat(second.read("tenant","advisor","case",id)).containsEntry("status","RESPONSE_DISCARDED");
    }
  }
  @Test void expiredLeaseAbstainsAndNeverRedispatches()throws Exception{
    var source=source();var journal=new AssistantRunJournal(source);var db=new JdbcTemplate(source);String id=UUID.randomUUID().toString();
    assertThat(journal.reserve("t","a","c",id,"owner",false)).isTrue();
    db.update("UPDATE lab_assistant_runs SET lease_until=TIMESTAMP '2000-01-01 00:00:00'");
    assertThat(journal.read("t","a","c",id)).containsEntry("status","INTERRUPTED");
    assertThat(journal.renew("t","a",id,"owner","GENERATING")).isFalse();
    var called=new AtomicBoolean();
    assertThatThrownBy(()->journal.commit("t","a","c",id,"owner",()->{called.set(true);return "no";})).hasMessageContaining("RESPONSE_DISCARDED");
    assertThat(called).isFalse();assertThat(journal.reserve("t","a","c",id,"new-owner",false)).isFalse();
  }
  @Test void answerAndCompleteStatusRollbackTogether()throws Exception{
    var source=source();var journal=new AssistantRunJournal(source);var db=new JdbcTemplate(source);String id=UUID.randomUUID().toString();journal.reserve("t","a","c",id,"owner",false);
    assertThatThrownBy(()->journal.commit("t","a","c",id,"owner",()->{db.update("INSERT INTO saved_answer VALUES('rollback')");throw new IllegalStateException("simulate write failure");})).isInstanceOf(IllegalStateException.class);
    assertThat(db.queryForObject("SELECT count(*) FROM saved_answer",Integer.class)).isZero();assertThat(journal.read("t","a","c",id)).containsEntry("status","RUNNING");
  }
}
