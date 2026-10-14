import {z} from "zod";

export const researchSuites=["DOCUMENTS","RETRIEVAL","SAFETY","NUMERIC"] as const;
export type ResearchSuite=typeof researchSuites[number];
const row=z.object({id:z.string(),scenario:z.string(),passed:z.boolean(),expected:z.unknown(),actual:z.unknown(),error:z.string()});
const variant=z.object({method:z.string(),engine:z.string(),metrics:z.record(z.string(),z.number().finite().min(0).max(100)),rows:z.array(row),samples:z.number().int().nonnegative(),passed:z.number().int().nonnegative(),durationMs:z.number().nonnegative()});
export const researchRunSchema=z.object({id:z.string(),time:z.iso.datetime(),suite:z.enum(researchSuites),version:z.string(),datasetVersion:z.string(),datasetHash:z.string(),implementationHash:z.string(),caseId:z.string(),caseVersion:z.number(),configuration:z.record(z.string(),z.unknown()),variants:z.array(variant),durationMs:z.number().nonnegative(),azureCalls:z.literal(0),costStatus:z.string(),scope:z.string()});
export const researchCatalogSchema=z.object({version:z.string(),datasetHash:z.string(),references:z.number(),persistent:z.boolean(),configuration:z.record(z.string(),z.unknown()),runs:z.array(researchRunSchema),azureCalls:z.literal(0)});
export type ResearchRun=z.infer<typeof researchRunSchema>;
export type ResearchCatalog=z.infer<typeof researchCatalogSchema>;
export function researchExport(run:ResearchRun){return JSON.stringify({format:"credit-intelligence-research-v1",...run},null,2);}
export function researchFailureCount(run:ResearchRun){return run.variants.reduce((n,v)=>n+v.rows.filter(r=>!r.passed).length,0);}
