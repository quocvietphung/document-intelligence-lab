type TextItem={str:string;transform:number[];width:number;height:number};
const normalized=(value:string)=>value.replace(/(?:EUR|€)/gi,'').replace(/\s+/g,'').trim();
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
