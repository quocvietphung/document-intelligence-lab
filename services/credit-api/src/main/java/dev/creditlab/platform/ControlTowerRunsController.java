package dev.creditlab.platform;

import static dev.creditlab.security.JwtIdentity.*;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Which dossiers of the caller's tenant already have Control Tower marts, so the page can open one with data. */
@RestController
@PreAuthorize("hasAnyRole('ADVISOR','REVIEWER','ADMIN')")
public class ControlTowerRunsController {
  private final LocalDataPipeline pipeline;
  public ControlTowerRunsController(LocalDataPipeline pipeline){this.pipeline=pipeline;}
  @GetMapping("/api/cases/control-tower-runs")
  public List<Map<String,Object>> read(JwtAuthenticationToken auth){return pipeline.controlTowerRuns(tenant(auth));}
}
