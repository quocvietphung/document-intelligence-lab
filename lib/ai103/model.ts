import {z} from "zod";
import manifestJson from "./capabilities.json";

/** Seven status words. Local and Azure sides accept different subsets; see the validator below. */
export const statuses = ["verified-local", "verified-azure", "configured", "mock", "azure-not-run", "blocked", "not-supported"] as const;
export type Status = (typeof statuses)[number];
export const localStatuses: readonly Status[] = ["verified-local", "configured", "mock", "blocked", "not-supported"];
export const azureStatuses: readonly Status[] = ["verified-azure", "configured", "azure-not-run", "blocked", "not-supported"];

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
const side = z.object({
  status: z.enum(statuses),
  lastTested: isoDate.nullable(),
  command: z.string().nullable(),
  expected: z.string().min(1),
  actual: z.string().min(1),
  latencyMs: z.number().nonnegative().nullable(),
  cost: z.string().min(1),
  log: z.string().min(1),
});

export const capabilitySchema = z.object({
  id: z.enum(capabilityIds),
  azureService: z.string().nullable(),
  check: z.enum(checkIds).nullable(),
  fixtures: z.array(z.string().min(1)).min(1),
  parts: z.array(z.object({name: z.string().min(1), status: z.enum(statuses)})).optional(),
  local: side,
  azure: side.nullable(),
});
export const manifestSchema = z.object({
  format: z.literal("ai103-capability-manifest-v1"),
  note: z.string().min(1),
  capabilities: z.array(capabilitySchema),
});
export type Capability = z.infer<typeof capabilitySchema>;
export type Side = z.infer<typeof side>;
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
    if (!localStatuses.includes(local.status)) problems.push(`${label}: local status ${local.status} is not allowed on the local side`);
    if (local.status === "verified-local" && (!local.lastTested || !local.command)) {
      problems.push(`${label}: verified-local needs lastTested and a command`);
    }
    if (capability.azure) {
      const azure = capability.azure;
      if (!azureStatuses.includes(azure.status)) problems.push(`${label}: azure status ${azure.status} is not allowed on the Azure side`);
      if (azure.status === "verified-azure" && (!azure.lastTested || !azure.command || azure.latencyMs === null)) {
        problems.push(`${label}: verified-azure needs lastTested, a command and a measured latency`);
      }
      if (azure.status === "azure-not-run" && (!azure.command || azure.lastTested !== null)) {
        problems.push(`${label}: azure-not-run needs the opt-in command and no lastTested date`);
      }
      if (azure.status === "not-supported" && azure.lastTested !== null) problems.push(`${label}: not-supported cannot have a test date`);
    }
  }
  return problems;
}

export const manifest: Manifest = manifestSchema.parse(manifestJson);

export type Bucket = "verified-local" | "verified-azure" | "configured-mocked" | "blocked-unsupported";
export const buckets: readonly Bucket[] = ["verified-local", "verified-azure", "configured-mocked", "blocked-unsupported"];

/**
 * Each capability is counted once, under its strongest evidence: Azure verified, then local verified,
 * then blocked or unsupported locally, otherwise configured or mocked.
 */
export function bucketOf(capability: Pick<Capability, "local" | "azure">): Bucket {
  if (capability.azure?.status === "verified-azure") return "verified-azure";
  if (capability.local.status === "verified-local") return "verified-local";
  if (capability.local.status === "blocked" || capability.local.status === "not-supported") return "blocked-unsupported";
  return "configured-mocked";
}

export function summarize(list: readonly Capability[]): Record<Bucket, number> & {total: number} {
  const counts: Record<Bucket, number> & {total: number} = {
    "verified-local": 0, "verified-azure": 0, "configured-mocked": 0, "blocked-unsupported": 0, total: list.length,
  };
  for (const capability of list) counts[bucketOf(capability)] += 1;
  return counts;
}

/** Status filter matches either side; search matches the id, the localised name, the Azure service and the fixtures. */
export function filterCapabilities(
  list: readonly Capability[],
  options: {status: Status | "all"; query: string; nameOf: (id: CapabilityId) => string},
): Capability[] {
  const query = options.query.trim().toLocaleLowerCase();
  return list.filter((capability) => {
    if (options.status !== "all" && capability.local.status !== options.status && capability.azure?.status !== options.status) return false;
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
