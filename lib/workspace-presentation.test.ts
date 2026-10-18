import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {workspaceNavigation,workspaceSection,workspaceSubpages,workspacePresentation,workspacePresentationLanguages} from './workspace-presentation';
import {workspaceTabs} from './nova-guide';
import {DocumentBatchReceipt} from '@/components/workspace/DocumentBatches';
import {AIPageBanner} from '@/components/workspace/AITransparency';
import type {DocumentBatch} from './document-batches';

const receipt:DocumentBatch={id:'batch-1',name:'Invoice sources',source:'Pinned public source',profile:'invoice',time:'2026-10-18T10:00:00Z',state:'SUBMITTED',items:[{name:'invoice.pdf',sha256:'original-hash',size:100,state:'ACCEPTED',status:'COMPLETE',documentId:'D1'}],manifestHash:'manifest',persistent:true};
describe('compact workspace presentation',()=>{
  it('groups ten stable routes into seven primary destinations without orphan pages',()=>{
    const primary=workspaceNavigation.flatMap(group=>[...group.pages]);
    expect(primary).toHaveLength(7);expect(new Set(primary).size).toBe(7);
    for(const page of workspaceTabs){
      expect(primary).toContain(workspaceSection(page));
      const children=workspaceSubpages(page);
      if(children.length)expect(children).toContain(page);
    }
    expect(workspaceSection('banking')).toBe('experiments');expect(workspaceSection('evaluation')).toBe('experiments');
    expect(workspaceSection('audit')).toBe('operations');expect(workspaceSubpages('documents')).toEqual([]);
  });
  it('keeps the reference library expandable and automatically visible for a page tour',()=>{
    const source=readFileSync('components/workspace/DocumentAnalysisWorkspace.tsx','utf8');
    expect(source).toContain('className="document-reference-library" open={guiding||undefined}');
    expect(source).toContain('library.current.open=true');expect(source).toContain('focusResults()');
    const workspace=readFileSync('components/workspace/CreditWorkspace.tsx','utf8');
    expect(workspace).toContain("guiding={guide?.page==='documents'}");
    expect(workspace).not.toContain('document.getElementById("datev-library")?.scrollIntoView');
  });
  it('keeps all compact labels complete in English, German and Vietnamese',()=>{
    for(const language of Object.values(workspacePresentationLanguages)){
      expect(Object.keys(language).sort()).toEqual(Object.keys(workspacePresentationLanguages.en).sort());
      expect(Object.values(language).every(value=>value.trim())).toBe(true);
    }
    expect(workspacePresentation('unknown')).toBe(workspacePresentationLanguages.en);
  });
  it('retains result actions and source evidence while collapsing metadata by default',()=>{
    const inspect=vi.fn(),download=vi.fn();
    for(const locale of ['en','de','vi']){
      const html=renderToStaticMarkup(createElement(DocumentBatchReceipt,{batch:receipt,locale,inspect,download}));
      expect(html).toContain('<h3>Invoice sources</h3>');expect(html).toContain('original-hash');
      expect(html).toContain('Pinned public source');expect(html).toContain('batch-1');
      expect(html).toContain('class="batch-receipt-metadata"');expect(html).not.toMatch(/<details[^>]*\sopen[=> ]/);
      expect(html.match(/<button/g)).toHaveLength(2);
    }
    expect(inspect).not.toHaveBeenCalled();expect(download).not.toHaveBeenCalled();
  });
  it('leaves errors and required field warnings outside collapsed metadata',()=>{
    const failed={...receipt,state:'INTERRUPTED',items:[{...receipt.items[0],status:'FAILED',errorCode:'ANALYSIS_HTTP_503',profileMismatch:true,missingFields:['total']}]};
    const html=renderToStaticMarkup(createElement(DocumentBatchReceipt,{batch:failed,locale:'en',inspect:()=>{},download:()=>{}}));
    expect(html).toContain('Intake interrupted');expect(html).toContain('Missing expected fields');
    expect(html).toContain('<p class="notice-error"><code>ANALYSIS_HTTP_503</code></p>');
    expect(html).not.toContain('Open result &amp; PDF');
  });
  it('shows the AI provider immediately but leaves technical explanations expandable',()=>{
    const html=renderToStaticMarkup(createElement(AIPageBanner,{page:'documents',locale:'en',ask:()=>{},capabilities:{scope:'configuration-only',automaticInference:false,chat:{provider:'azure-openai',modelId:'actual-model',configured:true},documents:{provider:'azure-document-intelligence',modelId:'prebuilt-layout',mode:'azure',configured:true},retrieval:{semantic:false,vectorStore:'Qdrant',embeddingModel:'ONNX',ranking:'BM25',languageCoverage:'English-focused'}}}));
    expect(html.startsWith('<details')).toBe(true);expect(html).not.toContain(' open=');
    expect(html.split('</summary>')[0]).toContain('Azure Document Intelligence');
    expect(html).toContain('prebuilt-layout');expect(html).toContain('not a live health check');
  });
  it('uses a single page title with accessible dossier tools and the same page tour',()=>{
    const source=readFileSync('components/workspace/CreditWorkspace.tsx','utf8');
    expect(source.match(/<h1[ >]/g)).toHaveLength(1);
    expect(source).not.toContain('workspace-hero');expect(source).not.toContain('className="trust-entry"');
    expect(source).toContain('<details className="workspace-case-context"');
    for(const target of ['case-select','case-search','case-new'])expect(source).toContain(`data-page-tour="${target}"`);
    const nova=readFileSync('components/workspace/NovaChatSurface.tsx','utf8');
    expect(source).not.toContain('data-page-tour="page-guide-button"');expect(nova).toContain('data-page-tour="page-guide-button"');
    expect(source).toContain("if(tab==='overview')setCasePicker(true)");
    expect(source).toContain('guiding={guide?.page===tab}');
    expect(readFileSync('components/workspace/PlatformWorkbench.tsx','utf8')).toContain("panel=guiding?'processing'");
  });
  it('does not present a completed duplicate as a processing error',()=>{
    const batch={...receipt,items:[{...receipt.items[0],state:'DUPLICATE',errorCode:'DUPLICATE'}]};
    const html=renderToStaticMarkup(createElement(DocumentBatchReceipt,{batch,locale:'en',inspect:()=>{},download:()=>{}}));
    expect(html).toContain('Duplicate — not submitted again');expect(html).not.toContain('notice-error');
  });
});
