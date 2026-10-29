import {documentAI,type AICapabilities,type AIKind} from './ai-capabilities';
import type {CreditDocument} from './credit-data';
import type {WorkspaceTab} from './nova-guide';
import type {TrustSection} from './nova-trust';

export type DashboardTarget={page:WorkspaceTab;panel?:'processing'|'batches'|'assets'}|{trust:TrustSection}|{nova:true};
export const dashboardFeatures=[
  {id:'document',category:'ai',engine:'document',target:{page:'documents'}},
  {id:'tables',category:'ai',engine:'document',target:{page:'documents'}},
  {id:'search',category:'ai',engine:'retrieval',target:{page:'studio'}},
  {id:'nova',category:'ai',engine:'chat',target:{nova:true}},
  {id:'summary',category:'ai',engine:'chat',target:{trust:'library'}},
  {id:'reconcile',category:'ai',engine:'chat',target:{trust:'library'}},
  {id:'explain',category:'ai',engine:'chat',target:{trust:'library'}},
  {id:'request-documents',category:'ai',engine:'chat',target:{trust:'library'}},
  {id:'review-checklist',category:'ai',engine:'chat',target:{trust:'library'}},
  {id:'terminology',category:'ai',engine:'chat',target:{trust:'library'}},
  {id:'bilingual-summary',category:'ai',engine:'chat',target:{trust:'library'}},
  {id:'timeline',category:'ai',engine:'chat',target:{trust:'library'}},
  {id:'obligations',category:'ai',engine:'chat',target:{trust:'library'}},
  {id:'privacy-review',category:'ai',engine:'chat',target:{trust:'library'}},
  {id:'validation',category:'control',engine:'rules',target:{page:'controls'}},
  {id:'quality',category:'control',engine:'rules',target:{page:'evaluation'}},
  {id:'review',category:'control',engine:'human',target:{trust:'tasks'}},
  {id:'transparency',category:'control',engine:'human',target:{trust:'privacy'}},
  {id:'embeddings',category:'ai',engine:'retrieval',target:{page:'studio'}},
  {id:'field-explanation',category:'ai',engine:'chat',target:{page:'documents'}},
  {id:'classification',category:'ai',engine:'classification',target:{page:'experiments'}},
  {id:'field-profiles',category:'control',engine:'rules',target:{page:'pipeline',panel:'batches'}},
  {id:'batches',category:'control',engine:'rules',target:{page:'pipeline',panel:'batches'}},
  {id:'anomaly',category:'ai',engine:'ml',target:{page:'pipeline',panel:'assets'}},
  {id:'lineage',category:'control',engine:'rules',target:{page:'pipeline',panel:'assets'}},
  {id:'experiments',category:'control',engine:'rules',target:{page:'experiments'}},
  {id:'citations',category:'control',engine:'rules',target:{trust:'history'}},
  {id:'feedback',category:'control',engine:'human',target:{trust:'history'}},
  {id:'governance',category:'control',engine:'human',target:{trust:'governance'}},
  {id:'performance',category:'control',engine:'rules',target:{trust:'metrics'}},
  {id:'app-guide',category:'control',engine:'guide',target:{nova:true}},
  {id:'injection-guard',category:'control',engine:'rules',target:{page:'studio'}},
] as const satisfies readonly {id:string;category:'ai'|'control';engine:string;target:DashboardTarget}[];
export type DashboardFeature=typeof dashboardFeatures[number];
export const dashboardGroups=[
  {id:'documentTools',features:['document','tables','classification','field-explanation']},
  {id:'retrievalTools',features:['search','embeddings','injection-guard']},
  {id:'novaTools',features:['nova','summary','reconcile','explain','request-documents','review-checklist','terminology','bilingual-summary','timeline','obligations','privacy-review','app-guide']},
  {id:'pipelineTools',features:['field-profiles','batches','lineage','anomaly']},
  {id:'researchTools',features:['quality','experiments']},
  {id:'reviewTools',features:['validation','review','transparency','citations','feedback','governance','performance']},
] as const satisfies readonly {id:string;features:readonly DashboardFeature['id'][]}[];
export type DashboardFilter='all'|'ai'|'control';
export function dashboardEngine(feature:DashboardFeature,capabilities:AICapabilities|undefined,demo:boolean):{kind:AIKind;provider:string;model:string;configured:boolean}{
  if(demo)return {kind:'demo',provider:'demo',model:'',configured:false};
  if(feature.engine==='classification')return {kind:'unknown',provider:'scikit-learn · optional local CPU',model:'TF-IDF + Logistic Regression · PDF benchmark; operational types still use Java rules',configured:false};
  if(feature.engine==='ml')return {kind:'unknown',provider:'scikit-learn · optional local CPU',model:'Isolation Forest · held-out cohort evaluation',configured:false};
  if(feature.engine==='rules')return {kind:'rules',provider:'Java · rules',model:feature.id==='quality'?'uploaded PDF evidence':'',configured:false};
  if(feature.engine==='human')return {kind:'context',provider:'human',model:'',configured:false};
  if(feature.engine==='guide')return {kind:'context',provider:'Browser · app guidance',model:'',configured:false};
  if(!capabilities)return {kind:'unknown',provider:'unknown',model:'',configured:false};
  if(feature.engine==='document'){
    const doc=capabilities.documents;
    const engine=documentAI({analysisProvider:doc.configured?doc.provider:undefined,modelId:doc.modelId,status:'review'},'en');
    return {kind:engine.kind,provider:engine.engine,model:engine.model,configured:doc.configured};
  }
  if(feature.engine==='retrieval')return {kind:capabilities.retrieval.semantic?'ai':'rules',provider:capabilities.retrieval.vectorStore,model:capabilities.retrieval.embeddingModel,configured:capabilities.retrieval.semantic};
  const chat=capabilities.chat;
  return {kind:chat.configured?'ai':'unknown',provider:chat.provider==='ollama'?'Ollama · Local LLM':chat.provider==='azure-openai'?'Azure OpenAI':'unknown',model:chat.modelId,configured:chat.configured};
}
export function dashboardStats(documents:readonly CreditDocument[],capabilities?:AICapabilities,demo=false){
  const originals=documents.filter(d=>d.originalAvailable&&d.status!=='missing');
  return {aiWorkflows:dashboardFeatures.filter(f=>f.category==='ai').length,
    configuredEngines:demo?0:capabilities?Number(capabilities.documents.configured&&['azure-document-intelligence','docling','paddleocr'].includes(capabilities.documents.provider))+Number(capabilities.chat.configured&&['azure-openai','ollama'].includes(capabilities.chat.provider))+Number(capabilities.retrieval.semantic):null,
    azureDocuments:originals.filter(d=>d.analysisProvider==='azure-document-intelligence').length,
    pendingReview:originals.filter(d=>d.status==='review').length};
}
const normalize=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
export function filteredDashboardFeatures(filter:DashboardFilter,query:string,copy:Record<DashboardFeature['id'],readonly [string,string]>,capabilities?:AICapabilities,demo=false){
  const terms=normalize(query).split(/\s+/).filter(Boolean);
  return dashboardFeatures.filter(f=>(filter==='all'||f.category===filter)&&terms.every(term=>normalize([f.id,...copy[f.id],dashboardEngine(f,capabilities,demo).provider].join(' ')).includes(term)));
}
