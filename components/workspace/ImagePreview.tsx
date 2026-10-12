"use client";
import {useEffect,useState} from "react";
import Image from "next/image";
import {documentText} from "@/lib/document-language";
import {rasterType} from "@/lib/raster-type";

/** Only authenticated PNG/JPEG originals; transient object URL, never a token URL. */
export function ImagePreview({url,token,locale}:{url:string;token:string;locale:string}) {
  const t=documentText(locale),[src,setSrc]=useState(""),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();let objectUrl="";let cancelled=false;
    const timer=window.setTimeout(()=>{
      setSrc("");setFailed(false);
      void (async()=>{
        try {
          const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:"no-store",signal:controller.signal});
          if(!response.ok)throw new Error();
          const blob=await response.blob();if(blob.size>3_000_000||!blob.size)throw new Error();
          const type=rasterType(new Uint8Array(await blob.slice(0,8).arrayBuffer()));if(!type)throw new Error();
          if(cancelled)return;objectUrl=URL.createObjectURL(new Blob([blob],{type}));setSrc(objectUrl);
        } catch {if(!cancelled)setFailed(true);}
      })();
    },0);
    return()=>{cancelled=true;clearTimeout(timer);controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[url,token,retry]);
  return <section className="image-original" aria-label={t("image")}>{failed?<div role="alert"><p>{t("imageFailed")}</p><button className="button-secondary" onClick={()=>setRetry(v=>v+1)}>{t("retry")}</button></div>:src?<Image unoptimized src={src} alt={t("image")} width={1000} height={1400} onError={()=>setFailed(true)}/>:<p role="status">{t("imageLoading")}</p>}</section>;
}
