import {describe,it,expect,vi,afterEach} from 'vitest';
import {etlLanguages,etlText,localEtlSchema} from './local-etl';
import {proxyCase} from './case-proxy';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('local document ETL boundary',()=>{
  it('localizes every label and gives a real PDF exercise without a cloud claim',()=>{
    for(const locale of ['en','de','vi']){const t=etlText(locale);expect(Object.keys(t).sort()).toEqual(Object.keys(etlLanguages.en).sort());expect(t.exampleHint).toContain('51109301');expect(t.exampleHint).toContain('03/07/2023');expect(t.exampleHint).toContain('Gold');}
  });
  it('preserves unknown results instead of fabricating an empty successful Gold run',()=>{
    const value=localEtlSchema.parse({caseId:'C',caseVersion:1,sourceHash:'hash',enabled:false,workerReady:false,cloudCalls:0,runs:[]});
    expect(value.runs).toEqual([]);expect(value.workerReady).toBe(false);
  });
  it('protects every operation and only proxies the three named artifact downloads',async()=>{
    vi.stubEnv('CREDIT_API_URL','http://java:8080');const fetch=vi.fn().mockResolvedValue(Response.json({caseId:'C'}));vi.stubGlobal('fetch',fetch);
    const root='http://localhost:3000/api/cases/C/platform/etl',headers={Authorization:'Bearer test-token'};
    expect((await proxyCase(new Request(root),['C','platform','etl'])).status).toBe(401);
    for(const method of ['GET','POST'])expect((await proxyCase(new Request(root,{method,headers}),['C','platform','etl'])).status).toBe(200);
    const id='etl-12345678-1234-1234-1234-123456789abc';
    for(const layer of ['bronze','silver','gold']){
      const path=['C','platform','etl',id,layer];
      expect((await proxyCase(new Request(root+'/'+id+'/'+layer,{headers}),path)).status).toBe(200);
      expect((await proxyCase(new Request(root+'/'+id+'/'+layer,{method:'POST',headers}),path)).status).toBe(405);
    }
    expect((await proxyCase(new Request(root,{headers}),['C','platform','etl',id,'history'])).status).toBe(404);
  });
});
