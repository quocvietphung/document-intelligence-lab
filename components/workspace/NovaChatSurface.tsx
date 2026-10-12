"use client";
import React, {useRef, type ReactNode} from "react";
import {MessageSquareText, Minus, Sparkles} from "lucide-react";
import {novaWidgetText} from "@/lib/nova-widget-language";

export function NovaChatSurface({title, locale, open, onOpen, close, children}: {
  title: string; locale: string; open: boolean; onOpen: () => void;
  close: () => void; children?: ReactNode;
}) {
  const t = novaWidgetText(locale);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  function minimize() {close(); launcher.current?.focus();}
  function toggle() {
    if (open) {minimize(); return;}
    onOpen();
    requestAnimationFrame(() => panel.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus());
  }
  return <React.Fragment>
    <aside className="nova-widget" aria-label={title}>
      <section ref={panel} id="nova-chat-panel" className="nova-chat-panel" role="dialog"
        aria-modal="false" aria-labelledby="nova-chat-title" hidden={!open}
        onKeyDown={event => {if (event.key === "Escape") {event.stopPropagation(); minimize();}}}>
        <header className="nova-chat-header">
          <span className="nova-chat-avatar" aria-hidden="true"><Sparkles size={21}/></span>
          <div><h2 id="nova-chat-title">{title}</h2><p>{t.subtitle}</p></div>
          <button type="button" onClick={minimize} aria-label={t.minimize}><Minus size={20}/></button>
        </header>
        <div className="nova-chat-content">{children}</div>
      </section>
      <button ref={launcher} type="button" className="nova-chat-launcher" onClick={toggle}
        aria-expanded={open} aria-controls="nova-chat-panel" aria-label={open ? t.minimize : t.open}>
        {open ? <Minus size={21}/> : <MessageSquareText size={21}/>}<span>Nova</span>
      </button>
    </aside>
  </React.Fragment>;
}
