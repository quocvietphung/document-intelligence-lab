import { z } from "zod";
import type { CreditDocument } from "./credit-data";

export type WorkspaceCase = {
  id: string;
  tenantId: string;
  applicant: string;
  coApplicant: string;
  purpose: string;
  amount: string;
  progress: number;
  status: string;
  submittedAt: string;
  documents: CreditDocument[];
  issues: { severity: string; title: string; detail: string; documentId?: string }[];
  audit: string[][];
  version?: number;
  amountEuro?: number;
};
const field = z.object({
  label: z.string(),
  value: z.string(),
  confidence: z.number().min(0).max(100).nullable(),
  page: z.number().int().positive().optional(),
  evidence: z.string().optional(),
});
export const creditCaseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  applicant: z.string(),
  coApplicant: z.string(),
  purpose: z.string(),
  amountEuro: z.number().nonnegative(),
  completeness: z.number().min(0).max(100),
  status: z.string(),
  submittedAt: z.string(),
  missingDocuments: z.array(z.string()),
  validationIssues: z.array(
    z.object({
      code: z.string(),
      severity: z.string(),
      message: z.string(),
      humanReviewRequired: z.boolean(),
    }),
  ),
  documents: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      status: z.enum(["verified", "review", "missing"]),
      confidence: z.number().min(0).max(100).nullable().optional(),
      fields: z.array(field),
      pages: z.array(z.object({ number: z.number().int().positive(), text: z.string(), method: z.string() })).optional(),
      originalAvailable: z.boolean().optional(),
      analysisProvider: z.string().nullable().optional(),
      modelId: z.string().nullable().optional(),
      contentType: z.string().nullable().optional(),
      tables:z.array(z.object({page:z.number(),rows:z.number(),columns:z.number(),cells:z.array(z.object({row:z.number(),column:z.number(),text:z.string()}))})).optional(),
    }),
  ),
  audit: z.array(z.array(z.string()).length(3)),
  version: z.number().int().nonnegative().default(0),
});
export function toWorkspaceCase(value: unknown): WorkspaceCase {
  const item = creditCaseSchema.parse(value);
  return {
    id: item.id,
    version: item.version,
    amountEuro: item.amountEuro,
    tenantId: item.tenantId,
    applicant: item.applicant,
    coApplicant: item.coApplicant,
    purpose: item.purpose,
    amount: new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(item.amountEuro),
    progress: item.completeness,
    status: item.status,
    submittedAt: item.submittedAt,
    documents: item.documents,
    issues: [
      ...item.missingDocuments.map((name) => ({
        severity: "high",
        title: "Missing required document",
        detail: name,
      })),
      ...item.validationIssues.map((issue) => ({
        severity: issue.severity,
        title: issue.code.replaceAll("_", " "),
        detail: item.documents.find(doc=>doc.id===issue.message)?.name||issue.message,
        ...(item.documents.some(doc=>doc.id===issue.message)?{documentId:issue.message}:{}),
      })),
    ],
    audit: item.audit,
  };
}
