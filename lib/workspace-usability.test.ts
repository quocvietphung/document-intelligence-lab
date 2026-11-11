import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import type {CreditDocument} from './credit-data';
import type {DocumentJob} from './document-results';
import {workspaceTabs,workspaceTarget} from './nova-guide';
import {catalogGroupOf,documentTypeLabel,featureFromSearch,fill,overviewTasks,profileOptions,recentDocuments,trustAnswerFromSearch,trustHref,trustSectionFromSearch,usabilityLanguages} from './workspace-usability';
import {DocumentResults} from '@/components/workspace/DocumentResults';
import {CaseReportButton} from '@/components/workspace/CaseOutputs';
import {WorkspaceAIOverview} from '@/components/workspace/WorkspaceAIOverview';

const review:CreditDocument={id:'doc-review',name:'eingangsrechnung-musterquartier.pdf',type:'invoice',status:'review',originalAvailable:true,analysisProvider:'docling',modelId:'docling-layout-tableformer',confidence:null,fields:[{label:'invoiceNumber',value:'RE-2026-014',confidence:null}],pages:[{number:1,text:'Rechnung',method:'docling'}]} as CreditDocument;
const verified:CreditDocument={...review,id:'doc-verified',name:'bauvertrag-musterquartier.pdf',status:'verified'};
const job=(id:string,status:string,name=review.name):DocumentJob=>({id,name,status,stage:status==='FAILED'?'ANALYSIS':'HUMAN_REVIEW',document_id:null,scan_result:'CLEAN',error_code:status==='FAILED'?'ANALYSIS_HTTP_503':null,sha256:'',createdAt:'2026-11-11T09:00:00Z',expiresAt:'2030-01-01T00:00:00Z',attempt:1} as DocumentJob);

describe('workspace usability copy',()=>{
  it('has every new string in English, German and Vietnamese',()=>{
    for(const language of Object.values(usabilityLanguages)){
      expect(Object.keys(language).sort()).toEqual(Object.keys(usabilityLanguages.en).sort());
      expect(Object.values(language).every(value=>value.trim().length>0)).toBe(true);
    }
    expect(fill(usabilityLanguages.vi.openPage,{page:'Nguồn & tích hợp'})).toBe('Mở Nguồn & tích hợp');
  });
  it('shows translated extraction profile names but sends the technical value',()=>{
    for(const locale of ['en','de','vi']){
      const options=profileOptions(locale);
      expect(options.map(option=>option.value)).toEqual(['general','invoice','payroll','insurance-wording']);
      expect(options.every(option=>option.label!==option.value)).toBe(true);
    }
    expect(profileOptions('vi').find(option=>option.value==='invoice')?.label).toBe('Hóa đơn');
    expect(profileOptions('de').find(option=>option.value==='invoice')?.label).toBe('Rechnung');
  });
});

describe('links into the reorganised workspace',()=>{
  it('keeps every existing page hash working',()=>{
    for(const tab of workspaceTabs)expect(workspaceTarget(`#${tab}`)).toBe(tab);
    for(const old of ['#studio','#experiments','#banking','#evaluation','#integrations','#audit'])expect(workspaceTarget(old)).toBe(old.slice(1));
  });
  it('opens AI transparency at the requested section and answer, and ignores unsafe values',()=>{
    expect(trustSectionFromSearch('?case=CR-1&trust=history')).toBe('history');
    expect(trustSectionFromSearch('?trust=javascript:alert(1)')).toBeUndefined();
    expect(trustAnswerFromSearch('?answer=ans-42')).toBe('ans-42');
    expect(trustAnswerFromSearch('?answer=<script>')).toBeUndefined();
    expect(trustHref('http://localhost:3000/vi?case=CR-1#documents','history','ans-42')).toBe('/vi?case=CR-1&trust=history&answer=ans-42#trust');
    expect(trustHref('http://localhost:3000/vi?case=CR-1&trust=history&answer=ans-42#trust','tasks')).toBe('/vi?case=CR-1&trust=tasks#trust');
  });
  it('opens the catalog group that holds a deep-linked feature',()=>{
    expect(featureFromSearch('?feature=classification')).toBe('classification');
    expect(catalogGroupOf('classification')).toBe('documentTools');
    expect(featureFromSearch('?feature=unknown')).toBeUndefined();
  });
});

describe('task page priorities',()=>{
  it('lists failed processing and documents awaiting review before anything else',()=>{
    const {failed,review:waiting}=overviewTasks([review,verified],[job('j-failed','FAILED','broken.pdf'),job('j-ok','COMPLETE')]);
    expect(failed.map(item=>item.name)).toEqual(['broken.pdf']);
    expect(waiting.map(item=>item.id)).toEqual(['doc-review']);
    expect(recentDocuments([review,{...verified,status:'missing'}],[]).map(item=>item.id)).toEqual(['doc-review']);
  });
  it('renders work for a person first, then recent documents, entry points and the collapsed catalog',()=>{
    const html=renderToStaticMarkup(createElement(WorkspaceAIOverview,{locale:'vi',demo:false,documentMode:'docling',navigate:()=>{},openNova:()=>{},documents:[review,verified],caseId:'CR-1'}));
    const order=['overview-attention','overview-recent','data-page-tour="overview-ai"','ai-directory'].map(marker=>html.indexOf(marker));
    expect(order.every(index=>index>=0)).toBe(true);expect([...order].sort((a,b)=>a-b)).toEqual(order);
    expect(html).toContain('Kiểm duyệt ngay');expect(html).toContain('Hỏi tài liệu');expect(html).toContain('Đánh giá chất lượng');
    expect(html).toContain('id="ai-directory-groups" hidden=""');
    expect(renderToStaticMarkup(createElement(WorkspaceAIOverview,{locale:'en',demo:false,navigate:()=>{},openNova:()=>{}}))).toContain('Nothing waits for you');
  });
  it('counts dossier checks, failed files and reviews together, like the menu badge',()=>{
    const html=renderToStaticMarkup(createElement(WorkspaceAIOverview,{locale:'en',demo:false,navigate:()=>{},openNova:()=>{},documents:[review],issueCount:3}));
    expect(html).toContain('Needs attention <span>4</span>');expect(html).not.toContain('Nothing waits for you');
    const workspace=readFileSync('components/workspace/CreditWorkspace.tsx','utf8');
    expect(workspace).toContain("id==='overview'?item.issues.length+reviewCount");
    // Catalogue actions name the page they open.
    expect(html).toContain('Open AI transparency');
  });
  it('names document types for people',()=>{
    expect(documentTypeLabel('invoice','vi')).not.toBe('invoice');
    expect(documentTypeLabel('income','de')).toBe('Einkommensnachweis');
    expect(documentTypeLabel('Gutachten','en')).toBe('Gutachten');
    expect(documentTypeLabel(undefined,'en')).toBe('—');
  });
});

describe('document list and outputs',()=>{
  const render=(draft?:(doc:CreditDocument)=>void)=>renderToStaticMarkup(createElement(DocumentResults,{documents:[review,verified],jobs:[],locale:'vi',loading:false,error:false,refresh:()=>{},open:()=>{},ask:()=>{},choose:()=>{},technical:()=>{},draft}));
  it('scans as a table of name, type, review status and one primary action',()=>{
    const html=render();
    expect(html).toContain('<table class="document-table">');
    for(const heading of ['Tài liệu','Loại','Trạng thái kiểm duyệt'])expect(html).toContain(`<th scope="col">${heading}</th>`);
    expect(html).toContain('eingangsrechnung-musterquartier.pdf');expect(html).toContain('data-tone="warning"');expect(html).toContain('data-tone="success"');
    expect(html).toContain('>Kiểm duyệt</button>');expect(html).toContain('Thao tác khác');
  });
  it('keeps provider and model details inside the row menu instead of on every row',()=>{
    const html=render(),firstRow=html.slice(html.indexOf('id="document-result-doc-review"'),html.indexOf('row-menu-panel'));
    expect(firstRow).not.toContain('docling-layout-tableformer');expect(firstRow).toContain('AI');
    expect(html.slice(html.indexOf('row-menu-panel'))).toContain('Công nghệ đang dùng');
  });
  it('offers a Gmail draft only for documents a person confirmed',()=>{
    const html=render(()=>{});
    const reviewRow=html.slice(html.indexOf('id="document-result-doc-review"'),html.indexOf('id="document-result-doc-verified"'));
    expect(reviewRow).not.toContain('Tạo bản nháp Gmail');
    expect(html.slice(html.indexOf('id="document-result-doc-verified"'))).toContain('Tạo bản nháp Gmail');
  });
  it('enables the report only after a reviewed document with fields exists',()=>{
    const before=renderToStaticMarkup(createElement(CaseReportButton,{caseId:'CR-1',locale:'en',documents:[review]}));
    expect(before).toContain('disabled=""');expect(before).toContain('Review and confirm a document');
    const after=renderToStaticMarkup(createElement(CaseReportButton,{caseId:'CR-1',locale:'en',documents:[review,verified]}));
    expect(after).not.toContain('disabled=""');expect(after).toContain('Only confirmed fields');
  });
});

describe('each feature has one primary place',()=>{
  const source=(name:string)=>readFileSync(`components/workspace/${name}.tsx`,'utf8');
  it('keeps Sources & integrations to sources, permissions and the import flow',()=>{
    const integrations=source('IntegrationsWorkbench');
    for(const moved of ['/use-cases/','/project-assessment','/destinations/report','gmail-draft/preview'])expect(integrations).not.toContain(moved);
    expect(source('UseCaseLibrary')).toContain('/use-cases/');
    expect(source('ProjectAssessmentPanel')).toContain('/project-assessment');
    expect(source('CaseOutputs')).toContain('/destinations/report');expect(source('CaseOutputs')).toContain('gmail-draft/preview');
  });
  it('mounts the moved tools on their new pages and has a single transparency page',()=>{
    const workspace=source('CreditWorkspace');
    expect(workspace).toContain("tab==='evaluation'?<UseCaseLibrary");
    expect(workspace).toContain('<ProjectAssessmentPanel');
    expect(workspace).not.toContain('trustOpen');
    expect(workspace).toContain("navigate('trust',trustHref(");
  });
});
