import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {filterPipelineJobs,pipelineCopies,pipelineManifest,pipelineSteps,pipelineSummary,type PipelineJob} from './document-pipeline';
import {canRetryDocumentJob,type PlatformData} from './platform';
import {kaggleReferences} from './research-samples';
import hashes from '@/services/credit-api/src/main/resources/kaggle-reference-hashes.json';
import {DocumentPipeline} from '@/components/workspace/DocumentPipeline';

const job:PipelineJob={id:'job-current',name:kaggleReferences[4].file,sha256:kaggleReferences[4].sha256,status:'COMPLETE',stage:'HUMAN_REVIEW',reviewStatus:'review',document_id:'doc-1',scan_result:'CLAMAV_CLEAN',error_code:null,createdAt:'2026-10-17T10:00:00Z',expiresAt:'2030-01-01T00:00:00Z',attempt:1,events:[]};
describe('document processing control room',()=>{
  it('pins the Java retry registry to the exact eight Kaggle file hashes',()=>{
    expect(Object.keys(hashes)).toHaveLength(8);
    for(const sample of kaggleReferences){expect(hashes[sample.file as keyof typeof hashes]).toBe(sample.sha256);expect(canRetryDocumentJob({...job,name:sample.file,sha256:sample.sha256,status:'FAILED',error_code:'ANALYSIS_HTTP_503'})).toBe(true);}
    expect(canRetryDocumentJob({...job,status:'FAILED',error_code:'MALWARE_BLOCKED'})).toBe(false);
    expect(canRetryDocumentJob({...job,status:'FAILED',error_code:'SOURCE_INTEGRITY_FAILED'})).toBe(false);
  });
  it('counts the latest file outcome, not every historical failure as current',()=>{
    const older={...job,id:'old',status:'FAILED',createdAt:'2026-10-16T10:00:00Z'};
    expect(pipelineSummary([older,job])).toMatchObject({review:1,failed:0,verified:0,active:0});
    expect(filterPipelineJobs([older,job],'failed','')).toHaveLength(0);
    expect(filterPipelineJobs([older,job],'failed','',true)).toHaveLength(1);
    expect(filterPipelineJobs([job],'review','51109301')).toHaveLength(1);
    expect(filterPipelineJobs([job],'verified','')).toHaveLength(0);
    expect(filterPipelineJobs([{...job,status:'CANCELLED'}],'cancelled','')).toHaveLength(1);
  });
  it('never invents a stage timeline for jobs from before the migration',()=>{
    expect(pipelineSteps(job).filter(s=>s.state==='done')).toHaveLength(0);
    expect(pipelineSteps(job).at(-1)?.state).toBe('current');
    const events=['RECEIVED','SCAN','EXTRACT','VALIDATE'].map((stage,id)=>({id,stage,status:'PROCESSING',attempt:1,errorCode:null,time:job.createdAt}));
    expect(pipelineSteps({...job,status:'FAILED',stage:'STOPPED',events}).find(s=>s.stage==='VALIDATE')?.state).toBe('failed');
    expect(pipelineSteps({...job,events}).filter(s=>s.state==='done')).toHaveLength(4);
  });
  it('exports metadata without original bytes, text, credentials or internal object paths',()=>{
    const enriched={...job,object_key:'private-object',accessToken:'secret',text:'private-source'};
    const manifest=pipelineManifest('case-1',enriched,'2026-10-17T10:00:00Z'),json=JSON.stringify(manifest);
    expect(manifest.source.sha256).toBe(job.sha256);expect(manifest.safety.includesExtractedText).toBe(false);
    for(const secret of ['private-object','secret','private-source'])expect(json).not.toContain(secret);
    expect(manifest.limitations.join(' ')).toContain('on demand');
  });
  it('has matching complete labels in English, German and Vietnamese',()=>{
    for(const copy of Object.values(pipelineCopies)){expect(Object.keys(copy).sort()).toEqual(Object.keys(pipelineCopies.en).sort());expect(Object.values(copy).every(v=>v.length>0)).toBe(true);}
  });
  it('renders measured counts, search, history and safe direct-result actions',()=>{
    const data={caseId:'case-1',jobs:[job],persistent:true,documentPipeline:{worker:true}} as PlatformData;
    const html=renderToStaticMarkup(createElement(DocumentPipeline,{data,locale:'en',busy:false,canWrite:true,inspect:()=>{},retry:()=>{},cancel:async()=>{}}));
    expect(html).toContain('Processing control room');expect(html).toContain('Open result &amp; PDF');expect(html).toContain('Search filename');
    expect(html).not.toContain('100%');expect(html).not.toContain('Cancel waiting job');
  });
  it('keeps polling cancellable and retains same-case data on transient refresh errors',()=>{
    const source=readFileSync('components/workspace/PlatformWorkbench.tsx','utf8');
    expect(source).toContain('controller.abort()');expect(source).toContain('snapshot?.caseId===caseId');expect(source).toContain('previous?.caseId===caseId');
  });
});
