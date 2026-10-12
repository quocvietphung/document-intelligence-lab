import {z} from "zod";
const record=z.record(z.string(),z.unknown());
const metrics=z.object({precision:z.number(),recall:z.number(),f1:z.number(),truePositive:z.number(),falsePositive:z.number(),falseNegative:z.number()});
export const evaluationSchema=metrics.extend({id:z.string(),createdAt:z.string(),version:z.string(),scope:z.string(),references:z.number(),classification:z.number(),recallAt5:z.number(),injectionQuarantined:z.number(),fields:z.array(metrics.extend({field:z.string()})),rows:z.array(z.object({id:z.string(),scenario:z.string(),typeCorrect:z.boolean(),misses:z.array(z.string()),quarantined:z.boolean(),expected:record,actual:record})),confusion:z.record(z.string(),z.number())});
const hit=z.object({id:z.string(),documentId:z.string(),title:z.string(),page:z.number(),kind:z.string(),text:z.string(),vector:z.number(),lexical:z.number(),score:z.number()});
const step=z.object({agent:z.string(),task:z.string(),tools:z.array(z.string()),state:z.string()});
export const searchSchema=z.object({search:z.object({hits:z.array(hit),chunks:z.number(),backend:z.string(),embedding:z.string(),reranker:z.string(),quarantined:z.array(z.string())}),plan:z.object({specialist:z.string(),steps:z.array(step),blocked:z.boolean(),reason:z.string()}),durationMs:z.number()});
export const platformSchema=z.object({
  persistent:z.boolean(),caseId:z.string(),generatedAt:z.string(),limits:z.string(),architecture:z.string(),
  documentPipeline:z.object({worker:z.boolean(),persistent:z.boolean(),storage:z.string(),scanner:z.string(),retentionDays:z.number(),provider:z.object({mode:z.string(),activeProvider:z.string(),modelId:z.string(),maxPages:z.number()})}),
  jobs:z.array(z.object({id:z.string(),name:z.string(),status:z.string(),stage:z.string(),reviewStatus:z.string().nullable().optional(),document_id:z.string().nullable(),scan_result:z.string().nullable(),error_code:z.string().nullable(),sha256:z.string(),createdAt:z.string(),expiresAt:z.string(),attempt:z.number()})),
  evaluations:z.array(evaluationSchema),
  runs:z.array(z.object({id:z.string(),time:z.string(),mode:z.string(),specialist:z.string(),steps:z.array(step),quality:z.object({validCitations:z.array(z.string()),invalidCitations:z.array(z.string()),lexicalSupport:z.number(),requiresReview:z.boolean(),method:z.string()}),durationMs:z.number(),sources:z.array(z.string())})),
  reviews:z.array(z.object({id:z.string(),alertId:z.string().optional(),note:z.string(),actor:z.string(),time:z.string(),state:z.string(),caseVersion:z.number()})),
  agents:z.array(z.object({name:z.string(),tools:z.array(z.string())})),
  banking:z.object({synthetic:z.literal(true),balanced:z.boolean(),debitCents:z.number(),creditCents:z.number(),adapter:z.string(),ledger:z.array(z.object({id:z.string(),date:z.string(),debit:z.string(),credit:z.string(),amountCents:z.number(),reference:z.string()})),
    alerts:z.array(z.object({id:z.string(),code:z.string(),severity:z.string(),source:z.string(),detail:z.string(),humanReview:z.boolean()})),
    reconciliation:z.array(z.object({documentId:z.string(),field:z.string(),value:z.string(),page:z.number(),transactionIds:z.array(z.string()),state:z.string(),note:z.string()})),
    categories:z.array(z.object({id:z.string(),counterparty:z.string(),amountCents:z.number(),category:z.string(),method:z.string()}))}),
});
export type PlatformData=z.infer<typeof platformSchema>;
export type SearchData=z.infer<typeof searchSchema>;
export type EvaluationData=z.infer<typeof evaluationSchema>;
export type PlatformView="studio"|"pipeline"|"controls"|"operations"|"evaluation";
export function percent(value:number){return `${value.toFixed(1)}%`;}
export function pipelineStage(job:{status:string;stage:string;reviewStatus?:string|null}){return job.status==="COMPLETE"&&job.reviewStatus==="verified"?"reviewComplete":job.stage;}
export function noticeIsVisible(noticeView:PlatformView,view:PlatformView){return noticeView===view;}
