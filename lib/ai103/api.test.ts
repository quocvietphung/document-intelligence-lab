import {afterEach, describe, expect, it, vi} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {GET} from "@/app/api/ai103/capabilities/route";
import {POST as runLocal} from "@/app/api/ai103/capabilities/[id]/run-local/route";
import {POST as runAzure} from "@/app/api/ai103/capabilities/[id]/run-azure/route";
import {Ai103Lab} from "@/components/workspace/Ai103Lab";
import {Ai103Summary} from "@/components/workspace/Ai103Summary";
import {AZURE_OPT_IN_VALUE, checkResultSchema, manifest} from "./model";

const context = (id: string) => ({params: Promise.resolve({id})});
const post = (path: string) => new Request(`http://localhost:3000${path}`, {method: "POST"});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("AI-103 API", () => {
  it("serves the manifest with its counts", async () => {
    const body = await GET().json();
    expect(body.capabilities).toHaveLength(18);
    expect(body.summary.total).toBe(18);
  });

  it("runs an in-app check on the server and returns what it compared", async () => {
    const response = await runLocal(post("/api/ai103/capabilities/ai-search/run-local"), context("ai-search"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe("check");
    expect(checkResultSchema.parse(body)).toMatchObject({capability: "ai-search", id: "search-pages", passed: true});
  });

  it("answers with the command when the evidence comes from another suite, and 404 for an unknown id", async () => {
    const command = await runLocal(post("/api/ai103/capabilities/security/run-local"), context("security"));
    expect(command.status).toBe(200);
    expect(await command.json()).toMatchObject({mode: "command", capability: "security", command: expect.stringContaining("JwtValidationTest")});
    expect((await runLocal(post("/api/ai103/capabilities/nope/run-local"), context("nope"))).status).toBe(404);
  });

  it("never sends an Azure request, with or without the opt-in", async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("no network")));
    vi.stubGlobal("fetch", fetchSpy);
    const refused = await runAzure(post("/api/ai103/capabilities/speech/run-azure"), context("speech"));
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({reason: "opt-in-off", requestSent: false, status: "azure-ready"});
    vi.stubEnv("AI103_AZURE_OPT_IN", AZURE_OPT_IN_VALUE);
    const optedIn = await runAzure(post("/api/ai103/capabilities/speech/run-azure"), context("speech"));
    expect(optedIn.status).toBe(501);
    expect((await optedIn.json()).requestSent).toBe(false);
    expect((await runAzure(post("/api/ai103/capabilities/service-selection/run-azure"), context("service-selection"))).status).toBe(409);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("AI-103 lab page", () => {
  it("renders four header counts, five groups and only the selected group's tiles", () => {
    const html = renderToStaticMarkup(createElement(Ai103Lab, {locale: "en", capabilities: manifest.capabilities}));
    for (const label of ["Local real/deterministic", "Local mock/configured", "Azure ready", "Azure verified"]) expect(html).toContain(label);
    expect(html).toContain("Capability count, not the number of live Azure services or model calls.");
    expect(html.match(/role="tab"/g)).toHaveLength(5);
    expect(html.match(/aria-label="Open lab: /g)).toHaveLength(manifest.capabilities.filter((c) => c.group === "ingest").length);
    expect(html).toContain('<span class="ai103-visually-hidden">Search capabilities</span>');
    expect(html).toContain("<dialog");
    expect(html).not.toContain("<table");
  });

  it("speaks German and Vietnamese with the same structure", () => {
    const de = renderToStaticMarkup(createElement(Ai103Lab, {locale: "de", capabilities: manifest.capabilities}));
    const vi = renderToStaticMarkup(createElement(Ai103Lab, {locale: "vi", capabilities: manifest.capabilities}));
    expect(de).toContain("Anzahl der Fähigkeiten, nicht die Zahl der Live-Azure-Dienste oder Modellaufrufe.");
    expect(de).toContain("Erfassen &amp; Verstehen");
    expect(vi).toContain("Đây là số năng lực, không phải số dịch vụ Azure chạy thật hay số lần gọi model.");
    expect(vi).toContain("Tiếp nhận &amp; hiểu");
    expect(vi).toContain('href="/vi/ai103"');
  });

  it("gives the Tasks page a summary and a link instead of a capability list", () => {
    const html = renderToStaticMarkup(createElement(Ai103Summary, {locale: "de", openCatalog: () => {}}));
    expect(html).toContain('href="/de/ai103"');
    expect(html).toContain("KI-Funktionen und Modelle: KI-Transparenz");
    expect(html).toContain("Azure bereit");
  });
});
