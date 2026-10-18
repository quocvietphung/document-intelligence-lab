import {describe,it,expect,vi,afterEach} from 'vitest';
import {batchLanguages,batchListSchema,batchItemState,validateBatchFiles} from './document-batches';
import {proxyCase} from './case-proxy';
describe('document batch intake',()=>{
  afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
  it('bounds files without silently treating TXT as Azure-supported',()=>{
    const pdf={name:'source.pdf',size:100};
    expect(validateBatchFiles([])).toBe('count');expect(validateBatchFiles(Array(5).fill(pdf))).toBe('count');
    expect(validateBatchFiles([pdf,{name:'large.pdf',size:3_000_001}])).toBe('files');
    expect(validateBatchFiles([{name:'source.txt',size:100}])).toBe('files');
    expect(validateBatchFiles([{name:'source.txt',size:100}],false)).toBeUndefined();
    expect(validateBatchFiles([pdf])).toBeUndefined();
  });
  it('keeps cloud ingestion disconnected and review distinct from extraction',()=>{
    expect(batchListSchema.parse({batches:[],adfConnected:false,cloudIngestionConnected:false}).batches).toEqual([]);
    expect(batchListSchema.safeParse({batches:[],adfConnected:true,cloudIngestionConnected:true}).success).toBe(false);
    const item={name:'source.pdf',sha256:'hash',size:100,state:'ACCEPTED',jobId:'job',status:'COMPLETE'};
    expect(batchItemState(item,'en')).toContain('awaiting review');
    expect(batchItemState({...item,state:'DUPLICATE'},'en')).toContain('not submitted again');
    expect(batchItemState({...item,reviewStatus:'verified'},'en')).toBe('Human-verified');
  });
  it('provides complete localized copy',()=>{
    for(const table of Object.values(batchLanguages))expect(Object.keys(table).sort()).toEqual(Object.keys(batchLanguages.en).sort());
  });
  it('requires Bearer, permits only GET/POST and retains no-store',async()=>{
    vi.stubEnv('CREDIT_API_URL','http://java:8080');
    const send=vi.fn().mockResolvedValue(Response.json({batches:[]}));vi.stubGlobal('fetch',send);
    const url='http://localhost:3000/api/cases/C/platform/batches',headers={Authorization:'Bearer test'};
    expect((await proxyCase(new Request(url),['C','platform','batches'])).status).toBe(401);
    expect((await proxyCase(new Request(url,{method:'PATCH',headers}),['C','platform','batches'])).status).toBe(405);
    const read=await proxyCase(new Request(url,{headers}),['C','platform','batches']);expect(read.status).toBe(200);expect(read.headers.get('cache-control')).toBe('no-store');
    expect((await proxyCase(new Request(url+'/admin',{headers}),['C','platform','batches','admin'])).status).toBe(404);
  });
});
