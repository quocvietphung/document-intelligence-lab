import {afterEach,describe,expect,it,vi} from 'vitest';
import {citationTarget,trustAnswerSchema,requestTrust,trustProblem,novaTaskIds,novaTaskSchema} from './nova-trust';
import {trustText} from './nova-trust-language';
import {uniqueTextRegion} from './pdf-evidence';
import {proxyCase} from './case-proxy';
import {conversationSchema} from './credit-chat';

afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('Nova trust boundaries',()=>{
  it('allows all seven controlled task IDs in both task and chat schemas',()=>{
    expect(novaTaskIds).toHaveLength(7);
    for(const taskId of novaTaskIds){expect(novaTaskSchema.safeParse(taskId).success).toBe(true);expect(conversationSchema.safeParse({caseId:'C',locale:'vi',taskId,messages:[{id:'m',role:'user',parts:[{type:'text',text:'Check evidence'}]}]}).success).toBe(true);}
    expect(novaTaskSchema.safeParse('payment')).toBeDefined();expect(novaTaskSchema.safeParse('payment').success).toBe(false);
  });
  it('opens only an existing page in the selected document',()=>{
    const docs=[{id:'doc-A',pages:[{number:2}]}];
    expect(citationTarget('doc-A:p2:fields',docs)).toEqual({documentId:'doc-A',page:2});
    for(const id of ['doc-A:p1','doc-B:p2','doc-A-other:p2','doc-A:p99999999999999999999'])expect(citationTarget(id,docs)).toBeUndefined();
  });
  it('requires a unique exact horizontal PDF text match',()=>{
    const item={str:'2.967,11',transform:[1,0,0,1,12,20],width:45,height:10};
    expect(uniqueTextRegion([item],'2.967,11 EUR',box=>box)).toEqual({left:12,top:20,width:45,height:10});
    expect(uniqueTextRegion([item,item],'2.967,11',box=>box)).toBeUndefined();
    expect(uniqueTextRegion([item],'2967',box=>box)).toBeUndefined();
    expect(uniqueTextRegion([{...item,transform:[0,1,1,0,12,20]}],'2.967,11',box=>box)).toBeUndefined();
    expect(uniqueTextRegion([{...item,width:NaN}],'2.967,11',box=>box)).toBeUndefined();
  });
  it('accepts safe immutable answer metadata but rejects automatic approval',()=>{
    const answer={id:'answer-1',time:'2026-10-13T10:00:00Z',caseVersion:2,question:'Question',answer:'Answer',mode:'azure-entra',modelId:'gpt-4.1-mini',profile:'analysis',promptVersion:'v2',sources:[],claims:[],durationMs:100,revisionOf:'',humanApproved:false,verification:'citation existence only'};
    expect(trustAnswerSchema.safeParse(answer).success).toBe(true);
    expect(trustAnswerSchema.safeParse({...answer,humanApproved:true}).success).toBe(false);
    expect(trustAnswerSchema.safeParse({...answer,question:'x'.repeat(2001)}).success).toBe(false);
  });
  it('keeps unknown feature/task IDs out of chat requests',()=>{
    const base={caseId:'C',locale:'en',messages:[{id:'m',role:'user',parts:[{type:'text',text:'Question'}]}]};
    expect(conversationSchema.safeParse({...base,taskId:'summary',caseVersion:0}).success).toBe(true);
    expect(conversationSchema.safeParse({...base,taskId:'payment'}).success).toBe(false);
    expect(conversationSchema.safeParse({...base,caseVersion:-1}).success).toBe(false);
  });
  it('reads metadata with authentication and never submits a draft automatically',async()=>{
    const fetcher=vi.fn().mockResolvedValue(Response.json({caseId:'C'}));vi.stubGlobal('fetch',fetcher);
    await expect(requestTrust(undefined,'C')).rejects.toThrow('signIn');expect(fetcher).not.toHaveBeenCalled();
    await requestTrust('synthetic-token','C');
    expect(fetcher).toHaveBeenCalledWith('/api/cases/C/trust',expect.objectContaining({method:'GET',body:undefined,cache:'no-store'}));
  });
  it('maps conflicts and permissions to safe actionable errors',()=>{
    expect(trustProblem(409)).toBe('stale');expect(trustProblem(403)).toBe('forbidden');expect(trustProblem(429)).toBe('limit');
  });
  it('only proxies named trust endpoints with the intended method',async()=>{
    vi.stubEnv('CREDIT_API_URL','http://java:8080');const fetcher=vi.fn().mockResolvedValue(Response.json({ok:true}));vi.stubGlobal('fetch',fetcher);
    const headers={Authorization:'Bearer synthetic-token'};
    for(const suffix of [[],['feedback'],['correction'],['prompt'],['tasks'],['tasks','task-1'],['features']]){
      const path=['C','trust',...suffix],method=suffix.length?'POST':'GET';
      expect((await proxyCase(new Request('http://localhost:3000/api/cases/'+path.join('/'),{method,headers,...(method==='POST'?{body:'{}'}:{})}),path)).status).toBe(200);
    }
    expect((await proxyCase(new Request('http://localhost:3000/api/cases/C/trust/tasks',{headers}),['C','trust','tasks'])).status).toBe(405);
    expect((await proxyCase(new Request('http://localhost:3000/api/cases/C/trust/payments',{headers,method:'POST'}),['C','trust','payments'])).status).toBe(404);
    expect(fetcher).toHaveBeenCalledTimes(7);
  });
  it('provides the same trust labels and limits in all three languages',()=>{
    const en=trustText('en');for(const locale of ['de','vi']){
      expect(Object.keys(trustText(locale))).toEqual(Object.keys(en));
      expect(Object.values(trustText(locale)).every(text=>text.trim().length>0)).toBe(true);
    }
  });
});
