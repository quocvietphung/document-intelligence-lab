"use client";
import React,{useEffect,useRef,useState,type ReactNode} from "react";
import {ChevronDown,Compass,Maximize2,Minimize2,Minus,Sparkles,ShieldCheck} from "lucide-react";
import {novaWidgetText} from "@/lib/nova-widget-language";
import {novaViewportSpace} from "@/lib/nova-layout";

import {AIChatIdentity} from "./AITransparency";
import {aiText,chatEngine,type AICapabilities} from "@/lib/ai-capabilities";
import {trustText} from "@/lib/nova-trust-language";
import {NovaAvatar} from "./NovaAvatar";
export type NovaPageGuide = {onPageGuide?:()=>void;pageGuideLabel?:string;onTrust?:()=>void};
export function NovaChatSurface({title,locale,open,onOpen,close,children,onPageGuide,pageGuideLabel,onTrust,aiCapabilities,demo=false}: {
  title:string;locale:string;open:boolean;onOpen:()=>void;close:()=>void;children?:ReactNode;aiCapabilities?:AICapabilities;demo?:boolean;
} & NovaPageGuide) {
  const t=novaWidgetText(locale),launcher=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null),widget=useRef<HTMLElement>(null);
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>{
    if(!open)return;
    const frame=requestAnimationFrame(()=>{
      const target=window.matchMedia('(min-width: 761px)').matches?panel.current?.querySelector<HTMLTextAreaElement>('textarea'):panel.current;
      target?.focus({preventScroll:true});
    });
    return()=>cancelAnimationFrame(frame);
  },[open]);
  useEffect(()=>{
    if(!open||!window.visualViewport)return;
    const viewport=window.visualViewport,element=widget.current;
    function update(){const space=novaViewportSpace(window.innerHeight,viewport.height,viewport.offsetTop);element?.style.setProperty('--nova-viewport-height',`${space.height}px`);element?.style.setProperty('--nova-keyboard-offset',`${space.bottom}px`);}
    update();viewport.addEventListener('resize',update);viewport.addEventListener('scroll',update);window.addEventListener('resize',update);
    return()=>{viewport.removeEventListener('resize',update);viewport.removeEventListener('scroll',update);window.removeEventListener('resize',update);element?.style.removeProperty('--nova-viewport-height');element?.style.removeProperty('--nova-keyboard-offset');};
  },[open]);
  const engine=chatEngine(aiCapabilities,locale,demo);
  function minimize(){close();requestAnimationFrame(()=>launcher.current?.focus());}
  return <React.Fragment>
    <aside ref={widget} className={`nova-widget${open?' nova-widget-open':''}`} aria-label={title}>
      <section ref={panel} id="nova-chat-panel" className={`nova-chat-panel${expanded?' nova-chat-expanded':''}`} tabIndex={-1} role="dialog" aria-modal="false" aria-labelledby="nova-chat-title" hidden={!open}
        onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();minimize();}}}>
        <header className="nova-chat-header"><span className="nova-chat-avatar" aria-hidden="true" title={t.portraitDisclosure}><NovaAvatar/></span><div><h2 id="nova-chat-title">{title}</h2><p>{t.subtitle}<span className="sr-only">. {t.portraitDisclosure}</span></p></div>
          {onTrust?<button className="nova-trust-button" type="button" onClick={onTrust} aria-label={trustText(locale).open} title={trustText(locale).open}><ShieldCheck size={17}/></button>:null}
          {onPageGuide?<button className="nova-tips-button" type="button" onClick={onPageGuide} aria-label={pageGuideLabel}><Compass size={16}/></button>:null}
          <button className="nova-size-button" type="button" onClick={()=>setExpanded(value=>!value)} aria-label={expanded?t.restore:t.expand} title={expanded?t.restore:t.expand} aria-pressed={expanded}>{expanded?<Minimize2 size={18}/>:<Maximize2 size={18}/>}</button>
          <button type="button" onClick={minimize} aria-label={t.minimize}><Minus size={20}/></button>
        </header>
        <div className="nova-chat-content">{children}</div>
      </section>
      <div className="nova-launcher-row">
        {onPageGuide?<button type="button" className="nova-guide-launcher" onClick={onPageGuide} aria-label={pageGuideLabel} title={pageGuideLabel}><Compass size={23}/></button>:null}
        <button ref={launcher} type="button" className="nova-chat-launcher" onClick={()=>open?minimize():onOpen()} aria-expanded={open} aria-controls="nova-chat-panel" aria-label={open?t.minimize:t.open}>
          {open?<Minus size={21}/>:<NovaAvatar/>}<span>Nova <small>{engine.kind==="demo"?"DEMO":aiText(locale).ai}</small></span>
        </button>
      </div>
    </aside>
  </React.Fragment>;
}

/** Metadata is inside the message scroller, never a fixed strip competing with answers. */
export function NovaChatContext({locale,caseId,hint,aiCapabilities,mode,demo=false,children}:{locale:string;caseId:string;hint?:string;aiCapabilities?:AICapabilities;mode?:string;demo?:boolean;children?:ReactNode}) {
  const t=novaWidgetText(locale),engine=chatEngine(aiCapabilities,locale,demo);
  return <details className="nova-chat-context"><summary><Sparkles size={13} aria-hidden="true"/><span>{caseId} · {engine.engine}</span><ChevronDown size={14} aria-hidden="true"/><span className="sr-only">{t.context}</span></summary>
    <AIChatIdentity capabilities={aiCapabilities} locale={locale} demo={demo} mode={mode}/>{hint?<p>{hint}</p>:null}{children}
  </details>;
}
