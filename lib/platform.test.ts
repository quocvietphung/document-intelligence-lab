import {describe,expect,it} from "vitest";
import {platformText} from "./platform-language";
import {percent,searchSchema,pipelineStage,noticeIsVisible,currentEvidenceSearch,type SearchData} from "./platform";

describe("reliability workspace",()=>{
  it("hides retrieved evidence after the case version changes",()=>{
    const data={} as SearchData,snapshot={version:3,data};
    expect(currentEvidenceSearch(snapshot,3)).toBe(data);expect(currentEvidenceSearch(snapshot,4)).toBeUndefined();
    expect(currentEvidenceSearch(undefined,3)).toBeUndefined();
  });
  it("does not show a reviewed document as still awaiting review",()=>{
    expect(pipelineStage({status:"COMPLETE",stage:"HUMAN_REVIEW",reviewStatus:"verified"})).toBe("reviewComplete");
    expect(pipelineStage({status:"COMPLETE",stage:"HUMAN_REVIEW",reviewStatus:"review"})).toBe("HUMAN_REVIEW");
    expect(pipelineStage({status:"FAILED",stage:"STOPPED"})).toBe("STOPPED");
  });
  it("keeps a pipeline upload notice out of the evaluation dashboard",()=>{
    expect(noticeIsVisible("pipeline","evaluation")).toBe(false);
    expect(noticeIsVisible("pipeline","pipeline")).toBe(true);
  });
  it("provides named workspaces and honest limits in all three languages",()=>{
    for(const locale of ["en","de","vi"]){
      const t=platformText(locale);
      for(const key of ["studio","pipeline","controls","operations","evaluation","queued","supportHint","qualityHint","confusion"])
        expect(t(key)).not.toBe(key);
      expect(t("qualityHint")).toContain("PDF");
      expect(t("controlsHint")).toContain("PDF");
      expect(t("formatAzure").replace("{pages}","2")).toContain("2");
    }
  });
  it("displays measured percentages without inventing perfect scores",()=>{
    expect(percent(95)).toBe("95.0%");expect(percent(54.7)).toBe("54.7%");expect(percent(0)).toBe("0.0%");
  });
  it("rejects malformed evidence search responses",()=>{
    expect(searchSchema.safeParse({search:{hits:[{id:"invented"}]},plan:{},durationMs:0}).success).toBe(false);
  });
});
