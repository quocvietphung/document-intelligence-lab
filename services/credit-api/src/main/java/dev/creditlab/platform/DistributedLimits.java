package dev.creditlab.platform;

import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** PostgreSQL retains the daily token budget; Redis adds shared short-window limits. */
@Component
public class DistributedLimits {
  private final StringRedisTemplate redis;private final boolean enabled;
  private static final DefaultRedisScript<Long> SCRIPT=new DefaultRedisScript<>("local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n>=tonumber(ARGV[1]) then return 0 end; n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],70) end; return 1",Long.class);
  public DistributedLimits(StringRedisTemplate redis,@Value("${app.platform.redis-enabled:false}") boolean enabled){this.redis=redis;this.enabled=enabled;}
  public void reserve(String tenant,String actor,String purpose,int limit) {
    if(!enabled)return;
    String key="lab-limit:"+RagEngine.hash(tenant+"|"+actor+"|"+purpose)+":"+Instant.now().getEpochSecond()/60;
    Long reserved;
    try { reserved=redis.execute(SCRIPT,List.of(key),String.valueOf(limit)); }
    catch(RuntimeException e){throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Shared limit service unavailable");}
    if(!Long.valueOf(1).equals(reserved))throw new dev.creditlab.assistant.AiUsageLimitException("AI_MINUTE_LIMIT",Instant.now(),false);
  }
  public String status(){if(!enabled)return "database quotas only";try(var connection=redis.getConnectionFactory().getConnection()){return "PONG".equals(connection.ping())?"redis connected":"redis unavailable";}catch(RuntimeException e){return "redis unavailable";}}
}
