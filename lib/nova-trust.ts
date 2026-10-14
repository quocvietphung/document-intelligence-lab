import {z} from 'zod';
export const novaTaskIds=['summary','reconcile','explain','request-documents','review-checklist','terminology','bilingual-summary'] as const;
export const novaTaskSchema=z.enum(novaTaskIds);
export const sourceEvidenceSchema=z.object({id:z.string().max(150),title:z.string().max(300),documentId:z.string().max(80),page:z.number().int().nonnegative(),originalAvailable:z.boolean(),humanReviewed:z.boolean(),kind:z.enum(['DOCUMENT','REFERENCE','FIXTURE','APP_GUIDE','POLICY_OR_CASE']),excerpt:z.string().max(1000)});
export const claimSchema=z.object({text:z.string().max(2000),citations:z.array(z.string().max(150)),invalidCitations:z.array(z.string().max(150)),state:z.enum(['SOURCE_LINKED','REVIEW_REQUIRED'])});
export const trustAnswerSchema=z.object({id:z.string().regex(/^[-a-zA-Z0-9]{1,80}$/),time:z.iso.datetime(),caseVersion:z.number().int().nonnegative(),question:z.string().max(2000),answer:z.string().max(12000),mode:z.string().max(80),profile:z.literal('analysis'),modelId:z.string().max(100).optional(),promptVersion:z.string().max(100),sources:z.array(sourceEvidenceSchema).max(40),claims:z.array(claimSchema).max(30),durationMs:z.number().nonnegative(),revisionOf:z.string().max(80),humanApproved:z.literal(false),verification:z.string()});
const taskSchema=z.object({id:z.string(),title:z.string().max(160),note:z.string().max(500),answerId:z.string().max(80),caseVersion:z.number().int().nonnegative(),state:z.enum(['OPEN','IN_REVIEW','RETURNED','RESOLVED']),assignee:z.string(),assignedToMe:z.boolean().optional(),version:z.number().int().nonnegative(),time:z.iso.datetime(),updatedAt:z.iso.datetime(),history:z.array(z.object({state:z.string(),actor:z.string(),note:z.string(),time:z.iso.datetime()})).max(100)});
const feedbackSchema=z.object({id:z.string(),answerId:z.string(),reason:z.enum(['WRONG_AMOUNT','WRONG_PERSON','UNSUPPORTED_SOURCE','OTHER']),note:z.string(),actor:z.string(),time:z.iso.datetime(),caseVersion:z.number()});
const featureSchema=z.object({id:z.enum(['nova',...novaTaskIds]),owner:z.literal('PLATFORM_ADMIN'),scope:z.literal('case'),modelId:z.string().max(100).optional(),promptVersion:z.string(),inputs:z.array(z.string()),tools:z.array(z.string()),humanReview:z.literal(true),payments:z.literal(false),limits:z.string(),testSuite:z.string(),enabled:z.boolean(),controlVersion:z.number().int().nonnegative()});
export const trustSnapshotSchema=z.object({caseId:z.string(),caseVersion:z.number(),persistent:z.boolean(),canManage:z.boolean(),privacy:z.object({pipeline:z.object({retentionDays:z.number(),storage:z.string(),provider:z.unknown().optional()}).passthrough(),readTriggersInference:z.literal(false),answerRetention:z.literal('case-history-no-automatic-purge'),cloudInputs:z.string(),savedInputs:z.string()}),answers:z.array(trustAnswerSchema).max(60),feedback:z.array(feedbackSchema).max(60),tasks:z.array(taskSchema).max(60),features:z.array(featureSchema),metrics:z.object({answerWindow:z.number(),windowLimit:z.literal(60),feedbackWindow:z.number(),claimCount:z.number(),claimsNeedingReview:z.number(),openTasks:z.number(),resolvedTasks:z.number(),p50Ms:z.number(),p95Ms:z.number(),fieldsChanged:z.number(),fieldsReviewed:z.number(),costAvailable:z.literal(false)}),events:z.array(z.unknown())});
export type TrustSnapshot=z.infer<typeof trustSnapshotSchema>;
export type TrustAnswer=z.infer<typeof trustAnswerSchema>;
export type DraftOptions={revisionOf?:string;feedbackId?:string;taskId?:typeof novaTaskIds[number];caseVersion?:number};
export function citationTarget(id:string,documents:readonly {id:string;pages?:readonly {number:number}[]}[]) {
  const document=documents.find(d=>id.startsWith(d.id+':'));if(!document)return;
  const page=Number(id.match(/:p(\d+)(?::|$)/)?.[1]||document.pages?.[0]?.number||1);
  if(!Number.isSafeInteger(page)||page<1||!document.pages?.some(p=>p.number===page))return;
  return {documentId:document.id,page};
}
export function answerIsStale(answer:TrustAnswer,caseVersion:number){return answer.caseVersion!==caseVersion;}
export function trustProblem(status:number){return status===401?'signIn':status===403?'forbidden':status===409?'stale':status===404?'unavailable':status===429?'limit':'failed';}
export const trustSections=['privacy','library','history','tasks','governance','metrics'] as const;
export type TrustSection=typeof trustSections[number];
export async function requestTrust(token:string|undefined,caseId:string,path='',body?:unknown,signal?:AbortSignal) {
  if(!token)throw new Error('signIn');
  const response=await fetch(`/api/cases/${encodeURIComponent(caseId)}/trust${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(45000)]):AbortSignal.timeout(45000)});
  if(!response.ok)throw new Error(trustProblem(response.status));
  return response.json() as Promise<unknown>;
}
