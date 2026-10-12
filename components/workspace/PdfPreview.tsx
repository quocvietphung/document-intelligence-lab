"use client";
import {useEffect,useRef,useState} from "react";
import {ChevronLeft,ChevronRight,ZoomIn,ZoomOut,RefreshCw} from "lucide-react";
import type {PDFDocumentLoadingTask,PDFDocumentProxy,RenderTask} from "pdfjs-dist";
import {documentText} from "@/lib/document-language";

/** Fetch once with the caller's JWT; render locally. No bearer token in URL or persistent cache. */
export function PdfPreview({url,token,locale,requestedPage=1}:{url:string;token?:string;locale:string;requestedPage?:number}) {
  const t=documentText(locale),canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null);
  const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null),[page,setPage]=useState(1),[zoom,setZoom]=useState(1),[width,setWidth]=useState(360),[failed,setFailed]=useState(false),[rendered,setRendered]=useState(false),[retry,setRetry]=useState(0);
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
        await render.promise;if(!disposed)setRendered(true);
      } catch {if(!disposed)setFailed(true);}
    })();
    return()=>{disposed=true;render?.cancel();};
  },[pdf,page,zoom,width]);
  return <section className="pdf-preview" aria-label={t("pdf")}>
    <div className="pdf-controls"><button type="button" className="icon-button" aria-label={t("previous")} disabled={!pdf||page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={17}/></button><span>{t("page")} {pdf?`${page} / ${pdf.numPages}`:"—"}</span><button type="button" className="icon-button" aria-label={t("next")} disabled={!pdf||page>=pdf.numPages} onClick={()=>setPage(p=>p+1)}><ChevronRight size={17}/></button><button type="button" className="icon-button" aria-label={t("zoomOut")} disabled={zoom<=0.75} onClick={()=>setZoom(v=>v-0.25)}><ZoomOut size={17}/></button><button type="button" className="icon-button" aria-label={t("zoomIn")} disabled={zoom>=2} onClick={()=>setZoom(v=>v+0.25)}><ZoomIn size={17}/></button></div>
    <div ref={container} className="pdf-canvas-wrap">{failed?<div className="pdf-state" role="alert"><p>{t("failed")}</p><button className="button-secondary" onClick={()=>setRetry(v=>v+1)}><RefreshCw size={16}/>{t("retry")}</button></div>:<>{!rendered?<p className="pdf-state" role="status">{t("loading")}</p>:null}<canvas ref={canvas} aria-label={`${t("pdf")} · ${t("page")} ${page}`}/></>}</div>
    {rendered&&!failed?<p className="pdf-render-status" role="status">{t("rendered")} · {Math.round(zoom*100)}%</p>:null}
  </section>;
}
