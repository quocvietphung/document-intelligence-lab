import {describe,expect,it,vi,afterEach} from 'vitest';
import {datasetIsCurrent,runsForReference,referenceExportLines,referenceFieldSchema,referenceQuestionSchema,researchMetric,researchMetricValue,researchRowNeedsReview,researchText} from './document-research';
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
  it('keeps ranking milliseconds and sample counts separate from percentages',()=>{expect(researchMetricValue('p95Ms',120)).toBe('120.0 ms');expect(researchMetricValue('answerableSamples',32)).toBe('32');expect(researchMetricValue('recallAt5',50)).toBe('50.0%');});
  it('accepts multiple checked pages and preserves unanswered questions without a fake target',()=>{expect(referenceQuestionSchema.safeParse({question:'Compare pages',documentId:'a',page:1,relevant:[{documentId:'a',page:1},{documentId:'b',page:2}],split:'holdout'}).success).toBe(true);expect(referenceQuestionSchema.safeParse({question:'Not stated',documentId:'',page:0,answerable:false,relevant:[]}).success).toBe(true);expect(referenceQuestionSchema.safeParse({question:'Bad target',documentId:'a',page:0}).success).toBe(false);});
  it('localizes the measured retrieval dimensions in every interface',()=>{for(const locale of ['en','de','vi'])for(const key of ['recallAt5','uniquePrecisionAt5','ndcgAt5','holdout','ANSWERABILITY_NOT_EVALUATED'])expect(researchText(locale)(key)).not.toBe(key);});
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

it('flags missing additional pages without treating unanswered questions as retrieval failures',()=>{expect(researchRowNeedsReview({passed:true,recallAt5:50})).toBe(true);expect(researchRowNeedsReview({passed:false,evaluated:false,recallAt5:0})).toBe(false);expect(researchRowNeedsReview({passed:true,recallAt5:100})).toBe(false);});
