import {createHash} from "node:crypto";
import {existsSync, readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";
import {manifest} from "./model";

const read = (path: string) => readFileSync(path);
/** GitHub heading anchor: lower case, punctuation removed, spaces to hyphens. */
const anchorOf = (heading: string) => heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s/g, "-");

describe("AI-103 fixtures and evidence links", () => {
  it("point only at files that exist in the repository", () => {
    for (const capability of manifest.capabilities) {
      for (const path of capability.fixtures) expect(existsSync(path), `${capability.id}: ${path}`).toBe(true);
    }
  });

  it("link evidence to documents and headings that exist", () => {
    const links = manifest.capabilities.flatMap((capability) => [capability.local.log, capability.azure?.log].filter((link): link is string => !!link));
    for (const link of links) {
      const [path, anchor] = link.split("#");
      expect(existsSync(path), link).toBe(true);
      if (!anchor) continue;
      const headings = readFileSync(path, "utf8").split("\n").filter((line) => /^#{1,6} /.test(line)).map((line) => anchorOf(line.replace(/^#+ /, "")));
      expect(headings, link).toContain(anchor);
    }
  });

  it("keep the generated capability fixtures unchanged and labelled fictional", () => {
    const folder = "labs/ai103/fixtures/capability";
    const fixtureManifest = JSON.parse(readFileSync(`${folder}/manifest.json`, "utf8")) as {license: string; files: Record<string, {sha256: string; bytes: number}>};
    expect(fixtureManifest.license).toContain("FIKTIVE DATEN");
    for (const [name, entry] of Object.entries(fixtureManifest.files)) {
      const data = read(`${folder}/${name}`);
      expect(createHash("sha256").update(data).digest("hex"), name).toBe(entry.sha256);
      expect(data.length, name).toBe(entry.bytes);
      if (name.endsWith(".json")) expect(data.toString("utf8"), name).toContain("FIKTIVE DATEN");
    }
  });

  it("record the real size and checksum of each acceptance photo", () => {
    const {images} = JSON.parse(readFileSync("labs/ai103/fixtures/capability/images.json", "utf8")) as {images: {file: string; width: number; height: number; bytes: number; sha256: string}[]};
    for (const image of images) {
      const data = read(`services/credit-api/src/main/resources/contractor-dossier/${image.file}`);
      expect(data.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect([data.readUInt32BE(16), data.readUInt32BE(20)]).toEqual([image.width, image.height]);
      expect(data.length).toBe(image.bytes);
      expect(createHash("sha256").update(data).digest("hex")).toBe(image.sha256);
    }
  });

  it("ship a PDF whose second page is rotated by 90 degrees", () => {
    const pdf = read("labs/ai103/fixtures/capability/rotated-repeated-value.pdf").toString("latin1");
    expect(pdf.startsWith("%PDF-")).toBe(true);
    expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(2);
    expect(pdf).toMatch(/\/Rotate 90/);
  });
});
