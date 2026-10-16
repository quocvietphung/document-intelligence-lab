import {describe,expect,it,vi,afterEach} from 'vitest';
import {datasetIsCurrent,runsForReference,referenceExportLines,referenceFieldSchema,researchMetric,researchText} from './document-research';
import {proxyCase} from './case-proxy';
import {workspaceText} from './workspace-language';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('source-bound document experiments',()=>{
  it('localizes reference and table labels rather than leaking English into other interfaces',()=>{
    expect(researchText('en')('tables')).toBe('tables');
    expect(researchText('de')('tables')).toBe('Tabellen');
    expect(researchText('vi')('tables')).toBe('bảng');
    expect(researchText('en')('labelFlow')).toBe('PDF → checked labels');
    expect(researchText('de')('labelFlow')).toBe('PDF → geprüfte Labels');
    expect(researchText('vi')('labelFlow')).toBe('PDF → nhãn đã kiểm tra');
    expect(researchText('de')('pipeline')).toBe('Datenpipelines');
    expect(researchText('vi')('pipeline')).toBe('Luồng dữ liệu');
    expect(researchText('vi')('experiments')).toBe('Thí nghiệm AI');
  });
  it('never renders missing metrics as a zero or success score',()=>{expect(researchMetric(null)).toBe('—');expect(researchMetric(undefined)).toBe('—');expect(researchMetric(0)).toBe('0.0%');});
  it('blocks a reference after the source changes',()=>{expect(datasetIsCurrent({sourceHash:'old'},'new')).toBe(false);expect(datasetIsCurrent(undefined,'new')).toBe(false);});
  it('keeps results scoped to the selected reference version rather than mixing historical tests',()=>{const runs=[{id:'new',datasetId:'v2'},{id:'old',datasetId:'v1'},{id:'older',datasetId:'v2'}];expect(runsForReference(runs,'v2').map(r=>r.id)).toEqual(['new','older']);expect(runsForReference(runs,undefined)).toEqual([]);});
  it('rejects empty labels and invalid source pages',()=>{expect(referenceFieldSchema.safeParse({documentId:'doc',page:0,field:'netIncome',expected:'1'}).success).toBe(false);expect(referenceFieldSchema.safeParse({documentId:'doc',page:1,field:'netIncome',expected:' '}).success).toBe(false);});
  it('exports JSONL without fabricating answers or evaluator scores',()=>{expect(referenceExportLines({evaluationInputs:[{query:'What is net income?',context:'Net: 100 EUR'}]})).toBe('{"query":"What is net income?","context":"Net: 100 EUR"}');expect(referenceExportLines({})).toBe('');});
  it('localizes new navigation and marks local vs unconnected Azure capabilities',()=>{for(const locale of ['en','de','vi']){expect(workspaceText(locale)('experiments')).not.toBe('experiments');expect(workspaceText(locale)('groupResearch')).not.toBe('groupResearch');expect(researchText(locale)('notJudge')).toContain('0');expect(researchText(locale)('exportNote')).toContain('Foundry');}});
  it('limits the proxy to named research methods, preserving Bearer authentication',async()=>{
    vi.stubEnv('CREDIT_API_URL','http://java:8080');const fetch=vi.fn().mockResolvedValue(Response.json({caseId:'C'}));vi.stubGlobal('fetch',fetch);
    const headers={Authorization:'Bearer test-token'};
    for(const route of ['datasets','runs','export']) {
      expect((await proxyCase(new Request('http://localhost:3000/api/cases/C/platform/research/'+route,{headers}),['C','platform','research',route])).status).toBe(405);
      expect((await proxyCase(new Request('http://localhost:3000/api/cases/C/platform/research/'+route,{method:'POST',headers,body:'{}'}),['C','platform','research',route])).status).toBe(200);
    }
    expect((await proxyCase(new Request('http://localhost:3000/api/cases/C/platform/research',{headers}),['C','platform','research'])).status).toBe(200);
    expect((await proxyCase(new Request('http://localhost:3000/api/cases/C/platform/research'),['C','platform','research'])).status).toBe(401);
    expect((await proxyCase(new Request('http://localhost:3000/api/cases/C/platform/research/admin',{headers}),['C','platform','research','admin'])).status).toBe(404);
  });
});
