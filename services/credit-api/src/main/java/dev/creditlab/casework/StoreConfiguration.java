package dev.creditlab.casework;

import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

@Configuration
public class StoreConfiguration {
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
  CaseStore sqlStore(DataSource caseDataSource, com.fasterxml.jackson.databind.ObjectMapper mapper) {
    return new SqlCaseStore(caseDataSource, mapper);
  }
}
