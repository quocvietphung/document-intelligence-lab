"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {ArrowLeft,ArrowRight,Compass,X} from "lucide-react";
import {pageTour,pageTourHole,pageTourPosition,type TourRect} from "@/lib/page-tour";
import type {WorkspaceTab} from "@/lib/nova-guide";

export function PageTour({locale,page,step,onStep,close,domain='banking'}:{locale:string;page:WorkspaceTab;step:number;onStep:(step:number)=>void;close:()=>void;domain?:string}) {
  const {labels,steps}=pageTour(locale,page,domain),current=steps[step];
  const currentId=current?.id,currentSelector=current?.selector;
  const card=useRef<HTMLElement>(null),heading=useRef<HTMLHeadingElement>(null);
  const [layout,setLayout]=useState<{target:TourRect|null;viewport:{width:number;height:number};card:{width:number;height:number}}>();
  const ready=Boolean(layout);
  const cardWidth=layout?.card.width,cardHeight=layout?.card.height;
  useEffect(()=>{
    if(!currentId||!ready)return;
    const before=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const frame=requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));
    return()=>{cancelAnimationFrame(frame);if(before?.isConnected)before.focus({preventScroll:true});};
  },[currentId,ready]);
  useEffect(()=>{
    if(!ready||!card.current)return;
    let frame=0;
    const resize=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      const bounds=card.current?.getBoundingClientRect();
      if(bounds)setLayout(previous=>previous&&(Math.abs(previous.card.width-bounds.width)>.5||Math.abs(previous.card.height-bounds.height)>.5)?{...previous,card:{width:bounds.width,height:bounds.height}}:previous);
    });});
    resize.observe(card.current);return()=>{resize.disconnect();cancelAnimationFrame(frame);};
  },[ready]);
  useEffect(()=>{
    if(!currentId||!currentSelector)return;
    let target:HTMLElement|null=null,scheduled=0,scrolled=false;
    const find=()=>{
      const candidate=document.querySelector<HTMLElement>(currentSelector);
      if(currentId.startsWith('menu-')&&(!candidate||!candidate.getClientRects().length))return document.querySelector<HTMLElement>('[data-page-tour="page-guide-button"]');
      if(!candidate||candidate.closest('[hidden]')||!candidate.getClientRects().length)return null;
      const bounds=candidate.getBoundingClientRect();
      if(bounds.width<1||bounds.height<1)return null;
      // The first AI Studio menu step has a visible header fallback on mobile.
      if(currentId.startsWith('menu-')&&(bounds.right<=0||bounds.left>=window.innerWidth))return document.querySelector<HTMLElement>('[data-page-tour="page-guide-button"]');
      return candidate;
    };
    const measure=()=>{
      scheduled=0;
      const next=find();
      if(next!==target){target=next;scrolled=false;}
      const reposition=Boolean(target&&!scrolled);
      if(target&&reposition){target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});scrolled=true;}
      let bounds=target?.getBoundingClientRect();
      const cardBounds=card.current?.getBoundingClientRect();
      // Re-check after focus too: browsers may center a field when it is clicked.
      // Keep a small highlighted control clear of the coachmark on every layout.
      if(bounds&&cardBounds&&bounds.height+cardBounds.height+50<=window.innerHeight){
        const below=window.innerHeight-bounds.bottom-26,above=bounds.top-26;
        const beside=Math.max(bounds.left-26,window.innerWidth-bounds.right-26);
        if(below<cardBounds.height&&above<cardBounds.height&&beside<cardBounds.width){
          window.scrollBy({top:bounds.top-24,behavior:'instant'});
          bounds=target?.getBoundingClientRect();
        }
      }
      const value={target:bounds?{left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height}:null,
        viewport:{width:window.innerWidth,height:window.innerHeight},card:{width:cardBounds?.width||340,height:cardBounds?.height||260}};
      setLayout(previous=>JSON.stringify(previous)===JSON.stringify(value)?previous:value);
    };
    const schedule=()=>{if(!scheduled)scheduled=requestAnimationFrame(measure);};
    const observer=new MutationObserver(schedule);
    observer.observe(document.querySelector('.workspace-shell')||document.body,{childList:true,subtree:true});
    const resize=new ResizeObserver(schedule);
    resize.observe(document.documentElement);if(card.current)resize.observe(card.current);
    window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);
    schedule();
    return()=>{observer.disconnect();resize.disconnect();window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);if(scheduled)cancelAnimationFrame(scheduled);};
  },[currentId,currentSelector,cardWidth,cardHeight]);
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!document.querySelector('.modal-backdrop')){event.preventDefault();close();}};
    window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
  },[close]);
  if(!current||!layout)return null;
  const hole=layout.target?pageTourHole(layout.target,layout.viewport):null;
  const position=pageTourPosition(layout.target,layout.card,layout.viewport);
  const shades=hole?[
    {left:0,top:0,width:'100%',height:hole.top},
    {left:0,top:hole.top,width:hole.left,height:hole.height},
    {left:hole.left+hole.width,top:hole.top,right:0,height:hole.height},
    {left:0,top:hole.top+hole.height,width:'100%',bottom:0},
  ]:[{inset:0}];
  return createPortal(<div className="page-tour-layer" data-tour-page={page}>
    {shades.map((shade,index)=><div key={index} className="page-tour-shade" style={shade} aria-hidden="true"/>)}
    {hole?<div className="page-tour-spotlight" style={hole} aria-hidden="true"/>:null}
    <section ref={card} className="page-tour-coach" style={{...position,maxHeight:Math.max(100,layout.viewport.height-24)}} role="dialog" aria-modal="false" aria-labelledby="page-tour-title" aria-describedby="page-tour-body">
      <header><span><Compass size={16}/>{labels.title}</span><button type="button" onClick={close} aria-label={labels.close}><X size={18}/></button></header>
      <p className="page-tour-count">{labels.step} {step+1} / {steps.length}</p>
      <div className="page-tour-copy"><h2 id="page-tour-title" ref={heading} tabIndex={-1}>{current.title}</h2><p id="page-tour-body">{current.body}</p>{!layout.target?<p className="page-tour-missing" role="status">{labels.missing}</p>:null}</div>
      <footer><div><button type="button" className="button-secondary" disabled={step===0} onClick={()=>onStep(step-1)}><ArrowLeft size={14}/>{labels.back}</button><button type="button" className="button-primary" onClick={()=>step===steps.length-1?close():onStep(step+1)}>{step===steps.length-1?labels.finish:labels.next}<ArrowRight size={14}/></button></div><button type="button" className="button-link" onClick={close}>{labels.skip}</button><small>{labels.note}</small></footer>
    </section>
  </div>,document.body);
}
