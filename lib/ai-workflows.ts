import {z} from 'zod';
import {dashboardFeatures,dashboardGroups,type DashboardFeature} from './ai-dashboard';
import type {AICapabilities} from './ai-capabilities';
import type {CreditDocument} from './credit-data';
import {activeDocumentJob,latestDocumentJobs,type DocumentJob} from './document-results';
import type {WorkspaceTab} from './nova-guide';
import type {TrustSection} from './nova-trust';

/**
 * End-to-end workflow for every AI feature in the catalog, with its state in the selected dossier.
 * A step is only "done" when a record of this dossier proves it; anything the app does not record stays the user's step.
 */
export const workflowSteps=['documentEngine','languageModel','semanticIndex','addDocuments','processing','reviewFields','resolveFindings','tables','fieldPages','askStudio','askNova','checkClaims','reviewTask','closeTasks','reportError','use'] as const;
export type WorkflowStep=typeof workflowSteps[number];
/** Set up by an operator, not in the dossier. When missing, the workflow cannot run here. */
export const environmentSteps=['documentEngine','languageModel','semanticIndex'] as const satisfies readonly WorkflowStep[];
/** Never recorded completely by the app, so they stay the user's step unless a record shows otherwise. */
export const userSteps=['use','reportError'] as const satisfies readonly WorkflowStep[];

const template=['languageModel','addDocuments','processing','reviewFields','use'] as const;
export const workflowPlans={
  document:['documentEngine','addDocuments','processing','reviewFields'],
  tables:['documentEngine','addDocuments','processing','tables','reviewFields'],
  classification:['use'],
  'field-explanation':['languageModel','addDocuments','processing','fieldPages','use'],
  search:['addDocuments','processing','askStudio'],
  embeddings:['semanticIndex','addDocuments','processing','askStudio'],
  'injection-guard':['addDocuments','processing','askStudio','use'],
  nova:['languageModel','addDocuments','processing','askNova','checkClaims'],
  summary:template,reconcile:template,explain:template,'request-documents':template,'review-checklist':template,
  terminology:template,'bilingual-summary':template,timeline:template,obligations:template,'privacy-review':template,
  'app-guide':['use'],
  'field-profiles':['documentEngine','addDocuments','processing','use'],
  batches:['documentEngine','addDocuments','processing','use'],
  lineage:['addDocuments','processing','reviewFields','use'],
  anomaly:['addDocuments','processing','reviewFields','use'],
  quality:['addDocuments','processing','use'],
  experiments:['addDocuments','processing','use'],
  validation:['addDocuments','processing','resolveFindings'],
  'dossier-reconciliation':['addDocuments','processing','reviewFields','use'],
  review:['askNova','reviewTask','closeTasks'],
  transparency:['use'],
  citations:['askNova','checkClaims'],
  feedback:['askNova','reportError'],
  governance:['use'],
  performance:['askNova','use'],
} as const satisfies Record<DashboardFeature['id'],readonly WorkflowStep[]>;
export type WorkflowFeature=keyof typeof workflowPlans;
/** Features whose last step is used directly in the app; each has its own how-to text. */
export type UseFeature={[K in WorkflowFeature]:'use' extends (typeof workflowPlans)[K][number]?K:never}[WorkflowFeature];
export const useFeatures=dashboardFeatures.map(feature=>feature.id).filter((id):id is UseFeature=>(workflowPlans[id] as readonly WorkflowStep[]).includes('use'));

/** What the task page knows about the dossier. Undefined means "not known here", which never counts as done. */
export type WorkflowFacts={
  demo:boolean;
  originals:number;verified:number;awaiting:number;active:number;failed:number;
  tables:boolean;fieldPages:boolean;issues:number;
  documentEngine?:boolean;languageModel?:boolean;semanticIndex?:boolean;
  searches?:number;
  answers?:number;claimsNeedingReview?:number;feedback?:number;tasks?:number;openTasks?:number;
};
export type TrustFacts=Pick<WorkflowFacts,'answers'|'claimsNeedingReview'|'feedback'|'tasks'|'openTasks'>;

export function workflowFacts({documents,jobs,capabilities,demo,issueCount,searches,trust}:{
  documents:readonly CreditDocument[];jobs:readonly DocumentJob[];capabilities?:AICapabilities;demo:boolean;issueCount:number;searches?:number;trust?:TrustFacts;
}):WorkflowFacts{
  const present=documents.filter(doc=>doc.status!=='missing'),originals=present.filter(doc=>doc.originalAvailable),latest=latestDocumentJobs(jobs);
  return {
    demo,
    originals:originals.length,
    verified:originals.filter(doc=>doc.status==='verified').length,
    awaiting:originals.filter(doc=>doc.status==='review').length,
    active:latest.filter(activeDocumentJob).length,
    failed:latest.filter(job=>job.status==='FAILED'||job.status==='EXPIRED').length,
    tables:present.some(doc=>(doc.tables?.length??0)>0),
    fieldPages:present.some(doc=>doc.fields?.some(field=>typeof field.page==='number')??false),
    issues:issueCount,
    documentEngine:capabilities?.documents.configured,
    languageModel:capabilities?.chat.configured,
    semanticIndex:capabilities?.retrieval.semantic,
    searches,
    ...trust,
  };
}

/** Reads only the counts the task page needs from the AI transparency snapshot of this dossier. */
const trustCounts=z.object({
  caseId:z.string(),
  answers:z.array(z.unknown()),
  feedback:z.array(z.unknown()),
  tasks:z.array(z.object({state:z.string()}).passthrough()),
  metrics:z.object({claimsNeedingReview:z.number().int().nonnegative()}).passthrough(),
});
export function trustWorkflowFacts(value:unknown,caseId:string):TrustFacts|undefined{
  const parsed=trustCounts.safeParse(value);
  if(!parsed.success||parsed.data.caseId!==caseId)return undefined;
  const {answers,feedback,tasks,metrics}=parsed.data;
  return {answers:answers.length,claimsNeedingReview:metrics.claimsNeedingReview,feedback:feedback.length,tasks:tasks.length,openTasks:tasks.filter(task=>task.state!=='RESOLVED').length};
}

export type StepState='done'|'todo'|'blocked'|'unknown'|'user';
const counted=(value:number|undefined,done:(count:number)=>boolean):StepState=>value===undefined?'unknown':done(value)?'done':'todo';
const configured=(value:boolean|undefined):StepState=>value===undefined?'unknown':value?'done':'blocked';
export function stepState(step:WorkflowStep,facts:WorkflowFacts):StepState{
  switch(step){
    case 'documentEngine':return configured(facts.documentEngine);
    case 'languageModel':return configured(facts.languageModel);
    case 'semanticIndex':return configured(facts.semanticIndex);
    case 'addDocuments':return facts.originals>0?'done':'todo';
    // A failed file does not hold back the documents that did finish; it stays under "Needs attention" and in the step detail.
    case 'processing':return facts.originals>0&&facts.active===0?'done':'todo';
    case 'reviewFields':return facts.verified>0&&facts.awaiting===0?'done':'todo';
    case 'resolveFindings':return facts.issues===0?'done':'todo';
    case 'tables':return facts.tables?'done':'todo';
    case 'fieldPages':return facts.fieldPages?'done':'todo';
    case 'askStudio':return counted(facts.searches,count=>count>0);
    case 'askNova':return counted(facts.answers,count=>count>0);
    case 'checkClaims':return facts.answers===undefined||facts.claimsNeedingReview===undefined?'unknown':facts.answers>0&&facts.claimsNeedingReview===0?'done':'todo';
    case 'reviewTask':return counted(facts.tasks,count=>count>0);
    case 'closeTasks':return facts.tasks===undefined||facts.openTasks===undefined?'unknown':facts.tasks>0&&facts.openTasks===0?'done':'todo';
    case 'reportError':return (facts.feedback??0)>0?'done':'user';
    case 'use':return 'user';
  }
}

/** done: every step is recorded; ready: only the user's own step is left; todo: a step must come first; blocked: an operator must enable something. */
export type WorkflowStatus='done'|'ready'|'todo'|'blocked'|'demo';
export type Workflow={id:WorkflowFeature;status:WorkflowStatus;steps:{step:WorkflowStep;state:StepState}[];next?:WorkflowStep;done:number;total:number};
export function workflowFor(id:WorkflowFeature,facts:WorkflowFacts):Workflow{
  const steps=(workflowPlans[id] as readonly WorkflowStep[]).map(step=>({step,state:stepState(step,facts)}));
  const done=steps.filter(item=>item.state==='done').length,total=steps.length;
  if(facts.demo)return {id,status:'demo',steps,done,total};
  const blocked=steps.find(item=>item.state==='blocked'),todo=steps.find(item=>item.state==='todo'),open=steps.find(item=>item.state==='unknown'||item.state==='user');
  const next=blocked??todo??open;
  return {id,status:blocked?'blocked':todo?'todo':open?'ready':'done',steps,next:next?.step,done,total};
}
export function workflowList(facts:WorkflowFacts){return dashboardFeatures.map(feature=>workflowFor(feature.id,facts));}

/** Counts per status, plus the missing step that holds back the most workflows (ties: the earlier step in the process). */
export function workflowSummary(list:readonly Workflow[]){
  const count=(status:WorkflowStatus)=>list.filter(item=>item.status===status).length;
  const waiting=new Map<Exclude<WorkflowStep,'use'>,number>();
  for(const item of list)if(item.status==='todo'&&item.next&&item.next!=='use')waiting.set(item.next,(waiting.get(item.next)??0)+1);
  const [step,workflows]=[...waiting].sort((a,b)=>b[1]-a[1]||workflowSteps.indexOf(a[0])-workflowSteps.indexOf(b[0]))[0]??[];
  return {done:count('done'),ready:count('ready'),todo:count('todo'),blocked:count('blocked'),demo:count('demo'),total:list.length,unlock:step&&workflows?{step,workflows}:undefined};
}
export function workflowGroups(list:readonly Workflow[]){
  return dashboardGroups.map(group=>({id:group.id,workflows:group.features.map(id=>list.find(item=>item.id===id)).filter((item):item is Workflow=>Boolean(item))}));
}

/** Where a step is done in the app. The feature's own step opens the catalog target of that feature. */
export type WorkflowAction={kind:'intake'}|{kind:'review'}|{kind:'nova'}|{kind:'page';page:WorkspaceTab;panel?:'processing'|'batches'|'assets'}|{kind:'trust';section:TrustSection};
const stepActions:Record<Exclude<WorkflowStep,'use'>,WorkflowAction>={
  documentEngine:{kind:'page',page:'operations'},
  languageModel:{kind:'page',page:'operations'},
  semanticIndex:{kind:'page',page:'operations'},
  addDocuments:{kind:'intake'},
  processing:{kind:'page',page:'pipeline',panel:'processing'},
  reviewFields:{kind:'review'},
  resolveFindings:{kind:'page',page:'controls'},
  tables:{kind:'page',page:'documents'},
  fieldPages:{kind:'page',page:'documents'},
  askStudio:{kind:'page',page:'studio'},
  askNova:{kind:'nova'},
  checkClaims:{kind:'trust',section:'history'},
  reviewTask:{kind:'trust',section:'history'},
  closeTasks:{kind:'trust',section:'tasks'},
  reportError:{kind:'trust',section:'history'},
};
export function stepAction(step:Exclude<WorkflowStep,'use'>):WorkflowAction{return stepActions[step];}
export function workflowAction(id:WorkflowFeature,step:WorkflowStep):WorkflowAction{
  if(step!=='use')return stepActions[step];
  const target=dashboardFeatures.find(feature=>feature.id===id)!.target;
  if('nova' in target)return {kind:'nova'};
  if('trust' in target)return {kind:'trust',section:target.trust};
  return 'panel' in target?{kind:'page',page:target.page,panel:target.panel}:{kind:'page',page:target.page};
}
