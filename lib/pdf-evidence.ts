type TextItem={str:string;transform:number[];width:number;height:number};
const normalized=(value:string)=>value.replace(/(?:EUR|€)/gi,'').replace(/\s+/g,'').trim();
export type PixelRegion={left:number;top:number;width:number;height:number};
/** Enumerate exact text-layer occurrences, including rotated glyphs. Never pick the first duplicate. */
export function textOccurrenceRegions(items:readonly unknown[],needle:string,convert:(x:number,y:number)=>number[]):PixelRegion[]{
  const exact=(s:string)=>s.replace(/\s+/g,' ').trim();const target=exact(needle);if(!target)return [];
  return items.flatMap(item=>{
    if(!item||typeof item!=='object'||!('str' in item)||typeof item.str!=='string'||exact(item.str)!==target)return [];
    const v=item as TextItem;if(!Array.isArray(v.transform)||v.transform.length!==6||![...v.transform,v.width,v.height].every(Number.isFinite)||v.width<=0||v.height<=0)return [];
    const [a,b,,,x,y]=v.transform,n=Math.hypot(a,b);if(n<=0)return [];
    const dx=a/n*v.width,dy=b/n*v.width,ux=-b/n*v.height,uy=a/n*v.height;
    const points=[[x,y],[x+dx,y+dy],[x+ux,y+uy],[x+dx+ux,y+dy+uy]].map(([x,y])=>convert(x,y));
    if(points.some(p=>p.length!==2||!p.every(Number.isFinite)))return [];
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return [{left:Math.min(...xs),top:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)}];
  });
}
/** Only one exact original-text match gets a region. No fuzzy or fabricated coordinates. */
export function uniqueTextRegion(items:readonly unknown[],needle:string,convert:(box:number[])=>number[]) {
  const value=normalized(needle);if(!value)return;
  const matches=items.filter((item):item is TextItem=>typeof item==='object'&&item!==null&&'str' in item&&typeof item.str==='string'&&normalized(item.str)===value&&'transform' in item&&Array.isArray(item.transform)&&item.transform.length===6&&item.transform.every(v=>typeof v==='number'&&Number.isFinite(v))&&'width' in item&&typeof item.width==='number'&&'height' in item&&typeof item.height==='number');
  if(matches.length!==1)return;
  const item=matches[0];if(!Number.isFinite(item.width)||!Number.isFinite(item.height)||item.width<=0||item.height<=0||item.transform[1]!==0||item.transform[2]!==0)return;
  const [x1,y1,x2,y2]=convert([item.transform[4],item.transform[5],item.transform[4]+item.width,item.transform[5]+item.height]);
  if(![x1,y1,x2,y2].every(Number.isFinite))return;
  return {left:Math.min(x1,x2),top:Math.min(y1,y2),width:Math.abs(x2-x1),height:Math.abs(y2-y1)};
}
