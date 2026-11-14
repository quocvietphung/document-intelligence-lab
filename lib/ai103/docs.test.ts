import {readFileSync} from "node:fs";
import {expect, it} from "vitest";
import {ai103Texts} from "./language";
import {manifest, summarize} from "./model";

it("keeps the capability table and counts in docs/AI103_CAPABILITY_LAB.md in line with the manifest", () => {
  const lines = readFileSync("docs/AI103_CAPABILITY_LAB.md", "utf8").split("\n");
  manifest.capabilities.forEach((capability, index) => {
    const row = lines.find((line) => line.startsWith(`| ${index + 1} | ${ai103Texts.en.capabilities[capability.id].name} |`));
    expect(row, capability.id).toBeTruthy();
    expect(row).toContain(`| ${ai103Texts.en.groups[capability.group]} |`);
    expect(row).toContain(`\`${capability.local.status}\``);
    expect(row).toContain(capability.azure ? `\`${capability.azure.status}\`` : "no adapter");
    expect(row).toContain(capability.local.lastTested ?? "—");
    expect(row).toContain(capability.check ? `\`${capability.check}\`` : "command only");
  });
  const summary = summarize(manifest.capabilities);
  expect(lines.join("\n")).toContain(
    `Counts: ${summary["local-real-deterministic"]} local real or deterministic`,
  );
  expect(lines.join("\n")).toContain(`${summary["local-mock-configured"]} local mock, ${summary["azure-ready"]} Azure ready, ${summary["azure-verified"]} Azure verified`);
});
