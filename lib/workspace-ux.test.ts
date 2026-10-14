import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";
import {WorkspaceAIOverview} from "@/components/workspace/WorkspaceAIOverview";
import {showCaseEmpty, workspaceCaseFromSearch, workspaceErrorKey, workspaceLocalePath, workspaceSectionFromSearch, workspaceUxTables, workspaceUxText} from "./workspace-ux";

describe("workspace guidance and recovery", () => {
  it("does not mistake an unavailable service for an empty case search", () => {
    expect(showCaseEmpty(0, false, "")).toBe(true);
    expect(showCaseEmpty(0, false, "serviceUnavailable")).toBe(false);
    expect(showCaseEmpty(0, true, "")).toBe(false);
    expect(showCaseEmpty(1, false, "")).toBe(false);
  });
  it("preserves only allowlisted sections when changing language", () => {
    expect(workspaceLocalePath("#documents")).toBe("/?section=documents#documents");
    expect(workspaceLocalePath("#studio")).toBe("/?section=studio#studio");
    expect(workspaceLocalePath("#https://untrusted.test")).toBe("/");
    expect(workspaceLocalePath("#state=secret&code=secret")).toBe("/");
  });
  it("distinguishes an unavailable backend from an expired or unauthorized session", () => {
    expect(workspaceErrorKey(503)).toBe("serviceUnavailable");
    expect(workspaceErrorKey(401)).toBe("sessionExpired");
    expect(workspaceErrorKey(403)).toBe("accessDenied");
    expect(workspaceErrorKey(409)).toBe("conflict");
    expect(workspaceErrorKey(429)).toBe("limit");
    expect(workspaceErrorKey(422)).toBe("fileRejected");
    expect(workspaceErrorKey(400)).toBe("error");
  });
  it("retains the case on language change without copying OAuth parameters", () => {
    expect(workspaceLocalePath("#documents", "CR-2026-1048")).toBe("/?case=CR-2026-1048&section=documents#documents");
    expect(workspaceCaseFromSearch("?case=CR-2026-1048&code=private")).toBe("CR-2026-1048");
    expect(workspaceCaseFromSearch("?case=https://untrusted.test")).toBeUndefined();
    expect(workspaceLocalePath("#documents", "../private")).toBe("/?section=documents#documents");
  });
  it("recovers an allowlisted section if locale/auth navigation consumed its fragment",()=>{
    expect(workspaceSectionFromSearch("?case=CR-1&section=documents&code=private")).toBe("documents");
    expect(workspaceSectionFromSearch("?section=javascript:alert(1)")).toBeUndefined();
    expect(workspaceSectionFromSearch("?section=code%3Dprivate")).toBeUndefined();
  });
  it("has complete EN/DE/VI guidance and safe fallback", () => {
    for (const table of Object.values(workspaceUxTables)) {
      expect(Object.keys(table).sort()).toEqual(Object.keys(workspaceUxTables.en).sort());
      expect(Object.values(table).every(value => value.trim().length > 0)).toBe(true);
    }
    expect(workspaceUxText("unknown")).toEqual(workspaceUxTables.en);
  });
  it("labels configuration honestly instead of claiming Azure is live", () => {
    const render = (documentMode?: string, demo = false) => renderToStaticMarkup(createElement(WorkspaceAIOverview, {
      locale: "en", demo, documentMode, navigate: () => {}, openNova: () => {},
    }));
    expect(render("azure")).toContain("Azure Document Intelligence configured");
    expect(render("local")).toContain("Local PDFBox / Tesseract extraction");
    expect(render()).toContain("not yet confirmed");
    expect(render(undefined, true)).toContain("Read-only sample evidence");
    expect(render("azure")).not.toContain("100% accurate");
    expect(render("azure")).toContain("Open AI Studio");
    expect(render("azure")).toContain("Chat with Nova");
  });
});
