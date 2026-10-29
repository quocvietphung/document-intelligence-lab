import {describe,it,expect,vi,afterEach} from 'vitest';
import {analyticsLanguages,analyticsText,analyticsSchema,findingText} from './document-analytics';
import {proxyCase} from './case-proxy';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('source-bound document analytics',()=>{
  it('localizes the controls and provides PDF-backed exercises with an explicit insufficient-data state',()=>{
    for(const locale of ['en','de','vi']){const text=analyticsText(locale);expect(Object.keys(text).sort()).toEqual(Object.keys(analyticsLanguages.en).sort());expect(text.pdfHint).toContain('51109301');expect(text.pdfHint).toContain('DATEV');expect(text.insufficient).toBeTruthy();expect(findingText('STATISTICAL_OUTLIER',locale)).not.toBe('STATISTICAL_OUTLIER');}
  });
  it('represents an absent experiment as absent, rather than zero-error model success',()=>{
    const parsed=analyticsSchema.parse({caseId:'C',caseVersion:1,sourceHash:'hash',enabled:false,workerReady:false,cloudCalls:0,report:null,experiments:[],reviews:[]});
    expect(parsed.report).toBeNull();expect(parsed.experiments).toEqual([]);
  });
  it('protects analytics, review and scoped exports and rejects other file paths/methods',async()=>{
    vi.stubEnv('CREDIT_API_URL','http://java:8080');const upstream=vi.fn().mockResolvedValue(Response.json({}));vi.stubGlobal('fetch',upstream);
    const root='http://localhost/api/cases/C/platform',headers={Authorization:'Bearer test-token'};
    expect((await proxyCase(new Request(root+'/analytics'),['C','platform','analytics'])).status).toBe(401);
    for(const method of ['GET','POST'])expect((await proxyCase(new Request(root+'/analytics',{method,headers}),['C','platform','analytics'])).status).toBe(200);
    expect((await proxyCase(new Request(root+'/analytics/reviews',{headers}),['C','platform','analytics','reviews'])).status).toBe(405);
    expect((await proxyCase(new Request(root+'/analytics/reviews',{headers,method:'POST'}),['C','platform','analytics','reviews'])).status).toBe(200);
    for(const layer of ['document-facts','field-observations','invoice-lines','quality-findings'])expect((await proxyCase(new Request(root,{headers}),['C','platform','etl','etl-12345678-1234-1234-1234-123456789abc',layer])).status).toBe(200);
    expect((await proxyCase(new Request(root,{headers}),['C','platform','analytics','models','all'])).status).toBe(404);
  });
});
