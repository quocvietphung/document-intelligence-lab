import {readFileSync} from "node:fs";
import {expect, it} from "vitest";
import {ai103Texts} from "./language";
import {manifest, summarize} from "./model";

it("keeps the capability table and counts in docs/AI103_CAPABILITY_LAB.md in line with the manifest", () => {
  const lines = readFileSync("docs/AI103_CAPABILITY_LAB.md", "utf8").split("\n");
  manifest.capabilities.forEach((capability, index) => {
    const row = lines.find((line) => line.startsWith(`| ${index + 1} | ${ai103Texts.en.capabilities[capability.id].name} |`));
    expect(row, capability.id).toBeTruthy();
    expect(row).toContain(`\`${capability.local.status}\``);
    expect(row).toContain(capability.azure ? `\`${capability.azure.status}\`` : "not applicable");
    expect(row).toContain(capability.local.lastTested ?? "—");
    expect(row).toContain(capability.check ? `\`${capability.check}\`` : "command only");
  });
  const summary = summarize(manifest.capabilities);
  expect(lines.join("\n")).toContain(
    `Counts: ${summary["verified-local"]} verified locally, ${summary["verified-azure"]} verified on Azure, ${summary["configured-mocked"]} configured or mocked`,
  );
});
