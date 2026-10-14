package dev.creditlab;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(exclude=org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration.class)
@org.springframework.scheduling.annotation.EnableScheduling
public class CreditApiApplication {
  public static void main(String[] args) {
    SpringApplication.run(CreditApiApplication.class, args);
  }
}
