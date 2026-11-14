import {describe, expect, it} from "vitest";
import {checkRegistryIds, runCapabilityCheck} from "./checks";
import {
  bucketOf, capabilityIds, checkIds, filterCapabilities, manifest, manifestProblems, summarize,
  type Capability, type Manifest,
} from "./model";
import {ai103Text} from "./language";

const clone = (): Manifest => JSON.parse(JSON.stringify(manifest)) as Manifest;
const local = (status: Capability["local"]["status"]): Capability["local"] => ({
  status, lastTested: "2026-11-14", command: "npm test", expected: "x", actual: "y", latencyMs: null, cost: "0 EUR", log: "docs/x.md",
});

describe("AI-103 capability manifest", () => {
  it("lists the eighteen groups once, in order, and passes every rule", () => {
    expect(manifest.capabilities.map((capability) => capability.id)).toEqual([...capabilityIds]);
    expect(manifestProblems(manifest)).toEqual([]);
  });

  it("counts each capability once, and the four counts add up to eighteen", () => {
    const summary = summarize(manifest.capabilities);
    expect(summary.total).toBe(18);
    expect(summary["verified-local"] + summary["verified-azure"] + summary["configured-mocked"] + summary["blocked-unsupported"]).toBe(18);
    // Nothing was called on Azure in this pass, so no capability may claim it.
    expect(summary["verified-azure"]).toBe(0);
    expect(manifest.capabilities.some((capability) => capability.azure?.status === "verified-azure")).toBe(false);
  });

  it("puts each capability under its strongest evidence", () => {
    expect(bucketOf({local: local("verified-local"), azure: {...local("verified-azure"), latencyMs: 10}})).toBe("verified-azure");
    expect(bucketOf({local: local("verified-local"), azure: null})).toBe("verified-local");
    expect(bucketOf({local: local("mock"), azure: null})).toBe("configured-mocked");
    expect(bucketOf({local: local("configured"), azure: null})).toBe("configured-mocked");
    expect(bucketOf({local: local("blocked"), azure: null})).toBe("blocked-unsupported");
    expect(bucketOf({local: local("not-supported"), azure: null})).toBe("blocked-unsupported");
  });

  it("rejects a status that claims evidence it does not carry", () => {
    const missingDate = clone();
    missingDate.capabilities[0].local = {...missingDate.capabilities[0].local, status: "verified-local", lastTested: null};
    expect(manifestProblems(missingDate).join()).toContain("verified-local needs lastTested");

    const ranAzure = clone();
    const azure = ranAzure.capabilities[1].azure!;
    ranAzure.capabilities[1].azure = {...azure, status: "azure-not-run", lastTested: "2026-11-14"};
    expect(manifestProblems(ranAzure).join()).toContain("azure-not-run needs the opt-in command and no lastTested date");

    const claimedAzure = clone();
    claimedAzure.capabilities[1].azure = {...azure, status: "verified-azure", lastTested: "2026-11-14", latencyMs: null};
    expect(manifestProblems(claimedAzure).join()).toContain("verified-azure needs lastTested, a command and a measured latency");

    const wrongSide = clone();
    wrongSide.capabilities[2].local = {...wrongSide.capabilities[2].local, status: "verified-azure"};
    expect(manifestProblems(wrongSide).join()).toContain("not allowed on the local side");

    const duplicate = clone();
    duplicate.capabilities[1] = {...duplicate.capabilities[0]};
    expect(manifestProblems(duplicate).join()).toContain("exactly once");
  });

  it("filters by either side's status and searches names, services and fixtures", () => {
    const nameOf = (id: Capability["id"]) => ai103Text("vi").capabilities[id].name;
    const all = manifest.capabilities;
    const mocks = filterCapabilities(all, {status: "mock", query: "", nameOf});
    expect(mocks.every((capability) => capability.local.status === "mock" || capability.azure?.status === "mock")).toBe(true);
    expect(filterCapabilities(all, {status: "azure-not-run", query: "", nameOf}).length).toBeGreaterThan(10);
    expect(filterCapabilities(all, {status: "all", query: "dịch thuật", nameOf}).map((capability) => capability.id)).toEqual(["translator"]);
    expect(filterCapabilities(all, {status: "all", query: "emails.json", nameOf}).map((capability) => capability.id)).toEqual(["language-pii", "content-safety"]);
    expect(filterCapabilities(all, {status: "verified-azure", query: "", nameOf})).toEqual([]);
  });

  it("wires every in-app check to exactly one capability, and every claimed check passes", () => {
    const used = manifest.capabilities.map((capability) => capability.check).filter(Boolean);
    expect([...used].sort()).toEqual([...checkIds].sort());
    expect([...checkRegistryIds].sort()).toEqual([...checkIds].sort());
    for (const capability of manifest.capabilities) {
      if (!capability.check) continue;
      const result = runCapabilityCheck(capability.id);
      expect(result?.passed, `${capability.id}: ${JSON.stringify(result?.cases.filter((entry) => !entry.passed))}`).toBe(true);
    }
  });
});
