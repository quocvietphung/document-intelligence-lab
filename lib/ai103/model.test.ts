import {describe, expect, it} from "vitest";
import {checkRegistryIds, runCapabilityCheck} from "./checks";
import {capabilityIds, checkIds, filterCapabilities, groupIds, manifest, manifestProblems, summarize, type Capability, type Manifest} from "./model";
import {ai103Text} from "./language";

const clone = (): Manifest => JSON.parse(JSON.stringify(manifest)) as Manifest;

describe("AI-103 capability manifest", () => {
  it("lists the eighteen capabilities once, in five groups, and passes every rule", () => {
    expect(manifest.capabilities.map((capability) => capability.id)).toEqual([...capabilityIds]);
    expect(new Set(manifest.capabilities.map((capability) => capability.group))).toEqual(new Set(groupIds));
    expect(manifestProblems(manifest)).toEqual([]);
  });

  it("counts honestly: no Azure verification, mocks never counted as local real", () => {
    const summary = summarize(manifest.capabilities);
    expect(summary.total).toBe(18);
    expect(summary["azure-verified"]).toBe(0);
    expect(summary["local-real-deterministic"] + summary["local-mock-configured"]).toBe(18);
    const mocks = manifest.capabilities.filter((capability) => capability.local.status === "local-mock").map((capability) => capability.id);
    expect(mocks.sort()).toEqual(["content-understanding", "image-generation", "speech"]);
    expect(summary["azure-ready"]).toBe(manifest.capabilities.filter((capability) => capability.azure?.status === "azure-ready").length);
  });

  it("every Azure-ready capability names its mocked-boundary test and says it is not live-tested", () => {
    for (const capability of manifest.capabilities.filter((entry) => entry.azure)) {
      expect(capability.azure?.status).toBe("azure-ready");
      expect(capability.azure?.lastTested).toBeNull();
      expect(capability.azure?.actual).toMatch(/Not live-tested/);
      expect(capability.azure?.command).toMatch(/azure-adapters\.test\.ts|test_speech\.py/);
    }
  });

  it("rejects a status that claims evidence it does not carry", () => {
    const missing = clone();
    missing.capabilities[0].local = {...missing.capabilities[0].local, lastTested: null};
    expect(manifestProblems(missing).join()).toContain("needs lastTested");
    const live = clone();
    const target = live.capabilities.find((capability) => capability.azure)!;
    target.azure = {...target.azure!, status: "azure-live-verified", lastTested: "2026-11-14", latencyMs: null};
    expect(manifestProblems(live).join()).toContain("azure-live-verified needs");
    const ready = clone();
    const other = ready.capabilities.find((capability) => capability.azure)!;
    other.azure = {...other.azure!, lastTested: "2026-11-14"};
    expect(manifestProblems(ready).join()).toContain("azure-ready must");
    const duplicate = clone();
    duplicate.capabilities[1] = {...duplicate.capabilities[0]};
    expect(manifestProblems(duplicate).join()).toContain("exactly once");
  });

  it("filters by status, Azure adapter, group and search", () => {
    const nameOf = (id: Capability["id"]) => ai103Text("vi").capabilities[id].name;
    const all = manifest.capabilities;
    expect(filterCapabilities(all, {status: "local-mock", query: "", nameOf}).map((c) => c.id).sort()).toEqual(["content-understanding", "image-generation", "speech"]);
    expect(filterCapabilities(all, {status: "no-azure-adapter", query: "", nameOf}).every((c) => c.azure === null)).toBe(true);
    expect(filterCapabilities(all, {status: "all", query: "", nameOf, group: "safety"}).map((c) => c.id)).toEqual(["security", "content-safety"]);
    expect(filterCapabilities(all, {status: "all", query: "dịch thuật", nameOf}).map((c) => c.id)).toEqual(["translator"]);
    expect(filterCapabilities(all, {status: "azure-live-verified", query: "", nameOf})).toEqual([]);
  });

  it("wires every in-app check to one capability, and every claimed check passes", () => {
    const used = manifest.capabilities.map((capability) => capability.check).filter(Boolean);
    expect([...used].sort()).toEqual([...checkIds].sort());
    expect([...checkRegistryIds].sort()).toEqual([...checkIds].sort());
    for (const capability of manifest.capabilities) {
      if (!capability.check) continue;
      expect(runCapabilityCheck(capability.id)?.passed, capability.id).toBe(true);
    }
  });
});
