"use client";
import {useState,useEffect,type FormEvent} from "react";
import {Compass,MessageSquareText,Trash2} from "lucide-react";
import type {WorkspaceCase} from "@/lib/credit-api";
import {publicDemoAnswer,publicDemoCase} from "@/lib/public-demo";
import {publicDemoText} from "@/lib/public-demo-language";
import {workspaceText} from "@/lib/workspace-language";
import {NovaChatContext,NovaChatSurface} from "./NovaChatSurface";
import {NovaComposer} from "./NovaComposer";
import {NovaConversation,NovaCopyAnswer,NovaSuggestions} from "./NovaConversation";
import type {NovaPageGuide} from "./NovaChatSurface";
import {novaGreeting} from "@/lib/nova-welcome";
import {NovaGuideCard} from "./NovaGuideCard";
import {NovaMessageText} from "./NovaMessageText";
import {novaGuideFor,novaGuideIntro,novaGuideLabels,workspaceTabs,type WorkspaceTab,type NovaGuide} from "@/lib/nova-guide";

export function DemoCopilot({item,locale,open,onOpen,close,initialQuestion,openSource,navigate,currentTab,onPageGuide,pageGuideLabel}:{item:WorkspaceCase;locale:string;open:boolean;onOpen:()=>void;close:()=>void;initialQuestion?:string;openSource:(id:string)=>void;navigate:(tab:WorkspaceTab)=>void;currentTab:WorkspaceTab} & NovaPageGuide) {
  const t=workspaceText(locale),d=publicDemoText(locale);
  const [text,setText]=useState(initialQuestion||"");
  const welcome={id:"nova-welcome",role:"assistant" as const,text:novaGreeting(locale)};
  const [messages,setMessages]=useState<{id:string;role:"user"|"assistant";text:string;guide?:NovaGuide}[]>(()=>[welcome]);
  useEffect(()=>{if(initialQuestion===undefined)return;const timer=window.setTimeout(()=>setText(initialQuestion),0);return()=>window.clearTimeout(timer);},[initialQuestion]);
  function send(event?:FormEvent,question=text,all=false) {
    event?.preventDefault();if(!question.trim())return;
    const guide=all?{features:[...workspaceTabs],query:question}:novaGuideFor(question,currentTab);
    setMessages(previous=>[...previous.slice(-18),{id:crypto.randomUUID(),role:"user",text:question.trim()},
      {id:crypto.randomUUID(),role:"assistant",text:guide?novaGuideIntro(locale):publicDemoAnswer(question.trim(),locale),guide}]);setText("");
  }
  return <NovaChatSurface demo title={t("nova")} locale={locale} open={open} onOpen={onOpen} close={close} onPageGuide={onPageGuide} pageGuideLabel={pageGuideLabel}>
    <NovaConversation open={open} messages={messages} label={t("nova")} locale={locale}>
      <NovaChatContext demo locale={locale} caseId={item.id} hint={d("notice")}/>
      {!messages.length?<div className="chat-welcome"><MessageSquareText size={32}/><h3>{t("chatReady")}</h3><button className="button-secondary" onClick={()=>send(undefined,t("question"))}>{t("question")}</button></div>:messages.map(m=><article key={m.id} className={`chat-bubble ${m.role==="user"?"chat-user":"chat-assistant"}`}>
        <NovaMessageText text={m.text} navigate={navigate}/>
        {m.guide?<NovaGuideCard guide={m.guide} locale={locale} item={item} navigate={navigate} openSource={openSource}/>:null}
        {m.id==="nova-welcome"?<button className="button-secondary mt-4" onClick={()=>send(undefined,t("question"))}>{t("question")}</button>:null}
        {m.role==="assistant"&&m.id!=="nova-welcome"&&!m.guide?<details className="mt-4 text-xs"><summary>{t("sources")}</summary>
          {publicDemoCase.documents.filter(doc=>doc.pages?.length).map(doc=><button key={doc.id} className="button-link block mt-2" onClick={()=>openSource(`${doc.id}:p1`)}>{doc.name} →</button>)}
          <span className="block mt-2">{item.id} · bundled synthetic data</span></details>:null}
        {m.role==="assistant"&&m.id!=="nova-welcome"&&!m.guide?<NovaCopyAnswer text={m.text} locale={locale}/>:null}
      </article>)}
    <NovaSuggestions locale={locale} page={currentTab} select={setText}/>
    <div className="nova-chat-shortcuts"><button className="button-link" onClick={()=>send(undefined,novaGuideLabels(locale).actions,true)}><Compass size={14}/>{novaGuideLabels(locale).actions}</button></div>
    </NovaConversation>
    <NovaComposer id="nova-demo-question" locale={locale} label={t("ask")} sendLabel={t("send")} text={text} onChange={setText} onSubmit={send} actions={<button className="button-link" aria-label={t("clear")} title={t("clear")} onClick={()=>{setMessages([welcome]);setText("");}}><Trash2 size={15}/></button>}/>
  </NovaChatSurface>;
}
