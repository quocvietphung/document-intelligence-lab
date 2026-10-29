import {pdfExampleCopy,type pdfExample} from '@/lib/ai-pdf-examples';
import {domainText} from '@/lib/document-domains';
export function AIPdfExample({example,locale,open,hint,openLabel}:{example:ReturnType<typeof pdfExample>|undefined;locale:string;open?:()=>void;hint?:string;openLabel?:string}){
  if(!example)return null;const t=pdfExampleCopy(locale);
  return <details className="research-reference-details ai-pdf-example"><summary>{t.title}</summary><p><strong>{example.file}</strong> · {domainText(locale)[example.domain]}</p><p>{example.question}</p><small>{hint??t.hint}</small>{open?<button type="button" className="button-link" onClick={open}>{openLabel??t.open}</button>:null}</details>;
}
