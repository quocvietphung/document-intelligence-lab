import {afterEach,describe,expect,it,vi} from 'vitest';
import {classificationSchema,classificationReportSchema,classificationCsv} from './document-classification';
import {readFileSync} from 'node:fs';
import {classificationLanguages,classificationText,documentClassName} from './document-classification-language';
import {proxyCase} from './case-proxy';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('PDF classification benchmark boundaries',()=>{
  it('localizes all controls and clearly distinguishes synthetic evidence and uncalibrated scores',()=>{
    for(const locale of ['en','de','vi']){const t=classificationText(locale);expect(Object.keys(t).sort()).toEqual(Object.keys(classificationLanguages.en).sort());expect(t.scope).toContain('66');expect(t.scope).toContain('Zurich');expect(t.gate).toBeTruthy();expect(documentClassName('invoice',locale)).toBeTruthy();expect(documentClassName(null,locale)).toBe(t.unassigned);}
  });
  it('does not fabricate a completed evaluation when no experiment exists',()=>{
    const value=classificationSchema.parse({caseId:'case',caseVersion:1,datasetFingerprint:'hash',workerReady:false,dataset:{version:'v1',provenance:'fictional',license:'MIT',splitUnit:'template-family',splits:{train:36,test:12},samples:[]},runs:[]});expect(value.runs).toEqual([]);expect(value.workerReady).toBe(false);
  });
  it('preserves measured parameters, source groups and model provenance in report exports',()=>{
    const raw=JSON.parse(readFileSync(new URL('../docs/benchmarks/insurance-classification.json',import.meta.url),'utf8'));
    const report=classificationReportSchema.parse(raw);
    expect(report.parameters).toEqual(raw.parameters);expect(report.groupSplits).toEqual(raw.groupSplits);
    expect(report.modelSha256).toBe(raw.modelSha256);expect(report.operationalApproval).toBe(false);
    expect(report.groupSplits.test).toHaveLength(4);
    const csv=classificationCsv(report);expect(csv.split('\r\n')[0]).toContain('split,group');
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(report.rows.length+1);
  });
  it('requires a token and only forwards the declared benchmark routes and methods',async()=>{
    vi.stubEnv('CREDIT_API_URL','http://java:8080');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({})));
    const root='http://localhost/api/cases/C/platform/classification',headers={Authorization:'Bearer test-token'};
    expect((await proxyCase(new Request(root),['C','platform','classification'])).status).toBe(401);
    for(const route of [[],['input'],['documents','bench-0001']]){const path=['C','platform','classification',...route];expect((await proxyCase(new Request(root,{headers}),path)).status).toBe(200);if(route.length)expect((await proxyCase(new Request(root,{headers,method:'POST'}),path)).status).toBe(405);}
    expect((await proxyCase(new Request(root,{headers,method:'POST'}),['C','platform','classification'])).status).toBe(200);
    expect((await proxyCase(new Request(root,{headers}),['C','platform','classification','documents','secret'])).status).toBe(404);
  });
});
