package dev.creditlab.sources;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

/** Connector endpoints through the real security chain; the default stack has no cloud credential. */
@SpringBootTest(properties = "app.demo-seed-enabled=true")
@org.springframework.test.context.ActiveProfiles("research-fixtures")
@AutoConfigureMockMvc
@org.springframework.boot.micrometer.metrics.test.autoconfigure.AutoConfigureMetrics
class ConnectorSecurityTest {
  @Autowired MockMvc mvc;
  final String casePath = "/api/cases/CR-2026-1048/platform";

  private static org.springframework.test.web.servlet.request.RequestPostProcessor user(String tenant, String role) {
    return jwt().jwt(j -> j.subject("user-" + role).claim("tenant_id", tenant)).authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }

  @Test void statusNeedsAuthenticationAndNeverExposesSecrets() throws Exception {
    mvc.perform(get("/api/connectors")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/connectors").with(user("praxisbank-demo", "REVIEWER"))).andExpect(status().isOk())
        .andExpect(jsonPath("$.tokensInBrowser").value(false)).andExpect(jsonPath("$.automaticSync").value(false))
        .andExpect(jsonPath("$.providers[0].id").value("local")).andExpect(jsonPath("$.providers[0].label").value("verified-local"))
        .andExpect(jsonPath("$.providers[?(@.id=='gmail')].label").value("implemented-not-live-verified"))
        .andExpect(jsonPath("$.providers[?(@.id=='gmail')].enabled").value(false))
        .andExpect(content().string(Matchers.not(Matchers.containsString("refresh_token"))))
        .andExpect(content().string(Matchers.not(Matchers.containsString("\"live-verified\""))));
    mvc.perform(post("/api/connectors/google/authorize").with(user("praxisbank-demo", "ADVISOR")).contentType("application/json").content("{\"features\":[\"gmail\"]}"))
        .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error").value("CONNECTOR_NOT_CONFIGURED"));
    mvc.perform(post("/api/connectors/google/authorize").with(user("praxisbank-demo", "REVIEWER")).contentType("application/json").content("{\"features\":[\"gmail\"]}"))
        .andExpect(status().isForbidden());
    mvc.perform(post("/api/connectors/google/authorize").with(user("praxisbank-demo", "ADVISOR")).contentType("application/json").content("{\"features\":[\"gmail.send\"]}"))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/connectors/use-cases").with(user("praxisbank-demo", "REVIEWER"))).andExpect(status().isOk()).andExpect(jsonPath("$.useCases.length()").value(8));
  }

  @Test void localUseCasesAndSourcesUseTheAuthorizedDossier() throws Exception {
    var advisor = user("praxisbank-demo", "ADVISOR");
    mvc.perform(post(casePath + "/use-cases/contract-risk/check").with(advisor)).andExpect(status().isOk())
        .andExpect(jsonPath("$.passed").value(true)).andExpect(jsonPath("$.networkCalls").value(0));
    mvc.perform(post(casePath + "/use-cases/contract-risk/check").with(user("foreign", "ADVISOR"))).andExpect(status().isNotFound());
    mvc.perform(post(casePath + "/sources/local/preview").with(advisor).contentType("application/json").content("{\"query\":\"\",\"limit\":5}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(5)).andExpect(jsonPath("$.label").value("verified-local"));
    mvc.perform(post(casePath + "/sources/webdav/preview").with(advisor).contentType("application/json").content("{}"))
        .andExpect(status().isNotImplemented()).andExpect(jsonPath("$.error").value("CONNECTOR_NOT_IMPLEMENTED"));
    mvc.perform(post(casePath + "/sources/gmail/preview").with(advisor).contentType("application/json").content("{}"))
        .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error").value("CONNECTOR_NOT_CONFIGURED"));
    mvc.perform(post(casePath + "/sources/local/import").with(user("praxisbank-demo", "REVIEWER")).contentType("application/json")
        .content("{\"requestId\":\"12345678-1234-1234-1234-123456789abc\",\"caseVersion\":0,\"externalIds\":[\"use-cases/bauvertrag-musterquartier.pdf\"],\"profile\":\"general\",\"consent\":true}"))
        .andExpect(status().isForbidden());
    mvc.perform(post(casePath + "/project-assessment").with(advisor).contentType("application/json")
        .content("{\"csv\":\"type,name,planned,forecast\\ncost,Bauwerk,100.00,110.00\\n\"}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.costs.variancePercent").value("10.00")).andExpect(jsonPath("$.humanReviewRequired").value(true));
    mvc.perform(post(casePath + "/project-assessment").with(advisor).contentType("application/json").content("{\"csv\":\"type,name,planned,forecast\\ncost,=CMD(),1.00,\\n\"}"))
        .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.error").value("CSV_NAME_INVALID"));
    mvc.perform(post(casePath + "/destinations/gmail-draft/approve").with(advisor).contentType("application/json")
        .content("{\"previewId\":\"draft-x\",\"contentHash\":\"" + "a".repeat(64) + "\",\"confirmed\":false}"))
        .andExpect(status().isBadRequest());
  }
}
