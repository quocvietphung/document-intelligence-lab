import type {AICapabilities,AIKind} from './ai-capabilities';
import type {CreditDocument} from './credit-data';
import type {WorkspaceTab} from './nova-guide';
import type {TrustSection} from './nova-trust';

export type DashboardTarget={page:WorkspaceTab}|{trust:TrustSection}|{nova:true};
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
  {id:'validation',category:'control',engine:'rules',target:{page:'controls'}},
  {id:'quality',category:'control',engine:'rules',target:{page:'evaluation'}},
  {id:'review',category:'control',engine:'human',target:{trust:'tasks'}},
  {id:'transparency',category:'control',engine:'human',target:{trust:'privacy'}},
] as const satisfies readonly {id:string;category:'ai'|'control';engine:string;target:DashboardTarget}[];
export type DashboardFeature=typeof dashboardFeatures[number];
export type DashboardFilter='all'|'ai'|'control';
export function dashboardEngine(feature:DashboardFeature,capabilities:AICapabilities|undefined,demo:boolean):{kind:AIKind;provider:string;model:string;configured:boolean}{
  if(demo)return {kind:'demo',provider:'demo',model:'',configured:false};
  if(feature.engine==='rules')return {kind:'rules',provider:'Java · rules',model:feature.id==='quality'?'uploaded PDF evidence':'',configured:false};
  if(feature.engine==='human')return {kind:'context',provider:'human',model:'',configured:false};
  if(!capabilities)return {kind:'unknown',provider:'unknown',model:'',configured:false};
  if(feature.engine==='document'){
    const doc=capabilities.documents;
    return {kind:doc.configured&&doc.provider==='azure-document-intelligence'?'ai':doc.configured&&doc.provider.startsWith('local')?'rules':'unknown',provider:doc.provider==='azure-document-intelligence'?'Azure Document Intelligence':doc.provider.startsWith('local')?'PDFBox · Tesseract OCR':'unknown',model:doc.modelId,configured:doc.configured};
  }
  if(feature.engine==='retrieval')return {kind:capabilities.retrieval.semantic?'ai':'rules',provider:capabilities.retrieval.vectorStore,model:capabilities.retrieval.embeddingModel,configured:capabilities.retrieval.semantic};
  const chat=capabilities.chat;
  return {kind:chat.configured?'ai':'unknown',provider:chat.provider==='azure-openai'?'Azure OpenAI':'unknown',model:chat.modelId,configured:chat.configured};
}
export function dashboardStats(documents:readonly CreditDocument[],capabilities?:AICapabilities,demo=false){
  const originals=documents.filter(d=>d.originalAvailable&&d.status!=='missing');
  return {aiWorkflows:dashboardFeatures.filter(f=>f.category==='ai').length,
    configuredEngines:demo?0:capabilities?Number(capabilities.documents.configured&&capabilities.documents.provider==='azure-document-intelligence')+Number(capabilities.chat.configured&&capabilities.chat.provider==='azure-openai')+Number(capabilities.retrieval.semantic):null,
    azureDocuments:originals.filter(d=>d.analysisProvider==='azure-document-intelligence').length,
    pendingReview:originals.filter(d=>d.status==='review').length};
}
const normalize=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
export function filteredDashboardFeatures(filter:DashboardFilter,query:string,copy:Record<DashboardFeature['id'],readonly [string,string]>,capabilities?:AICapabilities,demo=false){
  const terms=normalize(query).split(/\s+/).filter(Boolean);
  return dashboardFeatures.filter(f=>(filter==='all'||f.category===filter)&&terms.every(term=>normalize([f.id,...copy[f.id],dashboardEngine(f,capabilities,demo).provider].join(' ')).includes(term)));
}
