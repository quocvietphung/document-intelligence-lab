"use client";
import { useEffect,useRef } from "react";
import { X } from "lucide-react";
export function ModalSurface({title,close,label,children,wide=false}:{title:string;close:()=>void;label:string;children:React.ReactNode;wide?:boolean}) {
  const panel=useRef<HTMLElement>(null); const callback=useRef(close);
  useEffect(()=>{callback.current=close;},[close]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null; const overflow=document.body.style.overflow;
    document.body.style.overflow="hidden"; panel.current?.querySelector<HTMLElement>("button,input,textarea")?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==="Escape") { event.preventDefault(); callback.current(); }
      if(event.key!=="Tab") return;
      const controls=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]')||[]).filter(e=>e.getClientRects().length);
      const first=controls[0],last=controls.at(-1); const outside=!panel.current?.contains(document.activeElement);
      if(outside || (event.shiftKey&&document.activeElement===first) || (!event.shiftKey&&document.activeElement===last)) {event.preventDefault(); (event.shiftKey?last:first)?.focus();}
    };
    document.addEventListener("keydown",key);
    return()=>{document.body.style.overflow=overflow;document.removeEventListener("keydown",key);if(previous?.isConnected)previous.focus();};
  },[]);
  return <div className="modal-backdrop"><section ref={panel} role="dialog" aria-modal="true" aria-label={title} className={`modal-panel ${wide?"modal-wide":""}`}><header className="flex items-center justify-between gap-4 border-b border-slate-200 p-5"><h2 className="text-xl font-bold">{title}</h2><button type="button" className="icon-button" aria-label={label} onClick={close}><X size={20}/></button></header><div className="p-5 md:p-7">{children}</div></section></div>;
}
