import {workspaceTarget,type WorkspaceTab} from "@/lib/nova-guide";
/** Only app-owned, allowlisted relative links become clickable. No HTML/provider URLs. */
export function NovaMessageText({text,navigate,citations=[],openSource}:{text:string;navigate:(tab:WorkspaceTab)=>void;citations?:readonly string[];openSource?:(id:string)=>void}){
  return <div className="whitespace-pre-wrap">{text.split(/(\/(?:en|de|vi)#[a-z]+|\[[^\]\n]{1,150}\])/g).map((part,i)=>{
    const id=part.startsWith('[')?part.slice(1,-1):undefined;
    if(id&&citations.includes(id)&&openSource)return <button type="button" key={i} className="nova-inline-citation" onClick={()=>openSource(id)}>{part}</button>;
    const tab=workspaceTarget(part.split("#")[1]||"");return /^\/(en|de|vi)#/.test(part)&&tab?<a key={i} className="nova-inline-link" href={part} onClick={e=>{e.preventDefault();navigate(tab);}}>{part}</a>:part;
  })}</div>;
}
