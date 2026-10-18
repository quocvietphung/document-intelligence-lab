import {afterEach,describe,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {insuranceReferences,insuranceReference,kaggleReferences,researchSamples,researchSampleUrl,researchSampleLabels} from './research-samples';
import {validInsuranceReference} from './insurance-reference-bytes';
import {GET} from '@/app/api/insurance-references/route';
import {GET as researchGET} from '@/app/api/research-references/route';

afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('private Kaggle insurance library',()=>{
  it('pins reviewed version, original and excerpt hashes and exact source pages',()=>{
    expect(insuranceReferences).toHaveLength(4);expect(kaggleReferences).toHaveLength(8);
    for(const sample of kaggleReferences){
      expect(sample.sha256).toMatch(/^[a-f0-9]{64}$/);expect(sample.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(sample.datasetVersion).toBe(sample.domain==='insurance'?3:1);expect(sample.sourcePages).toHaveLength(sample.domain==='insurance'?2:1);
      expect(sample.sourcePages.every(p=>p>=1&&p<=sample.sourcePageCount)).toBe(true);
      expect(existsSync('public/samples/'+sample.file)).toBe(false);
      expect(researchSampleUrl(sample)).toContain('/api/research-references?sample=');
    }
    expect(insuranceReference('../../.env')).toBeUndefined();
  });
  it('never mixes insurance references with DATEV or general invoices',()=>{
    expect(researchSamples('banking')).toEqual([]);
    expect(researchSamples('insurance')).toHaveLength(4);
    expect(researchSamples('general')).toHaveLength(4);
    expect(researchSamples('general').every(s=>s.synthetic&&s.domain==='general'&&s.format==='pdf-original')).toBe(true);
    for(const file of ['insurance-policy-fictional.pdf','insurance-claim-fictional.pdf','invoice-fictional.pdf']){
      expect(existsSync('public/samples/'+file)).toBe(false);
      expect(existsSync('services/credit-api/src/test/resources/legacy-research/'+file)).toBe(true);
    }
  });
  it('validates actual bytes, not a filename or PDF prefix alone',()=>{
    const bytes=Buffer.from('%PDF-1.4 fixture');const hash=createHash('sha256').update(bytes).digest('hex');
    expect(validInsuranceReference(bytes,hash)).toBe(true);
    expect(validInsuranceReference(Buffer.from('not-pdf'),hash)).toBe(false);
    expect(validInsuranceReference(bytes,'0'.repeat(64))).toBe(false);
    expect(validInsuranceReference(Buffer.alloc(3_000_001),hash)).toBe(false);
    expect(validInsuranceReference(bytes,'')).toBe(false);
  });
  it.each(['en','de','vi'])('explains source, cloud destination and limitations in %s',locale=>{
    const t=researchSampleLabels(locale);
    expect(t.rights).toContain('Apache 2.0');expect(t.cloud).toContain('Azure Document Intelligence');
    expect(t.scope.length).toBeGreaterThan(100);expect(t.mapped).toContain('→');
  });
  it('requires Bearer authorization even for the catalogue',async()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    const result=await GET(new Request('http://localhost/api/insurance-references'));
    expect(result.status).toBe(401);expect(fetcher).not.toHaveBeenCalled();
    expect(result.headers.get('cache-control')).toContain('no-store');
  });
  it('blocks the public demo and missing local API',async()=>{
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE','true');
    expect((await GET(new Request('http://localhost/api/insurance-references'))).status).toBe(403);
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE','false');vi.stubEnv('CREDIT_API_URL','');
    expect((await GET(new Request('http://localhost/api/insurance-references',{headers:{Authorization:'Bearer fixture'}}))).status).toBe(503);
  });
  it('delegates token verification to Java and fails closed',async()=>{
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE','false');vi.stubEnv('CREDIT_API_URL','http://credit-api:8080');
    const fetcher=vi.fn().mockResolvedValue(new Response(null,{status:403}));vi.stubGlobal('fetch',fetcher);
    expect((await GET(new Request('http://localhost/api/insurance-references',{headers:{Authorization:'Bearer fixture'}}))).status).toBe(403);
    expect(fetcher.mock.calls[0][0]).toBe('http://credit-api:8080/api/cases');
  });
  it('rejects path traversal after authorization without returning filesystem details',async()=>{
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE','false');vi.stubEnv('CREDIT_API_URL','http://credit-api:8080');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(null,{status:200})));
    const result=await GET(new Request('http://localhost/api/insurance-references?sample=../../.env',{headers:{Authorization:'Bearer fixture'}}));
    expect(result.status).toBe(404);expect(await result.text()).not.toContain('.local');
  });
  it('never fetches Kaggle from the request handler or publishes PDF assets',()=>{
    const source=readFileSync('lib/private-research-references.ts','utf8');
    expect(source).toContain('O_NOFOLLOW');expect(source).toContain('validInsuranceReference');
    expect(source).not.toContain('downloadUrl');
  });
  it('protects the expanded library and rejects invalid domains',async()=>{
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE','false');
    expect((await researchGET(new Request('http://localhost/api/research-references?domain=general'))).status).toBe(401);
    expect((await researchGET(new Request('http://localhost/api/research-references?domain=unknown'))).status).toBe(400);
  });
  it('does not serve a reference from another domain',async()=>{
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE','false');vi.stubEnv('CREDIT_API_URL','http://credit-api:8080');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(null,{status:200})));
    const result=await researchGET(new Request('http://localhost/api/research-references?domain=insurance&sample=invoice-51109301',{headers:{Authorization:'Bearer fixture'}}));
    expect(result.status).toBe(404);
  });
});
