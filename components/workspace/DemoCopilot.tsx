"use client";
import {useRef,useState,useEffect,type FormEvent} from "react";
import {MessageSquareText,Send,ShieldCheck} from "lucide-react";
import type {WorkspaceCase} from "@/lib/credit-api";
import {publicDemoAnswer,publicDemoCase} from "@/lib/public-demo";
import {publicDemoText} from "@/lib/public-demo-language";
import {workspaceText} from "@/lib/workspace-language";
import {NovaChatSurface} from "./NovaChatSurface";
import {novaGreeting} from "@/lib/nova-welcome";
import {NovaGuideCard} from "./NovaGuideCard";
import {NovaMessageText} from "./NovaMessageText";
import {novaGuideFor,novaGuideIntro,novaGuideLabels,workspaceTabs,type WorkspaceTab,type NovaGuide} from "@/lib/nova-guide";

export function DemoCopilot({item,locale,open,onOpen,close,initialQuestion,openSource,navigate,currentTab}:{item:WorkspaceCase;locale:string;open:boolean;onOpen:()=>void;close:()=>void;initialQuestion?:string;openSource:(id:string)=>void;navigate:(tab:WorkspaceTab)=>void;currentTab:WorkspaceTab}) {
  const t=workspaceText(locale),d=publicDemoText(locale);
  const [text,setText]=useState(initialQuestion||"");
  const welcome={id:"nova-welcome",role:"assistant" as const,text:novaGreeting(locale)};
  const [messages,setMessages]=useState<{id:string;role:"user"|"assistant";text:string;guide?:NovaGuide}[]>(()=>[welcome]);
  const bottom=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(open)bottom.current?.scrollIntoView({block:"nearest"});},[messages,open]);
  useEffect(()=>{if(initialQuestion===undefined)return;const timer=window.setTimeout(()=>setText(initialQuestion),0);return()=>window.clearTimeout(timer);},[initialQuestion]);
  function send(event?:FormEvent,question=text,all=false) {
    event?.preventDefault();if(!question.trim())return;
    const guide=all?{features:[...workspaceTabs],query:question}:novaGuideFor(question,currentTab);
    setMessages(previous=>[...previous.slice(-18),{id:crypto.randomUUID(),role:"user",text:question.trim()},
      {id:crypto.randomUUID(),role:"assistant",text:guide?novaGuideIntro(locale):publicDemoAnswer(question.trim(),locale),guide}]);setText("");
  }
  return <NovaChatSurface title={t("nova")} locale={locale} open={open} onOpen={onOpen} close={close}>
    <details className="nova-disclosure"><summary><ShieldCheck size={13}/>{d("badge")}</summary><p>{d("notice")}</p></details>
    <div className="chat-history" role="log" aria-label={t("nova")}>
      {!messages.length?<div className="chat-welcome"><MessageSquareText size={32}/><h3>{t("chatReady")}</h3><button className="button-secondary" onClick={()=>send(undefined,t("question"))}>{t("question")}</button></div>:messages.map(m=><article key={m.id} className={`chat-bubble ${m.role==="user"?"chat-user":"chat-assistant"}`}>
        <NovaMessageText text={m.text} navigate={navigate}/>
        {m.guide?<NovaGuideCard guide={m.guide} locale={locale} item={item} navigate={navigate} openSource={openSource}/>:null}
        {m.id==="nova-welcome"?<button className="button-secondary mt-4" onClick={()=>send(undefined,t("question"))}>{t("question")}</button>:null}
        {m.role==="assistant"&&m.id!=="nova-welcome"&&!m.guide?<details className="mt-4 text-xs"><summary>{t("sources")}</summary>
          {publicDemoCase.documents.filter(doc=>doc.pages?.length).map(doc=><button key={doc.id} className="button-link block mt-2" onClick={()=>openSource(`${doc.id}:p1`)}>{doc.name} →</button>)}
          <span className="block mt-2">{item.id} · bundled synthetic data</span></details>:null}
      </article>)}<div ref={bottom}/>
    </div>
    <form onSubmit={send} className="chat-composer"><label className="sr-only" htmlFor="nova-demo-question">{t("ask")}</label><textarea id="nova-demo-question" rows={2} maxLength={2000} value={text} onChange={e=>setText(e.target.value)} placeholder={t("ask")}/><button className="button-primary" disabled={!text.trim()}><Send size={17}/>{t("send")}</button></form>
    <div className="mt-3 flex flex-wrap gap-3"><button className="button-link" onClick={()=>send(undefined,novaGuideLabels(locale).actions,true)}>{novaGuideLabels(locale).actions}</button><button className="button-link" onClick={()=>setMessages([welcome])}>{t("clear")}</button></div>
  </NovaChatSurface>;
}
