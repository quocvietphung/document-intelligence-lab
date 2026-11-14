/**
 * Azure adapter boundary for the AI-103 capabilities. Each adapter builds the documented request, sends it through an
 * injected `fetch`, and maps the answer to the same contract as its local counterpart, so local and Azure results can
 * be compared with one evaluation. Nothing here reads a secret: the caller passes a short-lived bearer token.
 *
 * Every adapter refuses unless AI103_AZURE_OPT_IN carries the billable opt-in value (the same switch as the lab CLI),
 * the service is listed in AI103_AZURE_SERVICES and its endpoint is an https URL on an Azure host. There is no fallback
 * between local and Azure. These adapters are tested only at a mocked HTTP boundary; none was called live.
 */
import {AZURE_OPT_IN_VALUE} from "./model";
import {preservationProblems} from "./checks";

export type AzureService = "search" | "document-intelligence" | "openai" | "content-understanding" | "translator";
export type AzureEnv = Record<string, string | undefined>;
export type AzureResponse = {ok: boolean; status: number; headers: {get(name: string): string | null}; json(): Promise<unknown>};
export type AzureFetch = (url: string, init: {method: "POST" | "GET"; headers: Record<string, string>; body?: string}) => Promise<AzureResponse>;
export type AzureContext = {env: AzureEnv; token: string; fetch: AzureFetch};

/** Pinned API versions. Override with the *_API_VERSION variables; confirm against the current reference before a live run. */
export const azureApiVersions = {
  search: "2026-04-01",
  "document-intelligence": "2024-11-30",
  openai: "2024-10-21",
  "content-understanding": "2025-11-01",
  translator: "3.0",
} as const satisfies Record<AzureService, string>;

const services: Record<AzureService, {endpoint: string; required: string[]; version: string; hosts: RegExp}> = {
  search: {endpoint: "AZURE_SEARCH_ENDPOINT", required: ["AZURE_SEARCH_INDEX"], version: "AZURE_SEARCH_API_VERSION", hosts: /\.search\.windows\.net$/},
  "document-intelligence": {endpoint: "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", required: [], version: "AZURE_DOCUMENT_INTELLIGENCE_API_VERSION", hosts: /\.cognitiveservices\.azure\.com$/},
  openai: {endpoint: "AZURE_OPENAI_ENDPOINT", required: ["AZURE_OPENAI_DEPLOYMENT"], version: "AZURE_OPENAI_API_VERSION", hosts: /\.(openai|cognitiveservices)\.azure\.com$/},
  "content-understanding": {endpoint: "AZURE_CONTENT_UNDERSTANDING_ENDPOINT", required: [], version: "AZURE_CONTENT_UNDERSTANDING_API_VERSION", hosts: /\.(services\.ai|cognitiveservices)\.azure\.com$/},
  translator: {endpoint: "AZURE_TRANSLATOR_ENDPOINT", required: ["AZURE_TRANSLATOR_REGION"], version: "AZURE_TRANSLATOR_API_VERSION", hosts: /(^api\.cognitive\.microsofttranslator\.com|\.cognitiveservices\.azure\.com)$/},
};

export class AzureCallRefused extends Error {}
export class AzureCallFailed extends Error {
  constructor(readonly service: AzureService, readonly status: number) {
    // The response body is never echoed: it can contain document text.
    super(`${service} answered HTTP ${status}`);
  }
}

/** The gate. Returns the endpoint and API version, or throws before any request is built. */
export function requireLive(service: AzureService, env: AzureEnv): {endpoint: string; version: string} {
  if (env.AI103_AZURE_OPT_IN !== AZURE_OPT_IN_VALUE) throw new AzureCallRefused(`set AI103_AZURE_OPT_IN=${AZURE_OPT_IN_VALUE} to allow billable Azure calls`);
  const selected = (env.AI103_AZURE_SERVICES ?? "").split(",").map((value) => value.trim());
  if (!selected.includes(service)) throw new AzureCallRefused(`add ${service} to AI103_AZURE_SERVICES to call it`);
  const definition = services[service];
  const missing = [definition.endpoint, ...definition.required].filter((name) => !env[name]);
  if (missing.length) throw new AzureCallRefused(`${service} configuration incomplete: missing ${missing.join(", ")}`);
  let url: URL;
  try {
    url = new URL(env[definition.endpoint] as string);
  } catch {
    throw new AzureCallRefused(`${service} endpoint is not a URL`);
  }
  if (url.protocol !== "https:" || !definition.hosts.test(url.hostname)) throw new AzureCallRefused(`${service} endpoint must be an https Azure host`);
  return {endpoint: url.origin, version: env[definition.version] || azureApiVersions[service]};
}

async function post(service: AzureService, context: AzureContext, url: string, body: unknown, extra: Record<string, string> = {}) {
  const response = await context.fetch(url, {
    method: "POST",
    headers: {Authorization: `Bearer ${context.token}`, "Content-Type": "application/json", ...extra},
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new AzureCallFailed(service, response.status);
  return response;
}

/** AI Search query → the hit shape of the local search check (document name, page, score, source id). */
export async function searchQuery(query: string, context: AzureContext, top = 5) {
  const {endpoint, version} = requireLive("search", context.env);
  const index = encodeURIComponent(context.env.AZURE_SEARCH_INDEX as string);
  const response = await post("search", context, `${endpoint}/indexes/${index}/docs/search?api-version=${version}`,
    {search: query, top, select: "documentName,page,sourceId", queryType: "simple"});
  const body = (await response.json()) as {value?: {documentName?: string; page?: number; sourceId?: string; "@search.score"?: number}[]};
  return (body.value ?? []).map((hit) => ({documentName: hit.documentName ?? "", page: hit.page ?? 0, score: hit["@search.score"] ?? 0, sourceId: hit.sourceId ?? ""}));
}

/** Document Intelligence layout: submit returns the operation URL; the result maps to pages, lines and word confidence. */
export async function documentIntelligenceSubmit(base64Source: string, context: AzureContext) {
  const {endpoint, version} = requireLive("document-intelligence", context.env);
  const model = encodeURIComponent(context.env.AZURE_DOCUMENT_INTELLIGENCE_MODEL || "prebuilt-layout");
  const response = await post("document-intelligence", context, `${endpoint}/documentintelligence/documentModels/${model}:analyze?api-version=${version}`, {base64Source});
  const operation = response.headers.get("operation-location");
  if (!operation || !operation.startsWith(endpoint)) throw new AzureCallFailed("document-intelligence", response.status);
  return operation;
}
export function parseLayoutResult(body: unknown) {
  const result = (body as {status?: string; analyzeResult?: {pages?: {pageNumber: number; lines?: {content: string}[]; words?: {confidence?: number}[]}[]}}) ?? {};
  if (result.status !== "succeeded") return {status: result.status ?? "unknown", pages: []};
  return {
    status: "succeeded",
    pages: (result.analyzeResult?.pages ?? []).map((page) => {
      const confidences = (page.words ?? []).map((word) => word.confidence).filter((value): value is number => typeof value === "number");
      return {number: page.pageNumber, text: (page.lines ?? []).map((line) => line.content).join("\n"),
        // Word confidence describes recognition, not the correctness of an extracted field.
        meanWordConfidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : null};
    }),
  };
}

/** Azure OpenAI with the same JSON-schema contract as local Nova (segments that name a source label). */
export async function openAiStructuredChat(system: string, prompt: string, schema: Record<string, unknown>, context: AzureContext) {
  const {endpoint, version} = requireLive("openai", context.env);
  const deployment = encodeURIComponent(context.env.AZURE_OPENAI_DEPLOYMENT as string);
  const response = await post("openai", context, `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${version}`, {
    messages: [{role: "system", content: system}, {role: "user", content: prompt}],
    temperature: 0,
    response_format: {type: "json_schema", json_schema: {name: "nova_answer", strict: true, schema}},
  });
  const body = (await response.json()) as {choices?: {finish_reason?: string; message?: {content?: string}}[]; usage?: {prompt_tokens?: number; completion_tokens?: number}};
  const choice = body.choices?.[0];
  if (choice?.finish_reason !== "stop" || !choice.message?.content) throw new AzureCallFailed("openai", 422);
  return {answer: JSON.parse(choice.message.content) as unknown, tokens: {input: body.usage?.prompt_tokens ?? null, output: body.usage?.completion_tokens ?? null}};
}

/** Content Understanding analyze: the analyzer id is part of the URL; the body holds inputs with mimeType and url or data. */
export async function contentUnderstandingSubmit(inputs: {name: string; mimeType: string; data?: string; url?: string}[], context: AzureContext) {
  const {endpoint, version} = requireLive("content-understanding", context.env);
  const analyzer = encodeURIComponent(context.env.AZURE_CONTENT_UNDERSTANDING_ANALYZER || "prebuilt-documentSearch");
  const response = await post("content-understanding", context, `${endpoint}/contentunderstanding/analyzers/${analyzer}:analyze?api-version=${version}`, {inputs});
  return response.headers.get("operation-location");
}

/** Translator, checked with the same preservation rule as the local check (identifiers, amounts, currency). */
export async function translateAndCheck(source: string, from: string, to: string, context: AzureContext, identifiers: readonly string[] = []) {
  const {endpoint, version} = requireLive("translator", context.env);
  const response = await post("translator", context, `${endpoint}/translate?api-version=${version}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    [{text: source}], {"Ocp-Apim-Subscription-Region": context.env.AZURE_TRANSLATOR_REGION as string});
  const body = (await response.json()) as {translations?: {text: string; to: string}[]}[];
  const text = body[0]?.translations?.[0]?.text ?? "";
  return {text, problems: to === "en" ? preservationProblems(source, text, identifiers) : null};
}
