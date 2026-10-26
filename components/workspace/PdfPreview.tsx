"use client";
import {useEffect,useRef,useState} from "react";
import {ChevronLeft,ChevronRight,ZoomIn,ZoomOut,RefreshCw} from "lucide-react";
import type {PDFDocumentLoadingTask,PDFDocumentProxy,RenderTask} from "pdfjs-dist";
import {documentText} from "@/lib/document-language";
import {uniqueTextRegion} from "@/lib/pdf-evidence";
import {trustText} from "@/lib/nova-trust-language";
import {textOccurrenceRegions,type PixelRegion} from '@/lib/pdf-evidence';
import {inspectionText,providerRegionBox,type EvidenceSelection} from '@/lib/evidence-inspection';

/** Fetch once with the caller's JWT; render locally. No bearer token in URL or persistent cache. */
export function PdfPreview({url,token,locale,requestedPage=1,highlightText,selection,answerText,onPageChange}:{url:string;token?:string;locale:string;requestedPage?:number;highlightText?:string;selection?:EvidenceSelection;answerText?:string;onPageChange?:(page:number)=>void}) {
  const t=documentText(locale),canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null);
  const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null),[page,setPage]=useState(1),[zoom,setZoom]=useState(1),[width,setWidth]=useState(360),[failed,setFailed]=useState(false),[rendered,setRendered]=useState(false),[retry,setRetry]=useState(0);
  const [region,setRegion]=useState<ReturnType<typeof uniqueTextRegion>>();
  const labels=inspectionText(locale),cropCanvas=useRef<HTMLCanvasElement>(null);
  const [locations,setLocations]=useState<{key:string;boxes:PixelRegion[];provider:boolean}>();
  const [picked,setPicked]=useState<{key:string;index:number}>();
  const evidenceKey=JSON.stringify([page,zoom,width,selection?.sourceId,selection?.region?.id,selection?.ocrText,selection?.value,selection?.canonicalBox]);
  const matches=locations?.key===evidenceKey?locations.boxes:[];
  const chosen=matches.length===1?matches[0]:picked?.key===evidenceKey?matches[picked.index]:undefined;
  function changePage(number:number){setPage(number);onPageChange?.(number);}
  useEffect(()=>{
    let disposed=false;let task:PDFDocumentLoadingTask|undefined;const abort=new AbortController();
    const timer=window.setTimeout(()=>{void (async()=>{
      setFailed(false);setPdf(null);setRendered(false);
      try {
        const response=await fetch(url,{headers:token?{Authorization:`Bearer ${token}`}:{},cache:"no-store",signal:abort.signal});
        if(!response.ok)throw new Error();
        const bytes=await response.arrayBuffer();
        if(bytes.byteLength>3_000_000||new TextDecoder().decode(bytes.slice(0,4))!=="%PDF")throw new Error();
        const engine=await import("pdfjs-dist");
        if(disposed)return;
        const assets=`/pdfjs/${engine.version}/`;
        engine.GlobalWorkerOptions.workerSrc=assets+"pdf.worker.min.mjs";
        task=engine.getDocument({data:new Uint8Array(bytes),standardFontDataUrl:assets+"standard_fonts/",cMapUrl:assets+"cmaps/",wasmUrl:assets+"wasm/",iccUrl:assets+"iccs/",enableXfa:false,maxImageSize:6_000_000,verbosity:0});
        const result=await task.promise;
        if(disposed){void task.destroy().catch(()=>{});return;}
        setPdf(result);setPage(1);
      } catch {if(!disposed)setFailed(true);}
    })();},0);
    return()=>{disposed=true;clearTimeout(timer);abort.abort();void task?.destroy().catch(()=>{});};
  },[url,token,retry]);
  useEffect(()=>{
    const node=container.current;if(!node)return;
    const observer=new ResizeObserver(entries=>setWidth(Math.max(200,entries[0].contentRect.width-20)));
    observer.observe(node);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!pdf)return;
    const timer=window.setTimeout(()=>setPage(Math.min(pdf.numPages,Math.max(1,requestedPage))),0);
    return()=>clearTimeout(timer);
  },[pdf,requestedPage]);
  useEffect(()=>{
    if(!pdf)return;let disposed=false;let render:RenderTask|undefined;
    void (async()=>{
      try {
        const source=await pdf.getPage(page);const node=canvas.current;
        if(disposed||!node)return;
        setRendered(false);
        const viewport=source.getViewport({scale:width/source.getViewport({scale:1}).width*zoom});
        const density=Math.min(window.devicePixelRatio||1,1.5);
        node.width=Math.ceil(viewport.width*density);node.height=Math.ceil(viewport.height*density);
        node.style.width=`${viewport.width}px`;node.style.height=`${viewport.height}px`;
        render=source.render({canvas:node,viewport,transform:[density,0,0,density,0,0],annotationMode:0});
        await render.promise;
        if(!disposed){
          setRendered(true);setRegion(undefined);
          if(selection&&selection.page===page){
            if(selection.canonicalBox){
              const [left,top,right,bottom]=selection.canonicalBox;
              setLocations({key:evidenceKey,boxes:[{left:left*viewport.width,top:top*viewport.height,width:(right-left)*viewport.width,height:(bottom-top)*viewport.height}],provider:false});
            }else{
            const observed=selection.region?[selection.region]:(selection.candidates||[]);
            const boxes=observed.map(r=>providerRegionBox(r,source.view,source.rotate,b=>[...viewport.convertToViewportPoint(b[0],b[1]),...viewport.convertToViewportPoint(b[2],b[3])])).filter((r):r is PixelRegion=>Boolean(r));
            if(observed.length){setLocations({key:evidenceKey,boxes:boxes.length===observed.length?boxes:[],provider:true});}
            else {const text=await source.getTextContent();if(!disposed)setLocations({key:evidenceKey,boxes:textOccurrenceRegions(text.items,selection.value,(x,y)=>viewport.convertToViewportPoint(x,y)).filter(b=>b.left>=0&&b.top>=0&&b.width>0&&b.height>0&&b.left+b.width<=viewport.width+1&&b.top+b.height<=viewport.height+1),provider:false});}
            }
          }
          if(highlightText)try{
            const text=await source.getTextContent();
            if(!disposed)setRegion(uniqueTextRegion(text.items,highlightText,box=>[
              ...viewport.convertToViewportPoint(box[0],box[1]),
              ...viewport.convertToViewportPoint(box[2],box[3])
            ]));
          }catch{/* A missing text region must not hide an otherwise readable PDF. */}
        }
      } catch {if(!disposed)setFailed(true);}
    })();
    return()=>{disposed=true;render?.cancel();};
  },[pdf,page,zoom,width,highlightText,selection,evidenceKey]);
  useEffect(()=>{
    const node=canvas.current,target=cropCanvas.current;
    if(!rendered||!chosen||!node||!target)return;
    const ratio=node.width/parseFloat(node.style.width),padding=8;
    const x=Math.max(0,(chosen.left-padding)*ratio),y=Math.max(0,(chosen.top-padding)*ratio);
    const w=Math.min(node.width-x,(chosen.width+padding*2)*ratio),h=Math.min(node.height-y,(chosen.height+padding*2)*ratio);
    if(w<=0||h<=0)return;
    target.width=Math.ceil(w);target.height=Math.ceil(h);
    target.getContext('2d')?.drawImage(node,x,y,w,h,0,0,w,h);
  },[chosen,rendered,zoom,width]);
  return <section className="pdf-preview" aria-label={t("pdf")}>
    <div className="pdf-controls"><button type="button" className="icon-button" aria-label={t("previous")} disabled={!pdf||page<=1} onClick={()=>changePage(page-1)}><ChevronLeft size={17}/></button><span>{t("page")} {pdf?`${page} / ${pdf.numPages}`:"—"}</span><button type="button" className="icon-button" aria-label={t("next")} disabled={!pdf||page>=pdf.numPages} onClick={()=>changePage(page+1)}><ChevronRight size={17}/></button><button type="button" className="icon-button" aria-label={t("zoomOut")} disabled={zoom<=0.75} onClick={()=>setZoom(v=>v-0.25)}><ZoomOut size={17}/></button><button type="button" className="icon-button" aria-label={t("zoomIn")} disabled={zoom>=2} onClick={()=>setZoom(v=>v+0.25)}><ZoomIn size={17}/></button></div>
    <div ref={container} className="pdf-canvas-wrap">{failed?<div className="pdf-state" role="alert"><p>{t("failed")}</p><button className="button-secondary" onClick={()=>setRetry(v=>v+1)}><RefreshCw size={16}/>{t("retry")}</button></div>:<>{!rendered?<p className="pdf-state" role="status">{t("loading")}</p>:null}<div className="pdf-evidence-canvas"><canvas ref={canvas} aria-label={`${t("pdf")} · ${t("page")} ${page}`}/>{(selection?chosen:region)&&rendered?<span className="pdf-evidence-region" aria-label={trustText(locale).region} style={selection?chosen:region}/>:null}</div></>}</div>
    {selection&&page===selection.page?<section className="evidence-comparison" aria-label={labels.title}>
      <h3>{labels.title}</h3><p>{labels.hint}</p>
      {matches.length>1?<label>{labels.choose}<select value={picked?.key===evidenceKey?picked.index:''} onChange={e=>setPicked({key:evidenceKey,index:Number(e.target.value)})}><option value="" disabled>{labels.choose}</option>{matches.map((_,i)=><option value={i} key={i}>{labels.occurrence} {i+1} / {matches.length}</option>)}</select></label>:null}
      <p role="status">{selection.inspectionMethod?`${selection.inspectionMethod} · ${labels.manual}`:!chosen?(matches.length>1?labels.ambiguous:labels.missing):locations?.provider?labels.location:labels.textLayer}</p>
      {matches.length>1&&chosen?<p>{labels.manual}</p>:null}
      <div className="evidence-comparison-grid"><section><h4>{labels.crop}</h4><canvas ref={cropCanvas} hidden={!chosen||!rendered||failed} aria-label={labels.crop}/>{!chosen?<p>{labels.missing}</p>:null}</section><section><h4>{labels.ocr}</h4><pre>{selection.ocrText}</pre><code>{selection.sourceId}</code>{selection.tableContext?<p>{labels.context}: {selection.tableContext}</p>:null}</section><section><h4>{labels.answer}</h4><pre>{answerText||selection.value}</pre>{!answerText?<small>{labels.noAnswer}</small>:null}</section></div>
    </section>:null}
    {highlightText&&rendered?<p className="pdf-render-status" role="status">{region?trustText(locale).region:trustText(locale).regionMissing}</p>:null}
    {rendered&&!failed?<p className="pdf-render-status" role="status">{t("rendered")} · {Math.round(zoom*100)}%</p>:null}
  </section>;
}
