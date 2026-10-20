import {createElement,Fragment} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {resultDocumentGroups,filterResultDocuments} from './document-results';
import {sortPipelineJobs,pipelinePanelFromSearch,pipelinePanelPath,type PipelineJob} from './document-pipeline';
import {CollectionToolbar} from '@/components/workspace/CollectionToolbar';
import {DocumentPipeline} from '@/components/workspace/DocumentPipeline';
import type {CreditDocument} from './credit-data';
import type {PlatformData} from './platform';

const doc:CreditDocument={id:'doc-1',name:'Lương-đã-kiểm-tra.pdf',type:'income',status:'review',originalAvailable:true,fields:[{label:'netIncome',value:'2.967,11 EUR',confidence:95}]};
const job:PipelineJob={id:'j1',name:'invoice-2.pdf',status:'COMPLETE',stage:'HUMAN_REVIEW',document_id:'doc-1',sha256:'a'.repeat(64),createdAt:'2026-10-18T10:00:00Z',expiresAt:'2030-01-01T00:00:00Z',attempt:1,error_code:null,scan_result:'CLAMAV_CLEAN',reviewStatus:'review'};
describe('enterprise document collections',()=>{
  it('keeps latest, missing and historical evidence separate before filtering',()=>{
    const older={...doc,id:'older',status:'verified' as const},missing={...doc,id:'missing',name:'missing.pdf',status:'missing' as const};
    const original=Object.freeze([doc,older,missing]),group=resultDocumentGroups(original);
    expect(group).toEqual({latest:[doc],history:[older],missing:[missing]});
    expect(filterResultDocuments(group.latest,'','verified')).toEqual([]);
    expect(original).toEqual([doc,older,missing]);expect(group.history[0].fields?.[0].value).toBe('2.967,11 EUR');
  });
  it('searches filenames and types without accents and preserves source values',()=>{
    expect(filterResultDocuments([doc],'luong da kiem tra','review')).toEqual([doc]);
    expect(filterResultDocuments([doc],'income','all')).toEqual([doc]);
    expect(filterResultDocuments([doc],'not found','all')).toEqual([]);
    expect(filterResultDocuments([doc],'','verified')).toEqual([]);
    expect(doc.fields?.[0].value).toBe('2.967,11 EUR');
  });
  it('sorts queue copies by time or natural filename, with unknown times last',()=>{
    const older={...job,id:'j2',name:'invoice-10.pdf',createdAt:'2026-10-17T10:00:00Z'},unknown={...job,id:'unknown',createdAt:'invalid'};
    const input=Object.freeze([older,unknown,job]);
    expect(sortPipelineJobs(input,'newest').map(row=>row.id)).toEqual(['j1','j2','unknown']);
    expect(sortPipelineJobs(input,'oldest').map(row=>row.id)).toEqual(['j2','j1','unknown']);
    expect(sortPipelineJobs([older,job],'name').map(row=>row.id)).toEqual(['j1','j2']);
    expect(input[0]).toBe(older);expect(input[1]).toBe(unknown);
  });
  it('keeps the chosen pipeline panel, dossier and locale in a reloadable URL',()=>{
    const href='http://localhost:3000/vi?case=CR-1&section=pipeline#pipeline';
    expect(pipelinePanelPath(href,'batches')).toBe('/vi?case=CR-1&section=pipeline&pipeline=batches#pipeline');
    expect(pipelinePanelFromSearch('?case=CR-1&pipeline=batches')).toBe('batches');
    expect(pipelinePanelFromSearch('?pipeline=assets')).toBe('assets');
    expect(pipelinePanelFromSearch('?pipeline=unknown')).toBe('processing');
    expect(pipelinePanelFromSearch('')).toBe('processing');
    const source=readFileSync('components/workspace/PlatformWorkbench.tsx','utf8');
    expect(source).toContain("window.history.pushState(null,'',next)");expect(source).toContain("window.addEventListener('popstate',sync)");
  });
  it('shares accessible collection controls with unique labels and explicit reset',()=>{
    const reset=vi.fn(),props={locale:'en',label:'Documents',query:'invoice',searchLabel:'Search documents',onQuery:()=>{},filter:'all',filters:[{value:'all',label:'All results'}],onFilter:()=>{},shown:1,total:2,active:true,reset};
    const html=renderToStaticMarkup(createElement(Fragment,null,createElement(CollectionToolbar,props),createElement(CollectionToolbar,{...props,label:'Queue'})));
    const ids=[...html.matchAll(/ id="([^"]+)"/g)].map(match=>match[1]);
    expect(new Set(ids).size).toBe(ids.length);expect(ids).toHaveLength(4);
    for(const id of ids)expect(html).toContain(`for="${id}"`);
    expect(html.match(/role="search"/g)).toHaveLength(2);expect(html).toContain('aria-live="polite"');expect(html).toContain('Reset filters');
    expect(reset).not.toHaveBeenCalled();
  });
  it('renders a semantic queue table with source-specific actions and no automatic writes',()=>{
    const inspect=vi.fn(),retry=vi.fn(),cancel=vi.fn();
    const data={caseId:'C',jobs:[job],persistent:true,documentPipeline:{worker:true}} as PlatformData;
    const html=renderToStaticMarkup(createElement(DocumentPipeline,{data,locale:'en',busy:false,canWrite:true,inspect,retry,cancel}));
    expect(html).toContain('<table class="pipeline-queue-table">');expect(html).toContain('scope="col"');expect(html).toContain('scope="row"');
    expect(html).toContain('Open result &amp; PDF · invoice-2.pdf');expect(html).toContain('Processing details · invoice-2.pdf');
    expect(html).toContain('Processing stages');expect(html).not.toContain('100%');
    expect(html).not.toContain('<span>Status</span><select');
    expect(html).toContain('Cancelled');expect(html).toContain('Expired');
    expect(inspect).not.toHaveBeenCalled();expect(retry).not.toHaveBeenCalled();expect(cancel).not.toHaveBeenCalled();
    const queued={...data,jobs:[{...job,status:'QUEUED',document_id:null}]};
    expect(renderToStaticMarkup(createElement(DocumentPipeline,{data:queued,locale:'en',busy:false,canWrite:false,inspect,retry,cancel}))).not.toMatch(/<button[^>]*aria-label="Open result &amp; PDF/);
  });
  it('keeps advanced panels collapsed but makes trace evidence visible during a tour',()=>{
    const source=readFileSync('components/workspace/PlatformWorkbench.tsx','utf8');
    expect(source).toContain('<details className="surface workspace-technical-panel">');
    expect(source).toContain('open={guiding||undefined}');
    expect(source).toContain('guiding={guiding}');
  });
});
