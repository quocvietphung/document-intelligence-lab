"use client";
import {useEffect,useRef,type FormEvent,type ReactNode} from "react";
import {Send} from "lucide-react";
import {novaEnterAction, novaKeyboardHint} from "@/lib/nova-composer";

export function NovaComposer({id, locale, label, sendLabel, text, onChange, onSubmit, disabled = false,actions}: {
  id: string; locale: string; label: string; sendLabel: string; text: string;
  onChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; disabled?: boolean;actions?:ReactNode;
}) {
  const composing = useRef(false),input=useRef<HTMLTextAreaElement>(null);
  const enabled = !disabled && Boolean(text.trim());
  useEffect(()=>{const element=input.current;if(!element)return;element.style.height='auto';element.style.height=`${Math.min(104,Math.max(46,element.scrollHeight))}px`;},[text]);
  return <div className="nova-composer-dock">
    <form onSubmit={onSubmit} className="chat-composer">
      <label className="sr-only" htmlFor={id}>{label}</label>
      <textarea ref={input} id={id} rows={2} maxLength={2000} value={text} onChange={event => onChange(event.target.value)}
        placeholder={label} aria-describedby={`${id}-hint`}
        onCompositionStart={() => {composing.current = true;}} onCompositionEnd={() => {composing.current = false;}}
        onKeyDown={event => {
          const action = novaEnterAction({key: event.key, shiftKey: event.shiftKey, repeat: event.repeat,
            isComposing: composing.current || event.nativeEvent.isComposing, keyCode: event.nativeEvent.keyCode}, enabled);
          if (action === "newline") return;
          event.preventDefault();
          if (action === "submit") event.currentTarget.form?.requestSubmit();
        }}/>
      <button className="button-primary" disabled={!enabled} type="submit"><Send size={17}/>{sendLabel}</button>
    </form>
    <div className="nova-composer-footer"><p id={`${id}-hint`} className="nova-keyboard-hint">{novaKeyboardHint(locale)}</p>{actions?<div className="nova-chat-controls">{actions}</div>:null}</div>
  </div>;
}
