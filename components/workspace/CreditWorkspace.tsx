"use client";
import {useCallback,useEffect,useMemo,useRef,useState, type FormEvent} from "react";
import {Activity,ArrowUpRight,CheckCircle2,FileSearch,ClipboardCheck,Gauge,LayoutDashboard,LogIn,Menu,MessageSquareText,Plus,RefreshCw,Search,Send,ShieldCheck,Upload,X} from "lucide-react";
import {useChat} from "@ai-sdk/react";
import {DefaultChatTransport} from "ai";
import {useAuth} from "@/components/auth/KeycloakProvider";
import {type CreditDocument} from "@/lib/credit-data";
import {publicDemoCase} from "@/lib/public-demo";
import {publicDemoText} from "@/lib/public-demo-language";
import {DemoCopilot} from "./DemoCopilot";
import {toWorkspaceCase,type WorkspaceCase} from "@/lib/credit-api";
import {workspaceText} from "@/lib/workspace-language";
import {useRouter} from "@/routing";
import {ModalSurface} from "./ModalSurface";
import {NovaChatSurface} from "./NovaChatSurface";
import {novaWidgetText} from "@/lib/nova-widget-language";
import {PlatformWorkbench} from "./PlatformWorkbench";
import {platformText} from "@/lib/platform-language";
import {FlaskConical,Layers3,GitBranch,ScanSearch} from "lucide-react";
import {BankingWorkbench} from "./BankingWorkbench";
import {bankingText} from "@/lib/banking-language";
import {WalletCards} from "lucide-react";
import {PayrollSamples} from "./PayrollSamples";
import {DocumentEvidence} from "./DocumentEvidence";
import {documentText} from "@/lib/document-language";
import {caseChatPayload,assistantModeKey} from "@/lib/credit-chat";
import {novaWelcomeMessage,welcomeSessionKey} from "@/lib/nova-welcome";
import {NovaGuideCard} from "./NovaGuideCard";
import {NovaMessageText} from "./NovaMessageText";
import {datevReference} from "@/lib/datev-reference";
import {novaGuideFor,novaGuideIntro,novaGuideLabels,workspaceTabs,workspaceTarget,type WorkspaceTab} from "@/lib/nova-guide";
import {novaLimit,novaLimitMessage,novaQuotaNotice,type NovaLimit} from "@/lib/nova-limits";
type Tab=WorkspaceTab;
const navigation=[["overview",LayoutDashboard],["studio",FlaskConical],["documents",FileSearch],["pipeline",Layers3],["controls",ScanSearch],["banking",WalletCards],["evaluation",Gauge],["operations",GitBranch],["audit",ClipboardCheck]] as const;

function Copilot({item,locale,open,onOpen,close,initialQuestion,openSource,navigate,currentTab}:{item:WorkspaceCase;locale:string;open:boolean;onOpen:()=>void;close:()=>void;initialQuestion?:string;openSource:(id:string)=>void;navigate:(tab:WorkspaceTab)=>void;currentTab:WorkspaceTab}) {
  const auth=useAuth(); const base=workspaceText(locale),d=documentText(locale); const t=(key:string)=>key==="chatReady"?d("greeting"):key==="sources"?d("sources"):base(key); const [text,setText]=useState(initialQuestion||""); const [mode,setMode]=useState<string>();
  const bottom=useRef<HTMLDivElement>(null);
  const pendingQuestion=useRef("");const [limit,setLimit]=useState<NovaLimit>();
  const transport=useMemo(()=>new DefaultChatTransport({api:"/api/chat",headers:()=>({Authorization:`Bearer ${auth.token}`}),body:{caseId:item.id,locale},fetch:async(input,init)=>{
    const response=await fetch(input,init); setMode(response.headers.get("X-AI-Mode")||undefined);
    if(response.status===429)setLimit(novaLimit(await response.clone().json().catch(()=>undefined)));
    return response;
  },prepareSendMessagesRequest:({messages})=>({body:caseChatPayload(messages,item.id,locale)})}),[auth.token,item.id,locale,setMode]);
  const {messages,sendMessage,status,error,stop,setMessages,clearError}=useChat({transport,messages:[novaWelcomeMessage(locale)],onError:()=>setText(current=>current||pendingQuestion.current)});
  const busy=status==="submitted"||status==="streaming";
  useEffect(()=>{if(open)bottom.current?.scrollIntoView({block:"nearest"});},[messages,open]);
  useEffect(()=>{if(initialQuestion===undefined)return;const timer=window.setTimeout(()=>setText(initialQuestion),0);return()=>window.clearTimeout(timer);},[initialQuestion]);
  function guide(question:string,all=false){const data=all?{features:[...workspaceTabs],query:question}:novaGuideFor(question,currentTab);if(!data)return false;clearError();setLimit(undefined);setMessages(previous=>[...previous,{id:crypto.randomUUID(),role:"user",parts:[{type:"text",text:question}]},{id:crypto.randomUUID(),role:"assistant",parts:[{type:"text",text:novaGuideIntro(locale)},{type:"data-nova-guide",data}]}]);setMode("app-guide");return true;}
  function send(event?:FormEvent) { event?.preventDefault();if(!text.trim()||busy)return;pendingQuestion.current=text.trim();clearError();setLimit(undefined);setMode(undefined);if(!guide(text.trim()))void sendMessage({text:text.trim()});setText(""); }
  return <NovaChatSurface title={t("nova")} locale={locale} open={open} onOpen={onOpen} close={close}>
    <div className="flex items-center gap-2 text-xs font-semibold text-teal-700"><ShieldCheck size={15}/>{item.id} · {t("chatHint")}</div>
    <div className="chat-history scrollbar-thin" role="log" aria-label={t("nova")}>
      {!messages.length?<div className="chat-welcome"><MessageSquareText size={32}/><h3>{t("chatReady")}</h3><button className="button-secondary" disabled={!auth.token} onClick={()=>void sendMessage({text:t("question")})}>{t("question")} <ArrowUpRight size={16}/></button></div>:messages.map(message=><article key={message.id} className={`chat-bubble ${message.role==="user"?"chat-user":"chat-assistant"}`}>
        <NovaMessageText text={message.parts.filter(p=>p.type==="text").map(p=>p.text).join("")} navigate={navigate}/>
        {message.parts.filter(p=>p.type==="data-nova-guide").map((p,i)=><NovaGuideCard key={i} guide={"data" in p?p.data:undefined} locale={locale} item={item} navigate={navigate} openSource={openSource}/>)}
        {message.parts.some(p=>p.type==="source-document")?<details className="mt-4 border-t border-slate-200 pt-3 text-xs"><summary>{t("sources")}</summary><ul className="mt-2 space-y-2">{message.parts.filter(p=>p.type==="source-document").map(p=><li key={p.sourceId}>{item.documents.some(doc=>p.sourceId.startsWith(doc.id+":"))?<button className="button-link" onClick={()=>{void stop();openSource(p.sourceId);}}>{p.title||p.sourceId} → {d("preview")}</button>:<span>{p.title||p.sourceId} <code>[{p.sourceId}]</code></span>}</li>)}</ul></details>:null}
      </article>)}
      {busy?<p className="p-3 text-sm text-slate-500" role="status">{t("loading")}</p>:null}
      {error?<p className="notice-error" role="alert">{error.message.includes("limit")?novaLimitMessage(limit,locale):t("error")}</p>:null}<div ref={bottom}/>
    </div>
    <form onSubmit={send} className="chat-composer"><label className="sr-only" htmlFor="nova-question">{t("ask")}</label><textarea id="nova-question" value={text} onChange={e=>setText(e.target.value)} maxLength={2000} placeholder={t("ask")} rows={2}/><button className="button-primary" disabled={busy||!text.trim()||!auth.token} type="submit"><Send size={17}/>{t("send")}</button></form>
    <div className="mt-3 flex flex-wrap gap-2"><button className="button-link" onClick={()=>guide(novaGuideLabels(locale).actions,true)} disabled={busy}>{novaGuideLabels(locale).actions}</button><button className="button-link" onClick={()=>{void stop();}} disabled={!busy}>{t("stop")}</button><button className="button-link" onClick={()=>{setMessages([novaWelcomeMessage(locale)]);clearError();setMode(undefined);}} disabled={busy}>{t("clear")}</button></div>
    {mode?<p className="mt-2 text-xs font-semibold text-teal-800">{mode==="app-guide"?novaGuideLabels(locale).mode:d(assistantModeKey(mode))}</p>:null}<details className="nova-disclosure mt-2"><summary>{novaWidgetText(locale).details}</summary><p>{d("singleQuestion")}</p><p>{novaQuotaNotice(locale)}</p></details>
  </NovaChatSurface>;
}

export function CreditWorkspace({locale}:{locale:string}) {
  const d=publicDemoText(locale); const baseText=workspaceText(locale); const t=(key:string)=>["studio","pipeline","controls","operations","evaluation"].includes(key)?platformText(locale)(key):key==="banking"?bankingText(locale)(key):baseText(key); const auth=useAuth();
  const router=useRouter();
  const [tab,setTab]=useState<Tab>("overview"); const [cases,setCases]=useState<WorkspaceCase[]>(()=>auth.mode==="demo"?[publicDemoCase]:[]);const [selected,setSelected]=useState("");
  useEffect(()=>{const sync=()=>{const target=workspaceTarget(window.location.hash);if(target)setTab(target);};const timer=window.setTimeout(sync,0);window.addEventListener("hashchange",sync);window.addEventListener("popstate",sync);return()=>{window.clearTimeout(timer);window.removeEventListener("hashchange",sync);window.removeEventListener("popstate",sync);};},[]);
  function navigate(id:WorkspaceTab){if(!workspaceTabs.includes(id))return;setTab(id);setMenu(false);window.history.pushState(null,"",`#${id}`);window.scrollTo({top:0,behavior:"instant"});}
  const [loading,setLoading]=useState(false); const [error,setError]=useState("");const [success,setSuccess]=useState(false);
  const [analysis,setAnalysis]=useState<{mode:string;maxPages:number}|null>(null);
  const [query,setQuery]=useState("");const [menu,setMenu]=useState(false);const [chat,setChat]=useState(false);
  const [chatQuestion,setChatQuestion]=useState<string>();
  const [editor,setEditor]=useState<"new"|"edit"|null>(null);const [inspected,setInspected]=useState<CreditDocument|null>(null);const [reviewValues,setReviewValues]=useState<string[]>([]);const [busy,setBusy]=useState(false);
  const inputFile=useRef<HTMLInputElement>(null);
  const sampleInFlight=useRef(false);
  const writeInFlight=useRef(false);
  const [uploading,setUploading]=useState(false);
  const item=auth.authenticated?(cases.find(c=>c.id===selected)||cases[0]):undefined;
  const welcomeKey=welcomeSessionKey(auth),hasCase=Boolean(item);
  const welcomedSession=useRef<string|undefined>(undefined);
  useEffect(()=>{
    if(!welcomeKey){welcomedSession.current=undefined;return;}
    if(!hasCase||welcomedSession.current===welcomeKey)return;
    // Set the marker inside the timer so StrictMode cleanup cannot swallow the greeting.
    const timer=window.setTimeout(()=>{welcomedSession.current=welcomeKey;setChat(true);},0);
    return()=>window.clearTimeout(timer);
  },[welcomeKey,hasCase]);
  const Chat=auth.mode==="demo"?DemoCopilot:Copilot;
  const canWrite=auth.mode==="keycloak"&&auth.roles.some(r=>r==="ADVISOR"||r==="ADMIN");
  const canReview=auth.roles.some(r=>r==="REVIEWER"||r==="ADMIN");
  const refresh=useCallback(async(signal?:AbortSignal)=>{
    if(!auth.ready||!auth.authenticated)return;
    if(auth.mode==="demo") {setCases([publicDemoCase]);setAnalysis(null);setLoading(false);return;}
    setLoading(true);setError("");
    try {
      const response=await fetch("/api/cases",{headers:{Authorization:`Bearer ${auth.token}`},cache:"no-store",signal});
      if(!response.ok)throw new Error("Unavailable");
      const json=await response.json(); if(!Array.isArray(json))throw new Error("Invalid API response");
      setCases(json.map(toWorkspaceCase));
      try {
        const statusResponse=await fetch("/api/cases/document-analysis/status",{headers:{Authorization:`Bearer ${auth.token}`},cache:"no-store",signal});
        if(statusResponse.ok) {
          const result=await statusResponse.json();
          if(typeof result.mode==="string"&&Number.isInteger(result.maxPages)&&result.maxPages>=1&&result.maxPages<=4)
            setAnalysis({mode:result.mode,maxPages:result.maxPages});
        } else if(!signal?.aborted) setAnalysis(null);
      } catch { if(!signal?.aborted) setAnalysis(null); }
    } catch {if(!signal?.aborted){setError("error");setCases([]);}} finally {if(!signal?.aborted)setLoading(false);}
  },[auth.ready,auth.authenticated,auth.mode,auth.token]);
  useEffect(()=>{
    const controller=new AbortController();
    const run=()=>void refresh(controller.signal);
    const task=window.setTimeout(run,0);
    return()=>{window.clearTimeout(task);controller.abort();};
  },[refresh]);
  function select(id:string) {if(writeInFlight.current||sampleInFlight.current)return;setSelected(id);setInspected(null);setEditor(null);setChat(false);setChatQuestion(undefined);setSuccess(false);setError("");}
  async function request(path:string,method:string,body:BodyInit,isForm=false) {
    if(writeInFlight.current)return;writeInFlight.current=true;setBusy(true);setError("");setSuccess(false);
    try {
      const response=await fetch(path,{method,headers:{Authorization:`Bearer ${auth.token}`,...(isForm?{}:{"Content-Type":"application/json"})},body});
      if(!response.ok) {setError(response.status===409?"conflict":response.status===429?"limit":response.status===422?"fileRejected":"error");return;}
      const updated=toWorkspaceCase(await response.json());
      setCases(list=>list.some(c=>c.id===updated.id)?list.map(c=>c.id===updated.id?updated:c):[...list,updated]);
      setSelected(updated.id);setInspected(null);setEditor(null);setSuccess(true);
    } catch {setError("error");} finally {writeInFlight.current=false;setBusy(false);}
  }
  async function uploadFile(file:File) {
    if(!item||writeInFlight.current||!canWrite)return;
    const supported=analysis&&analysis.mode!=="local"?/\.(pdf|png|jpe?g)$/i:/\.(pdf|png|jpe?g|txt)$/i;
    if(!file.size||file.size>3_000_000||!supported.test(file.name)){setError("fileRejected");return;}
    const form=new FormData();form.set("file",file);form.set("version",String(item.version||0));
    setUploading(true);
    try {await request(`/api/cases/${item.id}/documents`,"POST",form,true);} finally {setUploading(false);}
  }
  async function uploadSample(fileName:string) {
    if(!item||busy||!canWrite||sampleInFlight.current)return;
    sampleInFlight.current=true;setBusy(true);setError("");setSuccess(false);
    try {
      const reference=datevReference(fileName);if(!reference)throw new Error("Unknown reference");
      const response=await fetch(`/api/payroll-references?sample=${reference.id}`,{headers:{Authorization:`Bearer ${auth.token}`},cache:"no-store"});
      if(!response.ok)throw new Error("Sample unavailable");
      const form=new FormData();form.set("file",new File([await response.blob()],fileName,{type:"application/pdf"}));
      // Queue first: extraction can exceed the proxy timeout. Pipeline polls the durable job.
      const queued=await fetch(`/api/cases/${item.id}/platform/jobs`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`},body:form,signal:AbortSignal.timeout(20_000)});
      if(!queued.ok){setError(queued.status===409?"conflict":queued.status===429?"limit":"error");return;}
      const job=await queued.json();if(typeof job.id!=="string"||job.status!=="QUEUED")throw new Error("Invalid job");
      navigate("pipeline");
    } catch {setError("error");} finally {sampleInFlight.current=false;setBusy(false);}
  }
  function saveDraft(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const data=new FormData(event.currentTarget);
    const body=JSON.stringify({applicant:data.get("applicant"),coApplicant:data.get("coApplicant"),purpose:data.get("purpose"),amountEuro:Number(data.get("amountEuro")),version:item?.version||0});
    void request(editor==="new"?"/api/cases":`/api/cases/${item!.id}`,editor==="new"?"POST":"PATCH",body);
  }
  function inspect(doc:CreditDocument) {setInspected(doc);setReviewValues((doc.fields||[]).map(f=>f.value));setError("");}
  async function original(doc:CreditDocument) {
    if(!item)return;
    try {const response=await fetch(`/api/cases/${item.id}/documents/${doc.id}/original`,{headers:{Authorization:`Bearer ${auth.token}`}});if(!response.ok)throw new Error();
      const url=URL.createObjectURL(await response.blob());const anchor=document.createElement("a");anchor.href=url;anchor.download=doc.name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch {setError("error");}
  }
  const status=(c:WorkspaceCase)=>t(c.status==="DRAFT"?"draft":c.status==="REVIEW_COMPLETE"?"complete":"humanReview");
  const shown=cases.filter(c=>`${c.applicant} ${c.id}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="workspace-shell">
    <aside className={`workspace-sidebar ${menu?"sidebar-open":""}`}><a href={`/${locale}`} className="brand"><span className="brand-icon"><Activity size={23}/></span><span>Credit Intelligence<small>{t("lab")}</small></span></a>
      <button className="icon-button sidebar-close" onClick={()=>setMenu(false)} aria-label={t("close")}><X/></button>
      <div className="mt-10 space-y-2">{navigation.map(([id,Icon])=><button key={id} className={`nav-button ${tab===id?"nav-active":""}`} aria-current={tab===id?"page":undefined} onClick={()=>navigate(id)}><Icon size={19}/>{t(id)}</button>)}</div>
      <div className="sidebar-footer"><ShieldCheck size={22}/><strong>{auth.mode==="demo"?d("badge"):t("security")}</strong><p>{t("notice")}</p><label htmlFor="workspace-language">{t("language")}</label><select id="workspace-language" value={locale} onChange={event=>router.replace("/",{locale:event.target.value})}><option value="en">English</option><option value="de">Deutsch</option><option value="vi">Tiếng Việt</option></select></div>
    </aside>
    <main className="workspace-main"><header className="workspace-header"><div className="flex items-center gap-3"><button className="icon-button mobile-menu" onClick={()=>setMenu(true)} aria-label={t("workspace")}><Menu size={21}/></button><span className="text-sm font-semibold">{t("workspace")}</span></div><div className="flex items-center gap-3"><span className="hidden text-xs text-slate-500 sm:inline">{auth.authenticated?auth.displayName:t("noSession")}</span>{auth.mode==="demo"?<span className="lab-badge">{d("badge")}</span>:<button className="button-secondary" disabled={!auth.ready} onClick={auth.authenticated&&auth.mode==="keycloak"?auth.logout:auth.login}><LogIn size={16}/>{t(auth.authenticated&&auth.mode==="keycloak"?"signOut":"signIn")}</button>}</div></header>
      <div className="workspace-content"><div className="notice-lab"><ShieldCheck size={17}/>{auth.mode==="demo"?d("notice"):t("notice")}</div>
        {!["studio","pipeline","controls","operations","evaluation"].includes(tab)?<section className="workspace-hero"><div><p className="eyebrow">{t(tab)}</p><h1>{t("welcome")}</h1><p>{t("subtitle")}</p></div><div className="hero-mark" aria-hidden="true"><FileSearch size={55}/><span>01 / AI LAB</span></div></section>:null}
        {auth.error?<p className="notice-error" role="alert">{t("error")}</p>:null}
        {!auth.authenticated?<section className="surface p-8"><h2 className="text-lg font-bold">{t("noSession")}</h2><p className="my-4 text-sm leading-relaxed text-slate-600">{t("publicLogin")}</p><button className="button-primary" onClick={auth.login} disabled={!auth.ready}>{t(auth.ready?"signIn":"loading")}</button></section>:<>
          <div className="case-toolbar"><div className="search-input"><Search size={17}/><input aria-label={t("search")} placeholder={t("search")} value={query} onChange={e=>setQuery(e.target.value)}/></div><button className="button-secondary" disabled={loading||busy} onClick={()=>void refresh()}><RefreshCw size={16}/>{t("refresh")}</button><button className="button-primary" disabled={!canWrite||busy} onClick={()=>{setEditor("new");setError("");}}><Plus size={17}/>{t("newCase")}</button></div>
          {error?<p className="notice-error" role="alert">{t(error)}</p>:null}{success?<p className="notice-success" role="status">{t("saved")}</p>:null}
          {loading?<p className="p-4" role="status">{t("loading")}</p>:<div className="case-strip" aria-label={t("selectCase")}>{shown.map(c=><button key={c.id} className={`case-card ${item?.id===c.id?"case-selected":""}`} aria-pressed={item?.id===c.id} onClick={()=>select(c.id)}><small>{c.id}</small><strong>{c.applicant}</strong><span>{status(c)}</span></button>)}{!shown.length?<p className="p-4 text-slate-600">{t("noCases")}</p>:null}</div>}
          {item?<><div className="selected-heading"><div><span className="eyebrow">{item.id} · {t("version")} {item.version||0}</span><h2>{item.applicant}</h2><p>{item.purpose} · {item.amount}</p></div><div className="flex flex-wrap gap-2"><button className="button-secondary" disabled={!canWrite||busy} onClick={()=>setEditor("edit")}>{t("editCase")}</button><button className="button-primary" onClick={()=>setChat(true)} disabled={!auth.authenticated}><MessageSquareText size={17}/>{t("askNova")}</button></div></div>
            {tab==="overview"?<><div className="metrics-grid">{[[t("progress"),`${item.progress}%`],[t("documentsCount"),item.documents.filter(d=>d.status!=="missing").length],[t("issues"),item.issues.length]].map(([label,value])=><div className="surface metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><section className="surface p-6"><h3 className="section-heading">{t("issues")}</h3>{item.issues.length?item.issues.map((issue,i)=><div className="review-item" key={i}><span className="review-dot"/><div><strong>{t(issue.title.includes("Missing")?"missingDocument":issue.title.replaceAll(" ","_"))}</strong><p>{t(issue.detail)}</p></div><button className="button-link" onClick={()=>{const doc=item.documents.find(d=>d.id===issue.documentId);if(doc)inspect(doc);else setTab("documents");}}>{t("inspect")} →</button></div>):<p className="mt-4 text-slate-500">{t("noIssues")}</p>}</section></>:null}
            {tab==="documents"?<section className="surface"><header className="section-toolbar"><div><h3 className="section-heading">{t("documents")}</h3><p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-500">{analysis&&analysis.mode!=="local"?t("uploadHintAzure").replace("{pages}",String(analysis.maxPages)):t("uploadHint")}</p></div><input ref={inputFile} type="file" className="hidden" accept={analysis&&analysis.mode!=="local"?".pdf,.png,.jpg,.jpeg":".pdf,.png,.jpg,.jpeg,.txt"} onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(file)uploadFile(file);}}/><div className="flex flex-wrap gap-2"><button className="button-secondary" disabled={!canWrite||busy} onClick={()=>document.getElementById("datev-library")?.scrollIntoView({behavior:"smooth",block:"start"})}><FileSearch size={16}/>{t("uploadSample")}</button><button className="button-primary" disabled={!canWrite||busy} onClick={()=>inputFile.current?.click()}><Upload size={16}/>{t(busy?"loading":"upload")}</button></div></header>
              {uploading?<p className="notice-lab notice-processing" role="status" aria-live="polite">{documentText(locale)("processing")}</p>:null}
              <p className="px-6 py-3 text-xs leading-relaxed text-slate-600">{documentText(locale)("policy")}</p>
              <PayrollSamples locale={locale} busy={busy} canImport={canWrite&&!!analysis} azure={!!analysis&&analysis.mode!=="local"} importSample={file=>uploadSample(file)}/>
              {item.documents.map(doc=><div className="document-row" key={doc.id}><div className="document-icon"><FileSearch size={21}/></div><div className="min-w-0 flex-1"><strong className="block truncate">{doc.name}</strong><span className="text-xs text-slate-500">{t(doc.type)} · {!doc.originalAvailable?t("fixture"):t(doc.status)}</span></div>{doc.confidence!=null?<span className="text-xs">{t("ocrConfidence")}: {doc.confidence}%</span>:null}<button className="button-secondary" onClick={()=>inspect(doc)}>{t("inspect")}</button></div>)}{!item.documents.length?<p className="p-7 text-slate-500">{t("noDocuments")}</p>:null}</section>:null}
            {(["studio","pipeline","controls","operations","evaluation"] as string[]).includes(tab)?<PlatformWorkbench key={item.id} caseId={item.id} locale={locale} view={tab as "studio"|"pipeline"|"controls"|"operations"|"evaluation"} changed={refresh} ask={question=>{setChatQuestion(question);setChat(true);}} inspect={id=>{const doc=item.documents.find(d=>d.id===id);if(doc)inspect(doc);else setTab("documents");}}/>:null}
            {tab==="audit"?<section className="surface p-6"><h3 className="section-heading">{t("activity")}</h3><div className="overflow-x-auto"><table className="audit-table"><thead><tr><th>{t("time")}</th><th>{t("event")}</th><th>{t("actor")}</th></tr></thead><tbody>{item.audit.toReversed().map(([time,event,actor],i)=><tr key={i}><td>{time}</td><td>{t(event)}</td><td><code>{actor}</code></td></tr>)}</tbody></table></div></section>:null}
          </>:null}</>}
        {tab==="banking"&&item?<BankingWorkbench key={item.id} caseId={item.id} locale={locale} ask={question=>{setChatQuestion(question);setChat(true);}}/>:null}
        <footer className="mt-8 border-t border-slate-200 pt-5 text-xs leading-relaxed text-slate-500">{auth.mode==="demo"?d("badge"):t(canWrite?"labWrites":"readonly")}</footer>
      </div>
    </main>
    {editor&&auth.authenticated?<ModalSurface title={t(editor==="new"?"newCase":"editCase")} label={t("close")} close={()=>{if(!busy)setEditor(null);}}><form key={editor} onSubmit={saveDraft} className="draft-form">{[["applicant","applicant",editor==="edit"?item?.applicant:""],["purpose","purpose",editor==="edit"?item?.purpose:""],["coApplicant","coApplicant",editor==="edit"?item?.coApplicant:""]].map(([name,label,value])=><label key={name}>{t(label!)}<input name={name} required={name!=="coApplicant"} maxLength={name==="purpose"?160:120} defaultValue={value}/></label>)}<label>{t("amount")}<input type="number" name="amountEuro" min={1} max={10000000} step={1} required defaultValue={editor==="edit"?item?.amountEuro:10000}/></label>{error?<p className="notice-error" role="alert">{t(error)}</p>:null}<div className="flex justify-end gap-2"><button type="button" className="button-secondary" disabled={busy} onClick={()=>setEditor(null)}>{t("cancel")}</button><button className="button-primary" disabled={busy}>{t(busy?"loading":"save")}</button></div></form></ModalSurface>:null}
    {inspected&&item?<ModalSurface wide title={inspected.name} label={t("close")} close={()=>{if(!busy)setInspected(null);}}><p className="notice-lab">{inspected.originalAvailable?documentText(locale)("review"):t("fixture")} · {inspected.analysisProvider||"local"} · {inspected.modelId||"transparent-rules"}</p><DocumentEvidence key={inspected.id} doc={inspected} caseId={item.id} locale={locale} editable={canReview&&!!inspected.originalAvailable&&!busy} values={reviewValues} onChange={(index,value)=>setReviewValues(v=>v.map((previous,i)=>i===index?value:previous))}/>
      {error?<p className="notice-error" role="alert">{t(error)}</p>:null}<div className="mt-6 flex flex-wrap justify-end gap-2">{inspected.originalAvailable?<button className="button-secondary" onClick={()=>void original(inspected)}>{t("original")}</button>:null}<button className="button-primary" disabled={!canReview||!inspected.originalAvailable||!inspected.fields?.length||reviewValues.some(v=>!v.trim())||busy} onClick={()=>void request(`/api/cases/${item.id}/documents/${inspected.id}/review`,"POST",JSON.stringify({version:item.version||0,values:reviewValues}))}><CheckCircle2 size={17}/>{t(busy?"loading":"confirm")}</button></div></ModalSurface>:null}
    {item&&auth.authenticated?<div hidden={Boolean(editor||inspected)}><Chat key={`${item.id}:${item.version}:${auth.tenantId}:${auth.displayName}`} item={item} locale={locale} open={chat} onOpen={()=>setChat(true)} navigate={navigate} currentTab={tab} openSource={id=>{const doc=item.documents.find(d=>id.startsWith(d.id+":"));if(doc){setChat(false);inspect(doc);}}} initialQuestion={chatQuestion} close={()=>{setChat(false);setChatQuestion(undefined);}}/></div>:null}
  </div>;
}
