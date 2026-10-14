import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import hashes from "@/services/credit-api/src/main/resources/datev-reference-hashes.json";
import {canRetryDocumentJob,documentJobErrorKey} from "./platform";
import {platformText} from "./platform-language";

const job={name:"datev-lodas-2025-robert-muster.pdf",sha256:hashes["datev-lodas-2025-robert-muster.pdf"],status:"FAILED",error_code:"ANALYSIS_HTTP_503",expiresAt:"2030-01-01T00:00:00Z"};
describe("approved DATEV recovery",()=>{
  it("allows only the two exact approved samples, not filenames alone",()=>{
    expect(Object.keys(hashes)).toHaveLength(2);
    expect(canRetryDocumentJob(job)).toBe(true);
    expect(canRetryDocumentJob({...job,name:"other-payroll.pdf"})).toBe(false);
    expect(canRetryDocumentJob({...job,sha256:"changed"})).toBe(false);
  });
  it("never retries blocked, finished, active or expired files",()=>{
    for(const error_code of ["MALWARE_BLOCKED","ACTIVE_CONTENT_BLOCKED","INJECTION_QUARANTINED","UNKNOWN"])
      expect(canRetryDocumentJob({...job,error_code})).toBe(false);
    for(const status of ["COMPLETE","PROCESSING","QUEUED","EXPIRED"])
      expect(canRetryDocumentJob({...job,status})).toBe(false);
    expect(canRetryDocumentJob({...job,expiresAt:"2000-01-01T00:00:00Z"})).toBe(false);
  });
  it("distinguishes Azure authentication, permissions and quota from generic 503",()=>{
    expect(documentJobErrorKey("AZURE_AUTH_UNAVAILABLE")).toBe("azureAuthUnavailable");
    expect(documentJobErrorKey("AZURE_ACCESS_DENIED")).toBe("azureAccessDenied");
    expect(documentJobErrorKey("ANALYSIS_HTTP_429")).toBe("azureQuotaBusy");
    expect(documentJobErrorKey("ANALYSIS_HTTP_503")).toBe("analysisUnavailable");
    expect(documentJobErrorKey("MALWARE_BLOCKED")).toBe("documentBlocked");
  });
  it("localizes recovery and consent in all three languages",()=>{
    for(const locale of ["en","de","vi"]){
      const t=platformText(locale);
      for(const key of ["retryAnalysis","retryConfirm","retryHistory","azureAuthUnavailable","azureAccessDenied","analysisUnavailable"])
        expect(t(key)).not.toBe(key);
      expect(t("retryConfirm")).toMatch(/Robert|Melanie/);
      expect(t("retryHistory").length).toBeGreaterThan(100);
    }
  });
  it("puts retry behind confirmation and preserves the original failure",()=>{
    const source=readFileSync("components/workspace/PlatformWorkbench.tsx","utf8");
    expect(source).toContain("canRetryDocumentJob(job)");
    expect(source).toContain("setRetryJob(job)");
    expect(source).toContain('title={t("retryTitle")}');
    expect(source).toContain('t("confirmRetry")');
    const server=readFileSync("services/credit-api/src/main/java/dev/creditlab/platform/DocumentJobs.java","utf8");
    expect(server).toContain("ApprovedDatevSamples.matches(name,bytes)");
    expect(server).toContain("result.put(\"retryOf\",sourceJob)");
  });
});
