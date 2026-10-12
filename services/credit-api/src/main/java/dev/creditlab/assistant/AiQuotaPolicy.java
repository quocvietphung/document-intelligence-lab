package dev.creditlab.assistant;

/** Reservation units are a safety estimate, not metered Azure tokens or a euro cap. */
public record AiQuotaPolicy(int requestsPerMinute,int tenantRequestsPerMinute,int dailyAccountBudget,int dailyTenantBudget) {
  public static AiQuotaPolicy defaults(){return new AiQuotaPolicy(6,60,30_000,100_000);}
  public AiQuotaPolicy {
    if(requestsPerMinute<1||requestsPerMinute>60||tenantRequestsPerMinute<requestsPerMinute||tenantRequestsPerMinute>600
        ||dailyAccountBudget<1000||dailyAccountBudget>1_000_000||dailyTenantBudget<dailyAccountBudget||dailyTenantBudget>5_000_000)
      throw new IllegalArgumentException("Invalid bounded AI quota configuration");
  }
}
