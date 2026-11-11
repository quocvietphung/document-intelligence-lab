import {describe,expect,it,vi,afterEach} from 'vitest';
import {basisLabel,displayAmount,findingTitle,knownFindingCodes,precheckPath,precheckSchema,precheckText} from './contractor-precheck';
import {forwardedQuery,proxyCase} from './case-proxy';

afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});

const sample={method:'contractor-precheck-v1',caseId:'C',caseVersion:3,readOnly:true,dossierWrites:0,
  documents:[{id:'d1',name:'nachtrag.pdf',role:'change-order',reviewStatus:'review',pages:2}],
  approved:{amount:'48780.00',basis:'GROSS',literal:'48.780,00 EUR brutto',source:{documentId:'d1',documentName:'nachtrag.pdf',page:2,quote:'Genehmigte Gesamtvergütung: 48.780,00 EUR brutto',ref:'[d1:p2]',regionId:null}},
  invoice:{amount:'49980.00',basis:'GROSS',literal:'49.980,00 EUR brutto',source:{documentId:'d2',documentName:'rechnung.pdf',page:2},number:'RG-2026-0457'},
  variance:{amount:'1200.00',basis:'GROSS',sameTaxBasis:true,net:'1008.40',vat:'191.60'},
  invoiceLines:[{position:3,description:'Spachtelung',reference:'ohne Nachtrag',net:'1008.40',approved:false,source:{documentId:'d2',page:1}}],
  evidence:{acceptance:{status:'PARTIAL',notAcceptedPositions:[3],openDefects:1,remediationDeadline:'15.12.2026',sources:[]},payment:{status:'MISSING',sources:[]},
    photos:{referenced:['F-01','F-03'],missing:['F-03'],provided:[{photoId:'F-01',documentId:'p1'}]},retrieval:[{purpose:'payment',backend:'qdrant',hits:[{documentId:'d2',page:2,confirmed:false}]}]},
  findings:[{code:'INVOICE_EXCEEDS_APPROVED_AMOUNT',severity:'HIGH',message:'Invoice exceeds the approved amount by 1.200,00 EUR (GROSS)',sources:[]}],
  embeddedInstructions:[],
  draft:{status:'DRAFT_REQUIRES_HUMAN_REVIEW',approved:false,emailSent:false,paymentReleased:false,summary:['x'],email:{subject:'s',body:'b',send:false}},
  steps:[{name:'extract',durationMs:1.2}],traceId:null,boundary:'Research support only.'};

describe('contractor pre-check contract',()=>{
  it('accepts only an unapproved, unsent, read-only draft',()=>{
    expect(precheckSchema.parse(sample).variance.amount).toBe('1200.00');
    for(const change of [{readOnly:false},{dossierWrites:1},{draft:{...sample.draft,approved:true}},{draft:{...sample.draft,emailSent:true}},{draft:{...sample.draft,email:{...sample.draft.email,send:true}}}])
      expect(()=>precheckSchema.parse({...sample,...change})).toThrow();
  });
  it('displays Java decimal strings without recomputing them',()=>{
    expect(displayAmount('48780.00','de')).toBe('48.780,00 EUR');
    expect(displayAmount('1200.00','vi')).toBe('1.200,00 EUR');
    expect(displayAmount('49980.00','en')).toBe('EUR 49,980.00');
    expect(displayAmount('1200','en')).toBe('—');
    expect(displayAmount(null,'en')).toBe('—');
  });
  it('builds a scoped path and has every label in three languages',()=>{
    expect(precheckPath('CR-1','vi')).toBe('/api/cases/CR-1/platform/contractor-precheck?locale=vi');
    expect(precheckPath('CR-1','fr')).toBe('/api/cases/CR-1/platform/contractor-precheck?locale=en');
    expect(Object.keys(precheckText('vi'))).toEqual(Object.keys(precheckText('en')));
    expect(Object.keys(precheckText('de'))).toEqual(Object.keys(precheckText('en')));
  });
  it('localizes tax basis and every finding code the Java check can emit',()=>{
    expect(basisLabel('GROSS','vi')).toBe('brutto (đã gồm VAT)');expect(basisLabel('NET','de')).toBe('netto');expect(basisLabel(null,'en')).toBe('unknown');
    const javaCodes=['INVOICE_EXCEEDS_APPROVED_AMOUNT','INVOICE_BELOW_APPROVED_AMOUNT','INVOICE_LINE_WITHOUT_APPROVAL','ACCEPTANCE_EVIDENCE_MISSING','OPEN_ACCEPTANCE_DEFECTS','PAYMENT_EVIDENCE_MISSING','PHOTO_EVIDENCE_MISSING','EMBEDDED_APPROVAL_INSTRUCTION','SOURCES_NOT_HUMAN_REVIEWED','TAX_BASIS_MISMATCH','APPROVED_AMOUNT_NOT_FOUND','INVOICE_AMOUNT_NOT_FOUND','APPROVED_TOTAL_INCONSISTENT','INVOICE_ARITHMETIC_MISMATCH','INVOICE_LINES_DIFFER_FROM_NET','AMBIGUOUS_AMOUNT'];
    expect([...knownFindingCodes].sort()).toEqual([...javaCodes].sort());
    expect(findingTitle('PAYMENT_EVIDENCE_MISSING','vi')).toBe('Thiếu bằng chứng thanh toán');expect(findingTitle('NEW_CODE','vi')).toBe('NEW_CODE');
  });
  it('proxies the pre-check as authenticated GET only and forwards just the locale',async()=>{
    vi.stubEnv('CREDIT_API_URL','http://java:8080');const fetchMock=vi.fn().mockResolvedValue(Response.json(sample));vi.stubGlobal('fetch',fetchMock);
    const path=['C','platform','contractor-precheck'],url='http://localhost:3000/api/cases/C/platform/contractor-precheck?locale=vi&debug=1',headers={Authorization:'Bearer fixture'};
    expect((await proxyCase(new Request(url,{headers}),path)).status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe('http://java:8080/api/cases/C/platform/contractor-precheck?locale=vi');
    expect((await proxyCase(new Request(url,{headers,method:'POST'}),path)).status).toBe(405);
    expect((await proxyCase(new Request(url),path)).status).toBe(401);
    expect(forwardedQuery(new Request('http://localhost/x?locale=xx'),'C/platform/contractor-precheck')).toBe('');
    expect(forwardedQuery(new Request('http://localhost/x?locale=de'),'C/platform/search')).toBe('');
  });
});
