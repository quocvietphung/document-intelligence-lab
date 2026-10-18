"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {useAuth} from "@/components/auth/KeycloakProvider";
import type {CreditDocument} from "@/lib/credit-data";
import {platformSchema} from "@/lib/platform";
import {legacyPayroll} from "@/lib/datev-reference";
import {activeDocumentJob,completedJobDocument,documentUi,latestDocumentJobs,orderedResultDocuments,sampleDocumentJob,type DocumentJob,type DocumentImportOutcome} from "@/lib/document-results";
import {DocumentResults} from "./DocumentResults";
import {PayrollSamples} from "./PayrollSamples";
import {ResearchSamples} from "./ResearchSamples";
import {domainOf,type DocumentDomain} from "@/lib/document-domains";

export function DocumentAnalysisWorkspace({caseId,documents,locale,busy,canImport,azure,importSample,refreshCase,open,ask,technical,showPayroll=true,domain='banking'}:{
  caseId:string;documents:readonly CreditDocument[];locale:string;busy:boolean;canImport:boolean;azure:boolean;
  importSample:(file:string)=>Promise<DocumentImportOutcome>;refreshCase:()=>Promise<void>;open:(doc:CreditDocument)=>void;ask:(question:string)=>void;technical:()=>void;showPayroll?:boolean;domain?:DocumentDomain;
}){
  const auth=useAuth(),t=documentUi(locale),demo=auth.mode==="demo";
  const [jobs,setJobs]=useState<DocumentJob[]>([]),[loading,setLoading]=useState(!demo),[statusError,setStatusError]=useState(false),[importError,setImportError]=useState("");
  const [notice,setNotice]=useState<"accepted"|"duplicate">(),[watched,setWatched]=useState<string>(),[importing,setImporting]=useState(false);
  const life=useRef<AbortController|null>(null),pending=useRef<Promise<DocumentJob[]|undefined>|null>(null),seen=useRef(new Set<string>()),accepting=useRef(false);
  const root=`/api/cases/${encodeURIComponent(caseId)}/platform`;
  const load=useCallback(async():Promise<DocumentJob[]|undefined>=>{
    if(demo){setLoading(false);return [];}
    if(pending.current)return pending.current;
    const signal=life.current?.signal;
    const task=(async()=>{
      setLoading(true);
      try{
        const response=await fetch(root,{headers:{Authorization:`Bearer ${auth.token}`},cache:"no-store",signal});
        if(!response.ok)throw new Error();
        const data=platformSchema.parse(await response.json());if(data.caseId!==caseId)throw new Error();
        if(signal?.aborted)return undefined;
        setJobs(data.jobs);setStatusError(false);return data.jobs;
      }catch{if(!signal?.aborted)setStatusError(true);return undefined;}
      finally{if(!signal?.aborted)setLoading(false);}
    })();
    pending.current=task;
    try{return await task;}finally{if(pending.current===task)pending.current=null;}
  },[root,caseId,auth.token,demo]);
  useEffect(()=>{const controller=new AbortController();life.current=controller;pending.current=null;const timer=setTimeout(()=>void load(),0);return()=>{clearTimeout(timer);controller.abort();};},[load]);
  const unresolved=Boolean(watched&&!jobs.some(job=>job.id===watched&&["COMPLETE","FAILED","EXPIRED"].includes(job.status)));
  const active=jobs.some(activeDocumentJob)||unresolved;
  useEffect(()=>{if(!active||demo)return;const timer=setInterval(()=>void load(),3500);return()=>clearInterval(timer);},[active,demo,load]);
  useEffect(()=>{
    const completed=jobs.filter(job=>job.status==="COMPLETE"&&job.document_id&&!seen.current.has(job.id));
    completed.forEach(job=>seen.current.add(job.id));
    if(completed.some(job=>!documents.some(doc=>doc.id===job.document_id)))void refreshCase();
  },[jobs,documents,refreshCase]);
  const focusResults=useCallback(()=>{const element=document.getElementById("document-analysis-results");element?.scrollIntoView({behavior:"smooth",block:"start"});element?.focus({preventScroll:true});},[]);
  function choose(){document.getElementById(showPayroll?"datev-library":"research-library")?.scrollIntoView({behavior:"smooth",block:"start"});}
  async function analyze(file:string){
    if(accepting.current)return;accepting.current=true;setImporting(true);setImportError("");setNotice(undefined);
    const signal=life.current?.signal;
    try{
      const outcome=await importSample(file);if(signal?.aborted)return;
      if("duplicate" in outcome){
        setNotice("duplicate");const next=await load();if(signal?.aborted)return;
        const existing=next&&sampleDocumentJob(file,next);if(existing)setWatched(existing.id);
        await refreshCase();
      }else{
        setWatched(outcome.id);setNotice("accepted");
        setJobs(previous=>[{id:outcome.id,name:file,status:"QUEUED",stage:"SCAN",document_id:null,scan_result:null,error_code:null,sha256:"",createdAt:new Date().toISOString(),expiresAt:outcome.expiresAt,attempt:0},...previous.filter(job=>job.id!==outcome.id)]);
        await load();
      }
    }catch(error){if(!signal?.aborted){setImportError(error instanceof Error&&error.message==="limit"?"limit":"importError");await load();}}
    finally{accepting.current=false;if(!signal?.aborted){setImporting(false);setTimeout(()=>{if(!signal?.aborted)focusResults();},0);}}
  }
  const current=latestDocumentJobs(jobs);
  const visibleJobs=current.filter(job=>job.id===watched||activeDocumentJob(job)||job.status==="FAILED").filter(job=>!completedJobDocument(job,documents));
  const results=orderedResultDocuments(documents.filter(doc=>!legacyPayroll(doc)),jobs);
  const ready=completedJobDocument(jobs.find(job=>job.id===watched),documents);
  return <>
    {notice?<p className="document-analysis-notice" role="status">{notice==="accepted"&&ready?t.finished:t[notice]}</p>:null}
    {importError?<p className="notice-error" role="alert">{t[importError as "limit"|"importError"]}</p>:null}
    <DocumentResults payroll={showPayroll} documents={results.concat(documents.filter(doc=>doc.status==="missing"))} jobs={visibleJobs} locale={locale} loading={loading} error={statusError}
      refresh={()=>{void load();void refreshCase();}} open={open} ask={ask} choose={choose} technical={technical}/>
    {showPayroll?<PayrollSamples locale={locale} busy={busy||importing} canImport={canImport} azure={azure} importSample={analyze} jobs={jobs} documents={documents} openResult={open} showProgress={focusResults}/>:null}
    {!showPayroll?<ResearchSamples domain={domainOf(domain)} locale={locale} disabled={!canImport||busy||importing} azure={azure} analyze={analyze} jobs={jobs} documents={documents} openResult={open} showProgress={focusResults}/>:null}
  </>;
}
