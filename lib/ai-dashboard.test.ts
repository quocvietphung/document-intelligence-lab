import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {dashboardFeatures,dashboardStats,dashboardEngine,filteredDashboardFeatures} from './ai-dashboard';
import {dashboardLanguages,dashboardText} from './ai-dashboard-language';
import {WorkspaceAICatalog,AIDashboardStats} from '@/components/workspace/WorkspaceAICatalog';
import {workspaceTabs} from './nova-guide';
import {trustSections} from './nova-trust';
import type {AICapabilities} from './ai-capabilities';
import type {CreditDocument} from './credit-data';

const capabilities:AICapabilities={scope:'configuration-only',automaticInference:false,chat:{provider:'azure-openai',configured:true,modelId:'actual-lab-deployment'},documents:{provider:'azure-document-intelligence',configured:true,modelId:'prebuilt-layout',mode:'azure'},retrieval:{semantic:true,vectorStore:'Qdrant',embeddingModel:'ONNX MiniLM',ranking:'BM25 + cosine',languageCoverage:'English-focused'}};
const document=(id:string,change:Partial<CreditDocument>={}):CreditDocument=>({id,name:'example.pdf',type:'income',status:'review',...change});
describe('AI dashboard directory',()=>{
  it('provides distinct current destinations without payment actions',()=>{
    expect(dashboardFeatures).toHaveLength(15);expect(new Set(dashboardFeatures.map(f=>f.id)).size).toBe(15);
    for(const feature of dashboardFeatures){const target=feature.target;if('page' in target)expect(workspaceTabs).toContain(target.page);if('trust' in target)expect(trustSections).toContain(target.trust);}
    expect(JSON.stringify(dashboardFeatures)).not.toMatch(/payment|approve-credit/);
  });
  it('counts only real original-backed Azure results in this case',()=>{
    const docs=[document('azure',{originalAvailable:true,analysisProvider:'azure-document-intelligence'}),document('reference',{analysisProvider:'azure-document-intelligence'}),document('local',{originalAvailable:true,analysisProvider:'local-pdfbox-tesseract',status:'verified'}),document('missing',{originalAvailable:true,analysisProvider:'azure-document-intelligence',status:'missing'})];
    expect(dashboardStats(docs,capabilities)).toEqual({aiWorkflows:11,configuredEngines:3,azureDocuments:1,pendingReview:1});
    expect(dashboardStats([],undefined).configuredEngines).toBeNull();
    expect(dashboardStats([],capabilities,true).configuredEngines).toBe(0);
  });
  it('does not treat unavailable configuration as a working AI service',()=>{
    const unavailable={...capabilities,chat:{...capabilities.chat,configured:false},documents:{...capabilities.documents,configured:false},retrieval:{...capabilities.retrieval,semantic:false}};
    expect(dashboardStats([],unavailable).configuredEngines).toBe(0);
    expect(dashboardEngine(dashboardFeatures[0],unavailable,false).kind).toBe('unknown');
    expect(dashboardEngine(dashboardFeatures[3],unavailable,false).configured).toBe(false);
  });
  it('labels local extraction, rule evaluation and human review honestly',()=>{
    const local={...capabilities,documents:{provider:'local-pdfbox-tesseract',modelId:'rules-v1',configured:true,mode:'local'}};
    expect(dashboardEngine(dashboardFeatures[0],local,false).kind).toBe('rules');
    expect(dashboardEngine(dashboardFeatures.find(f=>f.id==='quality')!,capabilities,false).kind).toBe('rules');
    expect(dashboardEngine(dashboardFeatures.find(f=>f.id==='review')!,capabilities,false).kind).toBe('context');
  });
  it('filters by workflow class and accent-insensitive text or engine',()=>{
    const copy=dashboardText('vi').features;
    expect(filteredDashboardFeatures('ai','',copy)).toHaveLength(11);
    expect(filteredDashboardFeatures('control','',copy)).toHaveLength(4);
    expect(filteredDashboardFeatures('all','tom tat',copy).map(f=>f.id)).toEqual(['summary','bilingual-summary']);
    expect(filteredDashboardFeatures('all','Qdrant',copy,capabilities).map(f=>f.id)).toEqual(['search']);
    expect(filteredDashboardFeatures('all','not-existing',copy)).toEqual([]);
  });
  it('has complete labels and descriptions in EN, DE and VI',()=>{
    for(const table of Object.values(dashboardLanguages)){
      expect(Object.keys(table.labels).sort()).toEqual(Object.keys(dashboardLanguages.en.labels).sort());
      expect(Object.keys(table.features).sort()).toEqual(dashboardFeatures.map(f=>f.id).sort());
      expect(Object.values(table.features).flat().every(v=>v.trim().length>0)).toBe(true);
    }
  });
  it('renders real feature links and actual deployment metadata',()=>{
    const html=renderToStaticMarkup(createElement(WorkspaceAICatalog,{locale:'en',demo:false,capabilities,navigate:()=>{},openNova:()=>{},openTrust:()=>{}}));
    expect(html).toContain('href="#documents"');expect(html).toContain('href="#studio"');expect(html).toContain('href="#evaluation"');expect(html).toContain('actual-lab-deployment');expect(html).toContain('Configured, not live-verified');
    expect(html).not.toContain('100%');expect(html).not.toContain('href="http');
  });
  it('keeps demo controls honest and never calls inference while rendering',()=>{
    const html=renderToStaticMarkup(createElement(WorkspaceAICatalog,{locale:'en',demo:true,capabilities,navigate:()=>{},openNova:()=>{}}));
    expect(html).toContain('Demo · no model calls');expect(html).not.toContain('actual-lab-deployment');expect(html).toContain('disabled');
    const stats=renderToStaticMarkup(createElement(AIDashboardStats,{locale:'en',demo:false}));expect(stats).toContain('—');expect(stats).toContain('Catalogue count');
  });
});
