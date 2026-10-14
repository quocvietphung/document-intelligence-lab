package dev.creditlab.casework;

import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

@Configuration
public class StoreConfiguration {
  @Bean
  @ConditionalOnProperty(name="app.persistence.enabled",havingValue="true")
  @org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean(org.springframework.transaction.PlatformTransactionManager.class)
  org.springframework.transaction.PlatformTransactionManager caseTransactionManager(DataSource caseDataSource){return new org.springframework.jdbc.datasource.DataSourceTransactionManager(caseDataSource);}
  @Bean
  @ConditionalOnProperty(name="app.persistence.enabled", havingValue="false", matchIfMissing=true)
  CaseStore demoStore() { return new CaseStore(); }

  @Bean
  @ConditionalOnProperty(name="app.persistence.enabled", havingValue="true")
  DataSource caseDataSource(@Value("${app.persistence.url}") String url,
      @Value("${app.persistence.user}") String user, @Value("${app.persistence.password}") String password) {
    return new DriverManagerDataSource(url, user, password);
  }
  @Bean
  @ConditionalOnProperty(name="app.persistence.enabled", havingValue="true")
  CaseStore sqlStore(DataSource caseDataSource, com.fasterxml.jackson.databind.ObjectMapper mapper,
      @Value("${app.ai.requests-per-minute:6}") int minute,
      @Value("${app.ai.tenant-requests-per-minute:60}") int tenantMinute,
      @Value("${app.ai.daily-account-budget:30000}") int accountBudget,
      @Value("${app.ai.daily-tenant-budget:100000}") int tenantBudget) {
    return new SqlCaseStore(caseDataSource, mapper,new dev.creditlab.assistant.AiQuotaPolicy(minute,tenantMinute,accountBudget,tenantBudget));
  }
}
