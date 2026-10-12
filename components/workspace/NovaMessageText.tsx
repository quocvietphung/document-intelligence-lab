import {workspaceTarget,type WorkspaceTab} from "@/lib/nova-guide";
/** Only app-owned, allowlisted relative links become clickable. No HTML/provider URLs. */
export function NovaMessageText({text,navigate}:{text:string;navigate:(tab:WorkspaceTab)=>void}){
  return <div className="whitespace-pre-wrap">{text.split(/(\/(?:en|de|vi)#[a-z]+)/g).map((part,i)=>{const tab=workspaceTarget(part.split("#")[1]||"");return /^\/(en|de|vi)#/.test(part)&&tab?<a key={i} className="nova-inline-link" href={part} onClick={e=>{e.preventDefault();navigate(tab);}}>{part}</a>:part;})}</div>;
}
