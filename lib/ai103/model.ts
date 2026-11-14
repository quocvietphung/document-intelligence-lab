import {z} from "zod";
import manifestJson from "./capabilities.json";

/**
 * Local status: a real local engine or service ran (local-real), a fixed rule or check ran on fixtures without a model
 * (local-deterministic), only a fixture or stub exists (local-mock), or the hardware cannot run it (not-supported-locally).
 * Azure status: the adapter passed tests at a mocked HTTP boundary but was never called (azure-ready), or Azure was
 * called and a redacted result is stored (azure-live-verified). No Azure object means no adapter exists.
 */
export const localStatuses = ["local-real", "local-deterministic", "local-mock", "not-supported-locally"] as const;
export const azureStatuses = ["azure-ready", "azure-live-verified"] as const;
export const statuses = [...localStatuses, ...azureStatuses] as const;
export type LocalStatus = (typeof localStatuses)[number];
export type AzureStatus = (typeof azureStatuses)[number];
export type Status = LocalStatus | AzureStatus;

/** Five groups, in the order the lab shows them. */
export const groupIds = ["ingest", "search", "agents", "safety", "operate"] as const;
export type GroupId = (typeof groupIds)[number];

/** The eighteen capability groups, in the order the lab shows them. */
export const capabilityIds = [
  "foundry-tools", "security", "image-generation", "ai-search", "observability", "foundry-agents",
  "speech", "rag", "service-selection", "content-understanding", "deployment", "genai-app",
  "vision-understanding", "language-pii", "translator", "document-intelligence", "content-safety", "evaluation",
] as const;
export type CapabilityId = (typeof capabilityIds)[number];

/** In-app deterministic checks. Each one reads fixtures bundled with the app and never calls a network service. */
export const checkIds = [
  "search-pages", "speech-transcript", "translator-preservation", "pii-masking", "cu-request-shape",
  "image-request-contract", "photo-metadata", "ocr-cross-check", "decision-matrix", "evaluation-deterministic",
  "trace-steps", "injection-guard",
] as const;
export type CheckId = (typeof checkIds)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const record = {
  lastTested: isoDate.nullable(),
  command: z.string().nullable(),
  expected: z.string().min(1),
  actual: z.string().min(1),
  latencyMs: z.number().nonnegative().nullable(),
  cost: z.string().min(1),
  log: z.string().min(1),
};
const localSide = z.object({status: z.enum(localStatuses), ...record});
const azureSide = z.object({status: z.enum(azureStatuses), ...record});

export const capabilitySchema = z.object({
  id: z.enum(capabilityIds),
  group: z.enum(groupIds),
  azureService: z.string().nullable(),
  learnUrl: z.string().regex(/^https:\/\/learn\.microsoft\.com\//),
  check: z.enum(checkIds).nullable(),
  fixtures: z.array(z.string().min(1)).min(1),
  parts: z.array(z.object({name: z.string().min(1), status: z.enum(localStatuses)})).optional(),
  local: localSide,
  azure: azureSide.nullable(),
});
export const manifestSchema = z.object({
  format: z.literal("ai103-capability-manifest-v2"),
  note: z.string().min(1),
  capabilities: z.array(capabilitySchema),
});
export type Capability = z.infer<typeof capabilitySchema>;
export type Side = z.infer<typeof localSide> | z.infer<typeof azureSide>;
export type Manifest = z.infer<typeof manifestSchema>;

/**
 * Rules that the JSON schema cannot express. An empty result means the manifest is consistent.
 * A status that claims evidence must carry the date, the command and the result it claims.
 */
export function manifestProblems(manifest: Manifest): string[] {
  const problems: string[] = [];
  const ids = manifest.capabilities.map((capability) => capability.id);
  if (ids.length !== capabilityIds.length || new Set(ids).size !== ids.length || capabilityIds.some((id) => !ids.includes(id))) {
    problems.push("the manifest must list each of the eighteen capability groups exactly once");
  }
  for (const capability of manifest.capabilities) {
    const label = capability.id;
    const local = capability.local;
    if ((local.status === "local-real" || local.status === "local-deterministic") && (!local.lastTested || !local.command)) {
      problems.push(`${label}: ${local.status} needs lastTested and a command`);
    }
    if (local.status === "local-real" && capability.check === null && !local.command) problems.push(`${label}: local-real needs the command that ran`);
    const azure = capability.azure;
    if (!azure) continue;
    if (azure.status === "azure-live-verified" && (!azure.lastTested || !azure.command || azure.latencyMs === null)) {
      problems.push(`${label}: azure-live-verified needs lastTested, a command and a measured latency`);
    }
    if (azure.status === "azure-ready" && (azure.lastTested !== null || !azure.command || !/not live-tested/i.test(azure.actual))) {
      problems.push(`${label}: azure-ready must name its adapter test, say "Not live-tested" and carry no live test date`);
    }
  }
  if (groupIds.some((group) => !manifest.capabilities.some((capability) => capability.group === group))) problems.push("every group needs a capability");
  return problems;
}

export const manifest: Manifest = manifestSchema.parse(manifestJson);

export type Bucket = "local-real-deterministic" | "local-mock-configured" | "azure-ready" | "azure-verified";
export const buckets: readonly Bucket[] = ["local-real-deterministic", "local-mock-configured", "azure-ready", "azure-verified"];

/** Header counts. Local and Azure counts overlap: a capability can run locally and also have an Azure adapter. */
export function summarize(list: readonly Capability[]): Record<Bucket, number> & {total: number} {
  return {
    "local-real-deterministic": list.filter((c) => c.local.status === "local-real" || c.local.status === "local-deterministic").length,
    "local-mock-configured": list.filter((c) => c.local.status === "local-mock").length,
    "azure-ready": list.filter((c) => c.azure?.status === "azure-ready").length,
    "azure-verified": list.filter((c) => c.azure?.status === "azure-live-verified").length,
    total: list.length,
  };
}

/** Status filter matches either side; search matches the id, the localised name, the Azure service and the fixtures. */
export function filterCapabilities(
  list: readonly Capability[],
  options: {status: Status | "all" | "no-azure-adapter"; query: string; nameOf: (id: CapabilityId) => string; group?: GroupId},
): Capability[] {
  const query = options.query.trim().toLocaleLowerCase();
  return list.filter((capability) => {
    if (options.group && capability.group !== options.group) return false;
    if (options.status === "no-azure-adapter") { if (capability.azure) return false; }
    else if (options.status !== "all" && capability.local.status !== options.status && capability.azure?.status !== options.status) return false;
    if (!query) return true;
    const haystack = [capability.id, options.nameOf(capability.id), capability.azureService ?? "", ...capability.fixtures].join(" ");
    return haystack.toLocaleLowerCase().includes(query);
  });
}

/** Result of one in-app check. Cases are what the check compared; `notRun` names metrics that were not measured. */
export const checkCaseSchema = z.object({name: z.string(), expected: z.string(), actual: z.string(), passed: z.boolean()});
export const checkResultSchema = z.object({
  id: z.enum(checkIds),
  capability: z.enum(capabilityIds),
  passed: z.boolean(),
  cases: z.array(checkCaseSchema).min(1),
  notRun: z.array(z.string()),
  fixtures: z.array(z.string()),
  ranAt: z.string(),
  latencyMs: z.number().nonnegative(),
});
export type CheckCase = z.infer<typeof checkCaseSchema>;
export type CheckResult = z.infer<typeof checkResultSchema>;

/** Same opt-in value as labs/ai103/contractor_lab/cloud.py, so one switch governs every live Azure path. */
export const AZURE_OPT_IN_VALUE = "billable-calls-approved";

export function capabilityById(id: string): Capability | undefined {
  return manifest.capabilities.find((capability) => capability.id === id);
}
