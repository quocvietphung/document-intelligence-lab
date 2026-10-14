"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";
import {ArrowDown,Check,Copy} from "lucide-react";
import {customerUx,nearChatBottom,novaSuggestions} from "@/lib/customer-ux";
import type {WorkspaceTab} from "@/lib/nova-guide";

export function NovaConversation({open,messages,label,locale,children}:{open:boolean;messages:readonly unknown[];label:string;locale:string;children?:ReactNode}) {
  const log=useRef<HTMLDivElement>(null),following=useRef(true);
  const [away,setAway]=useState(false);
  useEffect(()=>{if(open&&following.current&&log.current)log.current.scrollTop=log.current.scrollHeight;},[messages,open]);
  useEffect(()=>{
    if(!open||!log.current)return;
    const observer=new ResizeObserver(()=>{if(following.current&&log.current)log.current.scrollTop=log.current.scrollHeight;});
    observer.observe(log.current);return()=>observer.disconnect();
  },[open]);
  return <div className="nova-conversation"><div ref={log} className="chat-history scrollbar-thin" role="log" aria-label={label}
    tabIndex={0} onScroll={event=>{const el=event.currentTarget;following.current=nearChatBottom(el.scrollTop,el.clientHeight,el.scrollHeight);setAway(!following.current);}}><div className="nova-conversation-messages">{children}</div></div>
    {away?<button className="nova-latest" type="button" onClick={()=>{following.current=true;setAway(false);if(log.current)log.current.scrollTop=log.current.scrollHeight;}}><ArrowDown size={14}/>{customerUx(locale).latest}</button>:null}
  </div>;
}
export function NovaSuggestions({locale,page,select,disabled=false}:{locale:string;page:WorkspaceTab;select:(text:string)=>void;disabled?:boolean}) {
  const choices=novaSuggestions(locale,page);
  return <details className="nova-suggestions"><summary>{choices.label}</summary><p>{choices.hint}</p><div>{choices.questions.map(question=><button type="button" key={question} disabled={disabled} onClick={()=>select(question)}>{question}</button>)}</div></details>;
}
export function NovaCopyAnswer({text,locale}:{text:string;locale:string}) {
  const t=customerUx(locale),[result,setResult]=useState<"copied"|"failed">();
  useEffect(()=>{if(!result)return;const timer=setTimeout(()=>setResult(undefined),2500);return()=>clearTimeout(timer);},[result]);
  async function copy(){try{await navigator.clipboard.writeText(text);setResult("copied");}catch{setResult("failed");}}
  return <div className="nova-answer-actions"><button type="button" aria-label={t.copy} title={t.copy} disabled={!text.trim()} onClick={()=>void copy()}>{result==="copied"?<Check size={14}/>:<Copy size={14}/>} {t.copy}</button>{result?<span role="status">{result==="copied"?t.copied:t.copyFailed}</span>:null}</div>;
}
