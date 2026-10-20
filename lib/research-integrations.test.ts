import {describe,it,expect,vi,afterEach} from 'vitest';
import {integrationIds,integrationLanguage,connectionsSchema,sourceListSchema,visionResultSchema} from './research-integrations';
import {proxyCase} from './case-proxy';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('optional integration contracts',()=>{
  it('requires honest config-only status, bounded input and unapproved vision',()=>{
    const data={caseId:'C',automaticCalls:false,exports:[],integrations:integrationIds.map(id=>({id,configured:false,verification:'NOT_LIVE_TESTED',provider:id,action:'explicit'}))};
    expect(connectionsSchema.parse(data).integrations).toHaveLength(9);
    expect(connectionsSchema.safeParse({...data,automaticCalls:true}).success).toBe(false);
    expect(sourceListSchema.safeParse({items:[],prefix:'other/',limit:20,automaticIngestion:false}).success).toBe(false);
    expect(visionResultSchema.safeParse({answer:'Observation',humanApproved:true}).success).toBe(false);
    for(const text of Object.values(integrationLanguage))expect(Object.keys(text).sort()).toEqual(Object.keys(integrationLanguage.en).sort());
  });
  it('protects every named integration route and blocks arbitrary operations',async()=>{
    vi.stubEnv('CREDIT_API_URL','http://java:8080');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({})));
    const headers={Authorization:'Bearer synthetic-test-token'};
    for(const name of ['sources','import','evaluation-export','vision']){
      const path=['C','platform','integrations',name],url='http://localhost:3000/api/cases/'+path.join('/');
      expect((await proxyCase(new Request(url,{headers,method:'POST',body:'{}'}),path)).status).toBe(200);
      expect((await proxyCase(new Request(url,{headers}),path)).status).toBe(405);
      expect((await proxyCase(new Request(url,{method:'POST',body:'{}'}),path)).status).toBe(401);
    }
    expect((await proxyCase(new Request('http://localhost:3000',{headers,method:'POST'}),['C','platform','integrations','delete'])).status).toBe(404);
  });
});
