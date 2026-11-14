import {describe, expect, it, vi} from "vitest";
import {
  AzureCallFailed, AzureCallRefused, contentUnderstandingSubmit, documentIntelligenceSubmit, openAiStructuredChat, parseLayoutResult,
  requireLive, searchQuery, translateAndCheck, type AzureFetch,
} from "./azure-adapters";
import {AZURE_OPT_IN_VALUE} from "./model";

const env = {
  AI103_AZURE_OPT_IN: AZURE_OPT_IN_VALUE,
  AI103_AZURE_SERVICES: "search,document-intelligence,openai,content-understanding,translator",
  AZURE_SEARCH_ENDPOINT: "https://lab.search.windows.net",
  AZURE_SEARCH_INDEX: "dossier-pages",
  AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: "https://lab.cognitiveservices.azure.com",
  AZURE_OPENAI_ENDPOINT: "https://lab.openai.azure.com",
  AZURE_OPENAI_DEPLOYMENT: "gpt-4o-mini",
  AZURE_CONTENT_UNDERSTANDING_ENDPOINT: "https://lab.services.ai.azure.com",
  AZURE_TRANSLATOR_ENDPOINT: "https://api.cognitive.microsofttranslator.com",
  AZURE_TRANSLATOR_REGION: "westeurope",
};
function stub(body: unknown, init: {status?: number; headers?: Record<string, string>} = {}) {
  const calls: {url: string; init: Parameters<AzureFetch>[1]}[] = [];
  const fetch: AzureFetch = vi.fn(async (url, request) => {
    calls.push({url, init: request});
    const status = init.status ?? 200;
    return {ok: status < 400, status, headers: {get: (name: string) => init.headers?.[name.toLowerCase()] ?? null}, json: async () => body};
  });
  return {fetch, calls};
}

describe("Azure adapter boundary (mocked HTTP, never live)", () => {
  it("refuses before building a request without the opt-in, the service selection or an Azure https endpoint", async () => {
    const {fetch} = stub({});
    await expect(searchQuery("x", {env: {...env, AI103_AZURE_OPT_IN: undefined}, token: "t", fetch})).rejects.toBeInstanceOf(AzureCallRefused);
    expect(() => requireLive("openai", {...env, AI103_AZURE_SERVICES: "search"})).toThrow("add openai to AI103_AZURE_SERVICES");
    expect(() => requireLive("search", {...env, AZURE_SEARCH_ENDPOINT: "http://lab.search.windows.net"})).toThrow("https Azure host");
    expect(() => requireLive("search", {...env, AZURE_SEARCH_ENDPOINT: "https://evil.example.com"})).toThrow("https Azure host");
    expect(() => requireLive("search", {...env, AZURE_SEARCH_INDEX: ""})).toThrow("missing AZURE_SEARCH_INDEX");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("maps an AI Search answer to the local hit contract and sends the token only as a header", async () => {
    const {fetch, calls} = stub({value: [{documentName: "nachtrag-n01-wv-2026-031.pdf", page: 2, sourceId: "p2", "@search.score": 3.2}]});
    const hits = await searchQuery("Genehmigte Gesamtvergütung", {env, token: "short-lived", fetch});
    expect(hits).toEqual([{documentName: "nachtrag-n01-wv-2026-031.pdf", page: 2, score: 3.2, sourceId: "p2"}]);
    expect(calls[0].url).toBe("https://lab.search.windows.net/indexes/dossier-pages/docs/search?api-version=2026-04-01");
    expect(calls[0].init.headers.Authorization).toBe("Bearer short-lived");
    expect(calls[0].url).not.toContain("short-lived");
  });

  it("submits a Document Intelligence layout request and reads page text and word confidence", async () => {
    const {fetch, calls} = stub({}, {status: 202, headers: {"operation-location": "https://lab.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-layout/analyzeResults/1"}});
    const operation = await documentIntelligenceSubmit("JVBERi0=", {env, token: "t", fetch});
    expect(operation).toContain("/analyzeResults/1");
    expect(calls[0].url).toBe("https://lab.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=2024-11-30");
    const parsed = parseLayoutResult({status: "succeeded", analyzeResult: {pages: [{pageNumber: 2, lines: [{content: "Genehmigte Gesamtvergütung: 48.780,00 EUR brutto"}], words: [{confidence: 0.9}, {confidence: 0.7}]}]}});
    expect(parsed.pages[0]).toEqual({number: 2, text: "Genehmigte Gesamtvergütung: 48.780,00 EUR brutto", meanWordConfidence: 0.8});
    expect(parseLayoutResult({status: "running"}).pages).toEqual([]);
  });

  it("uses the same JSON-schema contract as local Nova and refuses an unfinished answer", async () => {
    const answer = {segments: [{text: "Approved value 48.780,00 EUR", source: "S1"}]};
    const {fetch, calls} = stub({choices: [{finish_reason: "stop", message: {content: JSON.stringify(answer)}}], usage: {prompt_tokens: 900, completion_tokens: 40}});
    const result = await openAiStructuredChat("system", "prompt", {type: "object"}, {env, token: "t", fetch});
    expect(result).toEqual({answer, tokens: {input: 900, output: 40}});
    const sent = JSON.parse(calls[0].init.body as string);
    expect(sent.response_format.type).toBe("json_schema");
    expect(sent.temperature).toBe(0);
    const truncated = stub({choices: [{finish_reason: "length", message: {content: "{"}}]});
    await expect(openAiStructuredChat("s", "p", {}, {env, token: "t", fetch: truncated.fetch})).rejects.toBeInstanceOf(AzureCallFailed);
  });

  it("puts the Content Understanding analyzer in the URL and keeps inputs in the body", async () => {
    const {fetch, calls} = stub({}, {status: 202, headers: {"operation-location": "https://lab.services.ai.azure.com/op/1"}});
    await contentUnderstandingSubmit([{name: "bauauftrag-wv-2026-031.pdf", mimeType: "application/pdf", data: "JVBERi0="}], {env, token: "t", fetch});
    expect(calls[0].url).toBe("https://lab.services.ai.azure.com/contentunderstanding/analyzers/prebuilt-documentSearch:analyze?api-version=2025-11-01");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({inputs: [{name: "bauauftrag-wv-2026-031.pdf", mimeType: "application/pdf", data: "JVBERi0="}]});
  });

  it("checks an Azure translation with the local preservation rule", async () => {
    const good = stub([{translations: [{text: "Invoice RG-2026-0457 for EUR 49,980.00 gross", to: "en"}]}]);
    expect((await translateAndCheck("Rechnung RG-2026-0457 über 49.980,00 EUR brutto", "de", "en", {env, token: "t", fetch: good.fetch})).problems).toEqual([]);
    expect(good.calls[0].init.headers["Ocp-Apim-Subscription-Region"]).toBe("westeurope");
    const lost = stub([{translations: [{text: "Invoice for EUR 49,980.00 gross", to: "en"}]}]);
    expect((await translateAndCheck("Rechnung RG-2026-0457 über 49.980,00 EUR brutto", "de", "en", {env, token: "t", fetch: lost.fetch})).problems).toEqual(["IDENTIFIER_LOST RG-2026-0457"]);
  });

  it("never echoes a failed response body", async () => {
    const {fetch} = stub({error: {message: "Rechnungsbetrag 49.980,00 EUR"}}, {status: 500});
    await expect(searchQuery("x", {env, token: "t", fetch})).rejects.toThrow("search answered HTTP 500");
    await expect(searchQuery("x", {env, token: "t", fetch})).rejects.not.toThrow("49.980");
  });
});
