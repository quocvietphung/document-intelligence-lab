import { afterEach, describe, expect, it, vi } from "vitest";
import catalog from "../services/credit-api/src/main/resources/use-cases/catalog.json";
import { adapterCopy, capabilityLabels, connectorError, describeAdapter, importable, integrationsLanguage, integrationsText, labelText, modeText, overviewSchema, previewSchema, selectable, useCaseCatalogSchema, type Provider } from "./integrations";
import { proxyConnectors, readOauthCookie, oauthCookie } from "./connector-proxy";
import { oauthCallbackRedirect } from "./oauth-callback";
import { proxyCase } from "./case-proxy";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const descriptor = { kind: "document-source", requiresConnection: true, scopes: [], permissions: [], note: null, live: false, enabled: true } as const;
const overview = {
  tokensInBrowser: false, automaticSync: false,
  providers: [
    { ...descriptor, id: "local", provider: "Local files and fictional fixtures", label: "verified-local", requiresConnection: false, connection: "NOT_REQUIRED", sync: {} },
    { ...descriptor, id: "gmail", provider: "Gmail", label: "implemented-not-live-verified", live: true, scopes: ["https://www.googleapis.com/auth/gmail.readonly"], connection: "DISCONNECTED", sync: { lastError: "CONNECTOR_REAUTH_REQUIRED" } },
    { ...descriptor, id: "microsoft-365", provider: "Microsoft 365", label: "simulated", requiresConnection: false, connection: "NOT_REQUIRED", sync: { found: 7, imported: 2 } },
    { ...descriptor, id: "s3", provider: "S3 / MinIO", label: "future", enabled: false, connection: "DISCONNECTED", sync: {} },
  ],
  businessData: [], destinations: [],
};

describe("integrations copy and contracts", () => {
  it("keeps every label complete and distinct in English, German and Vietnamese", () => {
    const keys = Object.keys(integrationsLanguage.en).sort();
    for (const [language, copy] of Object.entries(integrationsLanguage)) {
      expect(Object.keys(copy).sort(), language).toEqual(keys);
      expect(Object.values(copy).every((value) => value.trim().length > 0), language).toBe(true);
    }
    const translated = keys.filter((key) => integrationsLanguage.vi[key as keyof typeof integrationsLanguage.vi] !== integrationsLanguage.en[key as keyof typeof integrationsLanguage.en]);
    expect(translated.length).toBeGreaterThan(keys.length * 0.8);
    expect(integrationsText("fr")).toBe(integrationsLanguage.en);
    for (const locale of ["en", "de", "vi"]) for (const label of capabilityLabels) expect(labelText(integrationsText(locale), label)).toBeTruthy();
    expect(labelText(integrationsText("en"), "simulated")).toContain("simulated");
    expect(labelText(integrationsText("en"), "implemented-not-live-verified")).toContain("not live-verified");
  });

  it("parses Java status without tokens and never treats simulated or future adapters as live imports", () => {
    const parsed = overviewSchema.parse(overview);
    expect(() => overviewSchema.parse({ ...overview, tokensInBrowser: true })).toThrow();
    const [local, gmail, m365, s3] = parsed.providers as Provider[];
    expect(importable(local)).toBe(true);
    expect(importable(gmail)).toBe(false);
    expect(importable(m365)).toBe(true);
    expect(importable(s3)).toBe(false);
    const copy = integrationsText("en");
    expect(modeText(copy, m365)).toBe(copy.modeSimulated);
    expect(modeText(copy, local)).toBe(copy.modeLocal);
    expect(modeText(copy, gmail)).toBe(copy.modeReal);
    expect(modeText(copy, s3)).toBe(copy.modeFuture);
    const item = { sourceId: "gmail", externalId: "m/1", revision: "1", name: "a.pdf", declaredMime: "application/pdf", size: 10, canDownload: true, link: "", metadata: {}, alreadyImported: false };
    expect(selectable(item)).toBe(true);
    expect(selectable({ ...item, alreadyImported: true })).toBe(false);
    expect(selectable({ ...item, canDownload: false })).toBe(false);
    expect(() => previewSchema.parse({ sourceId: "gmail", label: "simulated", automaticImport: true, items: [] })).toThrow();
  });

  it("localizes every known adapter so no locale mixes languages", () => {
    const known = ["local", "gmail", "google-drive", "microsoft-365", "webdav", "s3", "csv-excel", "postgresql", "generic-rest", "dynamics-dataverse", "download-report", "gmail-draft", "webhook", "crm-write-back"];
    expect(Object.keys(adapterCopy).sort()).toEqual([...known].sort());
    for (const id of known) for (const locale of ["en", "de", "vi"]) {
      const text = describeAdapter({ id, provider: "Fallback", permissions: ["English fallback"], note: "English fallback", label: "future", enabled: false }, locale);
      expect(text.note, `${id} ${locale}`).toBeTruthy();
      expect(text.permissions.join(" ")).not.toContain("English fallback");
      if (locale !== "en") expect(text.note).not.toBe(describeAdapter({ id, provider: "x", permissions: [], note: "x", label: "future", enabled: false }, "en").note);
    }
    const m365 = { id: "microsoft-365", provider: "Microsoft 365", permissions: [], note: null, label: "simulated" as const, enabled: true };
    expect(describeAdapter(m365, "vi").note).toContain("mô phỏng");
    expect(describeAdapter({ ...m365, enabled: false }, "de").note).toContain("local-dev");
    expect(describeAdapter({ ...m365, enabled: false, label: "implemented-not-live-verified" }, "vi").note).toContain("Entra");
    expect(describeAdapter({ id: "new-adapter", provider: "New", permissions: ["p"], note: "n", label: "future", enabled: false }, "de")).toEqual({ name: "New", permissions: ["p"], note: "n" });
  });

  it("maps stable error codes and never echoes free text", () => {
    expect(connectorError("vi", "CONNECTOR_REAUTH_REQUIRED")).toContain("kết nối lại");
    expect(connectorError("de", "MIME_MISMATCH")).toContain("kein PDF");
    expect(connectorError("en", "SOMETHING_NEW")).toBe("The request failed. (SOMETHING_NEW)");
    expect(connectorError("en", "<script>alert(1)</script>")).toBe("The request failed.");
    expect(connectorError("en", undefined)).toBe("The request failed.");
  });

  it("ships eight fictional use cases with questions in three languages and no employer names", () => {
    const parsed = useCaseCatalogSchema.parse(catalog);
    expect(parsed.useCases).toHaveLength(8);
    for (const useCase of parsed.useCases) {
      expect(useCase.fixtures.length).toBeGreaterThan(0);
      for (const locale of ["en", "de", "vi"] as const) expect(useCase.answerable.question[locale] && useCase.unanswerable.question[locale] && useCase.boundary[locale]).toBeTruthy();
    }
    expect(parsed.useCases.find((u) => u.id === "project-assessment")?.businessDataSample).toContain("type,name,planned,forecast");
    expect(JSON.stringify(catalog).toLowerCase()).not.toMatch(/instone|apobank/);
  });
});

describe("connector transport", () => {
  const headers = { Authorization: "Bearer synthetic-test-token" };
  const cookie = (value: object) => `${oauthCookie}=${Buffer.from(JSON.stringify(value)).toString("base64url")}`;
  const state = "s".repeat(43);

  it("allows only named routes and methods with a bearer token", async () => {
    vi.stubEnv("CREDIT_API_URL", "http://java:8080");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ providers: [] }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await proxyConnectors(new Request("http://localhost:3000/api/connectors", { headers }), [])).status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe("http://java:8080/api/connectors");
    expect((await proxyConnectors(new Request("http://localhost:3000/api/connectors"), [])).status).toBe(401);
    expect((await proxyConnectors(new Request("http://localhost:3000/api/connectors/google/authorize", { headers }), ["google", "authorize"])).status).toBe(405);
    expect((await proxyConnectors(new Request("http://localhost:3000/api/connectors/google/send", { headers, method: "POST" }), ["google", "send"])).status).toBe(404);
    expect((await proxyConnectors(new Request("http://localhost:3000/api/connectors/x", { headers }), ["..%2F"])).status).toBe(400);
    expect((await proxyConnectors(new Request("http://localhost:3000/api/connectors/google/disconnect", { headers: { ...headers, Origin: "https://evil.example" }, method: "POST", body: "{}" }), ["google", "disconnect"])).status).toBe(403);
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    expect((await proxyConnectors(new Request("http://localhost:3000/api/connectors", { headers }), [])).status).toBe(503);
  });

  it("completes OAuth only from the HttpOnly cookie and clears it", async () => {
    vi.stubEnv("CREDIT_API_URL", "http://java:8080");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: "CONNECTED", scopes: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const missing = await proxyConnectors(new Request("http://localhost:3000/api/connectors/google/callback", { headers, method: "POST", body: JSON.stringify({ code: "from-js", state }) }), ["google", "callback"]);
    expect(missing.status).toBe(422);
    expect(await missing.json()).toEqual({ error: "OAUTH_STATE_INVALID" });
    expect(fetchMock).not.toHaveBeenCalled();
    const response = await proxyConnectors(new Request("http://localhost:3000/api/connectors/google/callback", { headers: { ...headers, Cookie: `NEXT_LOCALE=vi; ${cookie({ code: "good-code", state })}` }, method: "POST", body: "{}" }), ["google", "callback"]);
    expect(response.status).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body.toString())).toEqual({ code: "good-code", state });
    expect(response.headers.get("set-cookie")).toContain(`${oauthCookie}=; Path=/api/connectors; HttpOnly; SameSite=Lax; Max-Age=0`);
    expect(readOauthCookie(`${oauthCookie}=not-base64-json`)).toBeUndefined();
    expect(readOauthCookie(cookie({ code: "x", state: "short" }))).toBeUndefined();
    expect(readOauthCookie(cookie({ code: "x".repeat(600), state }))).toBeUndefined();
  });

  it("passes stable error codes but hides other error bodies", async () => {
    vi.stubEnv("CREDIT_API_URL", "http://java:8080");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "CONNECTOR_REAUTH_REQUIRED" }, { status: 409 })));
    expect(await (await proxyConnectors(new Request("http://localhost:3000/api/connectors/google/authorize", { headers, method: "POST", body: "{}" }), ["google", "authorize"])).json()).toEqual({ error: "CONNECTOR_REAUTH_REQUIRED" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("java.lang.IllegalStateException: token ya29 secret", { status: 500 })));
    expect(await (await proxyConnectors(new Request("http://localhost:3000/api/connectors", { headers }), [])).json()).toEqual({ error: "Request failed (500)" });
  });

  it("moves the Google code into an HttpOnly cookie and keeps it out of the URL", () => {
    const valid = oauthCallbackRedirect(new Request(`http://localhost:3000/oauth/google/callback?code=4%2F0Ab-code&state=${state}`, { headers: { Cookie: "NEXT_LOCALE=vi" } }));
    expect(valid.status).toBe(303);
    expect(valid.headers.get("location")).toBe("/vi?googleOAuth=1#integrations");
    expect(valid.headers.get("location")).not.toContain("code");
    const setCookie = valid.headers.get("set-cookie") || "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/api/connectors");
    expect(setCookie).not.toContain("Secure");
    expect(readOauthCookie(setCookie.split(";")[0])).toEqual({ code: "4/0Ab-code", state });
    const denied = oauthCallbackRedirect(new Request("http://localhost:3000/oauth/google/callback?error=access_denied"));
    expect(denied.headers.get("location")).toBe("/en?googleOAuth=denied#integrations");
    expect(denied.headers.get("set-cookie")).toBeNull();
    expect(oauthCallbackRedirect(new Request(`http://localhost:3000/oauth/google/callback?code=x&state=bad`)).headers.get("location")).toContain("denied");
    expect(oauthCallbackRedirect(new Request(`https://lab.example.org/oauth/google/callback?code=x&state=${state}`)).headers.get("set-cookie")).toContain("Secure");
  });

  it("routes connector case paths with the right methods and forwards only stable codes", async () => {
    vi.stubEnv("CREDIT_API_URL", "http://java:8080");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));
    const routes: [string[], string][] = [
      [["C", "platform", "sources", "gmail", "preview"], "POST"], [["C", "platform", "sources", "local", "import"], "POST"], [["C", "platform", "sources", "imports"], "GET"],
      [["C", "platform", "destinations", "report"], "POST"], [["C", "platform", "destinations", "gmail-draft", "preview"], "POST"], [["C", "platform", "destinations", "gmail-draft", "approve"], "POST"],
      [["C", "platform", "project-assessment"], "POST"], [["C", "platform", "use-cases", "contract-risk", "check"], "POST"],
    ];
    for (const [path, method] of routes) {
      const url = "http://localhost:3000/api/cases/" + path.join("/");
      expect((await proxyCase(new Request(url, { headers, method, body: method === "POST" ? "{}" : undefined }), path)).status, path.join("/")).toBe(200);
      expect((await proxyCase(new Request(url, { headers, method: method === "GET" ? "POST" : "GET", body: method === "GET" ? "{}" : undefined }), path)).status).toBe(405);
    }
    expect((await proxyCase(new Request("http://localhost:3000/api/cases/C/platform/destinations/gmail-draft/send", { headers, method: "POST", body: "{}" }), ["C", "platform", "destinations", "gmail-draft", "send"])).status).toBe(404);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "HUMAN_REVIEW_REQUIRED" }, { status: 409 })));
    const draft = await proxyCase(new Request("http://localhost:3000/api/cases/C/platform/destinations/gmail-draft/preview", { headers, method: "POST", body: "{}" }), ["C", "platform", "destinations", "gmail-draft", "preview"]);
    expect(await draft.json()).toEqual({ error: "HUMAN_REVIEW_REQUIRED" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "STALE_CASE" }, { status: 409 })));
    const other = await proxyCase(new Request("http://localhost:3000/api/cases/C/platform/search", { headers, method: "POST", body: "{}" }), ["C", "platform", "search"]);
    expect(await other.json()).toEqual({ error: "Request failed (409)" });
  });
});
