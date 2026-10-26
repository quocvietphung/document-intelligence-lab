import {describe,it,expect,vi,afterEach} from 'vitest';
import {fieldRegions,providerRegionBox,regionTableContext,inspectionLanguages,type EvidenceRegion} from './evidence-inspection';
import {textOccurrenceRegions} from './pdf-evidence';
import {proxyCase} from './case-proxy';
const region:EvidenceRegion={id:'r1',text:'Total: $500',left:.1,top:.2,right:.5,bottom:.3,pageWidth:600,pageHeight:800};
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('source occurrence and OCR inspection',()=>{
  it('preserves four identical occurrences and does not merge currency or separators',()=>{
    const regions=Array.from({length:4},(_,i)=>({...region,id:`r${i}`,top:.1*i,bottom:.1*i+.05}));
    expect(fieldRegions(regions,'$500','Total: $500')).toHaveLength(4);
    expect(fieldRegions(regions,'€500','Total: €500')).toEqual([]);
    const items=regions.map(r=>({str:r.text,transform:[1,0,0,1,60,r.top*800],width:240,height:20}));
    const boxes=textOccurrenceRegions(items,'Total: $500',(x,y)=>[x,y]);
    expect(boxes).toHaveLength(4);expect(new Set(boxes.map(b=>b.top)).size).toBe(4);
  });
  it('maps a provider box through the original crop box and zoom, not CSS pixel guesses',()=>{
    const convert=(b:number[])=>b.map(v=>v*2);
    expect(providerRegionBox(region,[10,20,610,820],0,convert)).toEqual({left:140,top:1160,width:480,height:160});
    expect(providerRegionBox({...region,pageWidth:800},[0,0,600,800],0,convert)).toBeUndefined();
    for(const rotation of [90,180,270])expect(providerRegionBox(region,[0,0,600,800],rotation,convert)).toBeUndefined();
    expect(providerRegionBox({...region,left:NaN},[0,0,600,800],0,convert)).toBeUndefined();
    expect(providerRegionBox({...region,right:2},[0,0,600,800],0,convert)).toBeUndefined();
  });
  it('uses rotated PDF text transforms but refuses invented OCR matches',()=>{
    const item={str:'8,500',transform:[0,10,-10,0,100,200],width:50,height:10};
    expect(textOccurrenceRegions([item],'8,500',(x,y)=>[y,600-x])).toEqual([{left:200,top:500,width:50,height:10}]);
    expect(textOccurrenceRegions([item],'3,500',(x,y)=>[x,y])).toEqual([]);
    expect(textOccurrenceRegions([],'3,500',(x,y)=>[x,y])).toEqual([]);
  });
  it('keeps all three language contracts aligned',()=>{
    for(const copy of Object.values(inspectionLanguages)){expect(Object.keys(copy)).toEqual(Object.keys(inspectionLanguages.en));expect(Object.values(copy).every(s=>s.trim())).toBe(true);}
  });
  it('keeps raw row, column and unit labels beside a cited table cell',()=>{
    const tables=[{cells:[{row:0,column:0,text:'Item'},{row:0,column:1,text:'Gross total (USD)'},{row:1,column:0,text:'Inspection'},{row:1,column:1,text:'8,500'},{row:2,column:1,text:'unrelated amount'}]}];
    expect(regionTableContext({...region,table:0,row:1,column:1},tables)).toBe('[1,1] Item | [1,2] Gross total (USD) | [2,1] Inspection | [2,2] 8,500');
    expect(regionTableContext(region,tables)).toBeUndefined();
  });
  it('proxies only authenticated POST OCR corrections and rejects GET',async()=>{
    vi.stubEnv('CREDIT_API_URL','http://java:8080');const fetcher=vi.fn().mockResolvedValue(Response.json({ok:true}));vi.stubGlobal('fetch',fetcher);
    const path=['C','documents','doc-1','ocr-corrections'],url='http://localhost:3000/api/cases/'+path.join('/');
    expect((await proxyCase(new Request(url,{method:'POST',body:'{}'}),path)).status).toBe(401);
    const headers={Authorization:'Bearer test-only-token'};
    expect((await proxyCase(new Request(url,{headers}),path)).status).toBe(405);
    expect((await proxyCase(new Request(url,{headers,method:'POST',body:'{}'}),path)).status).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
