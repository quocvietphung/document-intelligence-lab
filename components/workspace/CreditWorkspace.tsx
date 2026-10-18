"use client";
import {useCallback,useEffect,useMemo,useRef,useState, type FormEvent} from "react";
import {ArrowUpRight,CheckCircle2,ClipboardCheck,Compass,FileSearch,FlaskConical,Gauge,GitBranch,Layers3,LayoutDashboard,LogIn,Menu,MessageSquareText,Plus,RefreshCw,ScanSearch,Search,ShieldCheck,Square,Trash2,Upload,WalletCards,X} from "lucide-react";
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
import {NovaChatContext,NovaChatSurface} from "./NovaChatSurface";
import {NovaComposer} from "./NovaComposer";
import type {NovaPageGuide} from "./NovaChatSurface";
import {PageTour} from "./PageTour";
import {pageTour} from "@/lib/page-tour";
import {PlatformWorkbench} from "./PlatformWorkbench";
import {DocumentResearchPanel} from './DocumentResearchPanel';
import {platformText} from "@/lib/platform-language";
import {DocumentDomains,DomainResearch} from './DocumentDomains';
import {researchSamples,researchSampleUrl} from '@/lib/research-samples';
import {documentDomains,domainOf,domainText,filterDomain,type DocumentDomain} from '@/lib/document-domains';
import {downloadBlob} from "@/lib/browser-download";
import {DocumentAnalysisWorkspace} from "./DocumentAnalysisWorkspace";
import {DocumentResultCard} from "./DocumentResults";
import {documentReceiptSchema,type DocumentImportOutcome} from "@/lib/document-results";
import {DocumentEvidence} from "./DocumentEvidence";
import {documentText} from "@/lib/document-language";
import {caseChatPayload} from "@/lib/credit-chat";
import {novaWelcomeMessage,welcomeSessionKey} from "@/lib/nova-welcome";
import {NovaGuideCard} from "./NovaGuideCard";
import {NovaMessageText} from "./NovaMessageText";
import {datevReference,hasOnlyDatevPayroll,legacyPayroll,datevLibraryUx} from "@/lib/datev-reference";
import {novaGuideFor,novaGuideIntro,novaGuideLabels,workspaceTabs,workspaceTarget,type WorkspaceTab} from "@/lib/nova-guide";
import {novaLimit,novaLimitMessage,novaQuotaNotice,novaSafetyMessage,type NovaLimit} from "@/lib/nova-limits";
import {showCaseEmpty,workspaceCaseFromSearch,workspaceErrorKey,workspaceLocalePath,workspaceSectionFromSearch,workspaceUxText} from "@/lib/workspace-ux";
import {WorkspaceAIOverview} from "./WorkspaceAIOverview";
import {NovaConversation,NovaCopyAnswer,NovaSuggestions} from "./NovaConversation";
import {customerUx,searchText} from "@/lib/customer-ux";
import {aiCapabilitiesSchema,aiText,type AICapabilities} from "@/lib/ai-capabilities";
import {AIPageBanner} from "./AITransparency";
import {TrustWorkbench} from "./TrustWorkbench";
import {NovaAnswerActions} from "./NovaEvidence";
import {trustAnswerSchema,citationTarget,type DraftOptions,type TrustSection} from "@/lib/nova-trust";
import {trustText} from "@/lib/nova-trust-language";
type Tab=WorkspaceTab;
const navigation=[
  {title:'groupDocuments',items:[["overview",LayoutDashboard],["documents",FileSearch],["banking",WalletCards],["controls",ScanSearch]]},
  {title:'groupResearch',items:[["studio",FlaskConical],["experiments",FlaskConical],["evaluation",Gauge]]},
  {title:'groupOperations',items:[["pipeline",Layers3],["operations",GitBranch],["audit",ClipboardCheck]]},
] as const;

function Copilot({item,locale,open,onOpen,close,initialQuestion,initialOptions,onDraft,openSource,navigate,currentTab,onPageGuide,pageGuideLabel,onTrust,aiCapabilities}:{item:WorkspaceCase;locale:string;open:boolean;onOpen:()=>void;close:()=>void;initialQuestion?:string;initialOptions?:DraftOptions;onDraft:(question:string,options:DraftOptions)=>void;openSource:(id:string)=>void;navigate:(tab:WorkspaceTab)=>void;currentTab:WorkspaceTab;aiCapabilities?:AICapabilities} & NovaPageGuide) {
  const auth=useAuth(); const base=workspaceText(locale),d=documentText(locale); const t=(key:string)=>key==="chatReady"?d("greeting"):key==="sources"?d("sources"):base(key); const [text,setText]=useState(initialQuestion||""); const [mode,setMode]=useState<string>();
  const pendingQuestion=useRef(""),sending=useRef(false);const [limit,setLimit]=useState<NovaLimit>();
  const trust=trustText(locale),[supportMode,setSupportMode]=useState<'guide'|'analysis'>('analysis'),[draftOptions,setDraftOptions]=useState<DraftOptions|undefined>();
  const transport=useMemo(()=>new DefaultChatTransport({api:"/api/chat",headers:()=>({Authorization:`Bearer ${auth.token}`}),body:{caseId:item.id,locale},fetch:async(input,init)=>{
    const response=await fetch(input,init); setMode(response.headers.get("X-AI-Mode")||undefined);
    if(response.status===429)setLimit(novaLimit(await response.clone().json().catch(()=>undefined)));
    return response;
  },prepareSendMessagesRequest:({messages,body})=>({body:{...caseChatPayload(messages,item.id,locale),...body,caseId:item.id,locale,caseVersion:item.version||0}})}),[auth.token,item.id,item.version,locale,setMode,setLimit]);
  const {messages,sendMessage,status,error,stop,setMessages,clearError}=useChat({transport,messages:[novaWelcomeMessage(locale)],onError:()=>setText(current=>current||pendingQuestion.current),onFinish:({isAbort,isDisconnect,isError})=>{if(!isAbort&&!isDisconnect&&!isError)setDraftOptions(undefined);}});
  const busy=status==="submitted"||status==="streaming";
  useEffect(()=>{if(initialQuestion===undefined)return;const timer=window.setTimeout(()=>{setText(initialQuestion);setSupportMode('analysis');setDraftOptions(initialOptions);},0);return()=>window.clearTimeout(timer);},[initialQuestion,initialOptions]);
  function guide(question:string,all=false){const data=novaGuideFor(question,currentTab,all);if(!data)return false;clearError();setLimit(undefined);setMessages(previous=>[...previous,{id:crypto.randomUUID(),role:"user",parts:[{type:"text",text:question}]},{id:crypto.randomUUID(),role:"assistant",parts:[{type:"text",text:novaGuideIntro(locale)},{type:"data-nova-guide",data}]}]);setMode("app-guide");return true;}
  function send(event?:FormEvent) { event?.preventDefault();if(!text.trim()||busy||sending.current||!auth.token)return;pendingQuestion.current=text.trim();clearError();setLimit(undefined);setMode(undefined);if(supportMode==='guide'){guide(text.trim(),true);}else if(draftOptions||!guide(text.trim())){sending.current=true;void sendMessage({text:text.trim()},{body:draftOptions}).catch(()=>{}).finally(()=>{sending.current=false;});}setText(""); }
  return <NovaChatSurface aiCapabilities={aiCapabilities} title={t("nova")} locale={locale} open={open} onOpen={onOpen} close={close} onPageGuide={onPageGuide} pageGuideLabel={pageGuideLabel} onTrust={onTrust}>
    <div className="nova-mode-switch" role="group" aria-label={trust.modeHint}>{(['guide','analysis'] as const).map(value=><button type="button" key={value} disabled={busy} aria-pressed={supportMode===value} onClick={()=>{setSupportMode(value);if(value==='guide'){setDraftOptions(undefined);}}}>{value==='guide'?trust.guideMode:trust.analysisMode}</button>)}</div>
    <NovaConversation open={open} messages={messages} label={t("nova")} locale={locale}>
      <NovaChatContext locale={locale} caseId={item.id} hint={t("chatHint")} aiCapabilities={aiCapabilities} mode={!error?mode:undefined}>
        <p>{d("singleQuestion")}</p><p>{novaQuotaNotice(locale)}</p>
      </NovaChatContext>
      {!messages.length?<div className="chat-welcome"><MessageSquareText size={32}/><h3>{t("chatReady")}</h3><button className="button-secondary" disabled={!auth.token} onClick={()=>void sendMessage({text:t("question")})}>{t("question")} <ArrowUpRight size={16}/></button></div>:messages.map(message=>{const record=trustAnswerSchema.safeParse(message.parts.find(p=>p.type==='data-nova-trust')?.type==='data-nova-trust'?(message.parts.find(p=>p.type==='data-nova-trust') as {data:unknown}).data:undefined);return <article key={message.id} className={`chat-bubble ${message.role==="user"?"chat-user":"chat-assistant"}`}>
        <NovaMessageText text={message.parts.filter(p=>p.type==="text").map(p=>p.text).join("")} navigate={navigate} citations={record.success?record.data.sources.filter(s=>s.documentId&&s.originalAvailable).map(s=>s.id):[]} openSource={openSource}/>
        {message.parts.filter(p=>p.type==="data-nova-guide").map((p,i)=><NovaGuideCard key={i} guide={"data" in p?p.data:undefined} locale={locale} item={item} navigate={navigate} openSource={openSource}/>)}
        {message.parts.some(p=>p.type==="source-document")?<details className="mt-4 border-t border-slate-200 pt-3 text-xs"><summary>{t("sources")}</summary><ul className="mt-2 space-y-2">{message.parts.filter(p=>p.type==="source-document").map(p=><li key={p.sourceId}>{item.documents.some(doc=>p.sourceId.startsWith(doc.id+":"))?<button className="button-link" onClick={()=>{void stop();openSource(p.sourceId);}}>{p.title||p.sourceId} → {d("preview")}</button>:<span>{p.title||p.sourceId} <code>[{p.sourceId}]</code></span>}</li>)}</ul></details>:null}
        {message.role==="assistant"&&message.id!=="nova-welcome"&&!message.parts.some(p=>p.type==="data-nova-guide")?<NovaCopyAnswer text={message.parts.filter(p=>p.type==="text").map(p=>p.text).join("")} locale={locale}/>:null}
        {record.success?<NovaAnswerActions answer={record.data} caseId={item.id} caseVersion={item.version||0} locale={locale} onDraft={onDraft} openSource={openSource}/>:null}
      </article>;})}
      {busy?<p className="p-3 text-sm text-slate-500" role="status">{t("loading")}</p>:null}
      {error?<div className="notice-error" role="alert"><p>{error.message.includes("AI_SAFETY_FILTER")?novaSafetyMessage(locale):limit||error.message.toLowerCase().includes("limit")?novaLimitMessage(limit,locale):t("error")}</p><p>{customerUx(locale).question}</p></div>:null}
      <NovaSuggestions locale={locale} page={currentTab} select={setText} disabled={busy}/>
      <div className="nova-chat-shortcuts"><button className="button-link" onClick={()=>guide(novaGuideLabels(locale).actions,true)} disabled={busy}><Compass size={14}/>{novaGuideLabels(locale).actions}</button></div>
    </NovaConversation>
    {draftOptions?.revisionOf?<div className="nova-revision"><span>{trust.revision}</span><button type="button" disabled={busy} aria-label={trust.clearRevision} onClick={()=>{setDraftOptions(undefined);}}><X size={14}/></button></div>:null}
    <NovaComposer id="nova-question" locale={locale} label={t("ask")} sendLabel={t("send")} text={text} onChange={setText} onSubmit={send} disabled={busy||!auth.token} actions={<>
      {busy?<button className="button-link" onClick={()=>{void stop();}} aria-label={t("stop")} title={t("stop")}><Square size={15}/></button>:null}
      <button className="button-link" aria-label={t("clear")} title={t("clear")} onClick={()=>{setMessages([novaWelcomeMessage(locale)]);clearError();setMode(undefined);setLimit(undefined);setText("");setDraftOptions(undefined);pendingQuestion.current="";}} disabled={busy}><Trash2 size={15}/></button>
    </>}/>
  </NovaChatSurface>;
}

export function CreditWorkspace({locale}:{locale:string}) {
  const d=publicDemoText(locale); const baseText=workspaceText(locale); const domainCopy=domainText(locale); const t=(key:string)=>["studio","controls","operations","evaluation"].includes(key)?platformText(locale)(key):key==="banking"?domainCopy.research:baseText(key); const auth=useAuth();
  const router=useRouter();
  const ux=workspaceUxText(locale),ai=aiText(locale);
  const [aiCapabilities,setAICapabilities]=useState<AICapabilities>();
  useEffect(()=>{
    const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      setAICapabilities(undefined);
      if(auth.mode==="demo"||!auth.authenticated||!auth.token)return;
      try{
        const response=await fetch("/api/cases/ai-capabilities",{headers:{Authorization:`Bearer ${auth.token}`},cache:"no-store",signal:controller.signal});
        if(!response.ok)return;
        const parsed=aiCapabilitiesSchema.safeParse(await response.json());
        if(parsed.success&&!controller.signal.aborted)setAICapabilities(parsed.data);
      }catch{/* Keep unknown rather than infer that a provider is working. */}
    },0);
    return()=>{clearTimeout(timer);controller.abort();};
  },[auth.mode,auth.authenticated,auth.token]);
  const [tab,setTab]=useState<Tab>("overview"); const [cases,setCases]=useState<WorkspaceCase[]>(()=>auth.mode==="demo"?[publicDemoCase]:[]);const [selected,setSelected]=useState("");
  const [domainFilter,setDomainFilter]=useState<DocumentDomain|'all'>('all');
  const domainCases=filterDomain(cases,domainFilter);
  const [guide,setGuide]=useState<{page:WorkspaceTab;step:number}|null>(null);
  useEffect(()=>{const sync=()=>{const target=workspaceTarget(window.location.hash)||workspaceSectionFromSearch(window.location.search);if(target){setTab(target);setGuide(null);}};const timer=window.setTimeout(()=>{sync();const id=workspaceCaseFromSearch(window.location.search);if(id)setSelected(id);},0);window.addEventListener("hashchange",sync);window.addEventListener("popstate",sync);return()=>{window.clearTimeout(timer);window.removeEventListener("hashchange",sync);window.removeEventListener("popstate",sync);};},[]);
  function navigate(id:WorkspaceTab){if(!workspaceTabs.includes(id))return;setTab(id);setMenu(false);setChat(false);setGuide(null);window.history.pushState(null,"",`#${id}`);window.scrollTo({top:0,behavior:"instant"});}
  const [loading,setLoading]=useState(false); const [error,setError]=useState("");const [success,setSuccess]=useState(false);
  const [analysis,setAnalysis]=useState<{mode:string;maxPages:number}|null>(null);
  const [query,setQuery]=useState("");const [casePicker,setCasePicker]=useState(false);const [menu,setMenu]=useState(false);const [chat,setChat]=useState(false);
  const [chatQuestion,setChatQuestion]=useState<string>();
  const [chatOptions,setChatOptions]=useState<DraftOptions>();const [trustOpen,setTrustOpen]=useState(false);const [trustSection,setTrustSection]=useState<TrustSection>('privacy');const [inspectedPage,setInspectedPage]=useState(1);
  const guideText=pageTour(locale,tab).labels;
  function startPageGuide(){setMenu(false);setChat(false);setGuide({page:tab,step:0});}
  function askNova(question?:string,options?:DraftOptions){setChatQuestion(question);setChatOptions(options);setTrustOpen(false);setGuide(null);setChat(true);}
  function openTrust(section:TrustSection='privacy'){setTrustSection(section);setChat(false);setGuide(null);setTrustOpen(true);}
  function openCitation(id:string){if(!item)return;const target=citationTarget(id,item.documents);const doc=target&&item.documents.find(d=>d.id===target.documentId);if(doc){setTrustOpen(false);inspect(doc,target.page);}}
  const [editor,setEditor]=useState<"new"|"edit"|null>(null);const [inspected,setInspected]=useState<CreditDocument|null>(null);const [reviewValues,setReviewValues]=useState<string[]>([]);const [busy,setBusy]=useState(false);
  const inputFile=useRef<HTMLInputElement>(null);
  const sampleInFlight=useRef(false);
  const writeInFlight=useRef(false);
  const [uploading,setUploading]=useState(false);
  const item=auth.authenticated?(domainCases.find(c=>c.id===selected)||domainCases.find(hasOnlyDatevPayroll)||domainCases.find(c=>c.documents.some(doc=>datevReference(doc.name)))||domainCases[0]):undefined;
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
      if(!response.ok){setError(workspaceErrorKey(response.status));setCases([]);setAnalysis(null);return;}
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
    } catch {if(!signal?.aborted){setError("serviceUnavailable");setCases([]);setAnalysis(null);}} finally {if(!signal?.aborted)setLoading(false);}
  },[auth.ready,auth.authenticated,auth.mode,auth.token]);
  useEffect(()=>{
    const controller=new AbortController();
    const run=()=>void refresh(controller.signal);
    const task=window.setTimeout(run,0);
    return()=>{window.clearTimeout(task);controller.abort();};
  },[refresh]);
  function select(id:string) {if(writeInFlight.current||sampleInFlight.current)return;setSelected(id);setCasePicker(false);setQuery("");setGuide(null);setInspected(null);setEditor(null);setChat(false);setChatQuestion(undefined);setChatOptions(undefined);setTrustOpen(false);setSuccess(false);setError("");window.history.replaceState(null,"",`${window.location.pathname}?case=${encodeURIComponent(id)}#${tab}`);}
  async function request(path:string,method:string,body:BodyInit,isForm=false) {
    if(writeInFlight.current)return;writeInFlight.current=true;setBusy(true);setError("");setSuccess(false);
    try {
      const response=await fetch(path,{method,headers:{Authorization:`Bearer ${auth.token}`,...(isForm?{}:{"Content-Type":"application/json"})},body});
      if(!response.ok) {setError(workspaceErrorKey(response.status));return;}
      const updated=toWorkspaceCase(await response.json());
      setCases(list=>list.some(c=>c.id===updated.id)?list.map(c=>c.id===updated.id?updated:c):[...list,updated]);
      setSelected(updated.id);window.history.replaceState(null,"",`${window.location.pathname}?case=${encodeURIComponent(updated.id)}#${tab}`);setInspected(null);setEditor(null);setSuccess(true);
    } catch {setError("error");} finally {writeInFlight.current=false;setBusy(false);}
  }
  async function uploadFile(file:File) {
    if(!item||writeInFlight.current||!canWrite)return;
    setChat(false);
    const supported=analysis&&analysis.mode!=="local"?/\.(pdf|png|jpe?g)$/i:/\.(pdf|png|jpe?g|txt)$/i;
    if(!file.size||file.size>3_000_000||!supported.test(file.name)){setError("fileRejected");return;}
    const form=new FormData();form.set("file",file);form.set("version",String(item.version||0));
    setUploading(true);
    try {await request(`/api/cases/${item.id}/documents`,"POST",form,true);} finally {setUploading(false);}
  }
  async function uploadSample(fileName:string):Promise<DocumentImportOutcome> {
    if(!item||busy||!canWrite||sampleInFlight.current)throw new Error("importError");
    setChat(false);
    sampleInFlight.current=true;setBusy(true);setError("");setSuccess(false);
    try {
      const reference=domainOf(item.domain)==='banking'?datevReference(fileName):undefined;
      const sample=researchSamples(domainOf(item.domain)).find(row=>row.file===fileName);
      if(!reference&&!sample)throw new Error("Unknown reference");
      const response=await fetch(reference?`/api/payroll-references?sample=${reference.id}`:researchSampleUrl(sample!),{headers:{Authorization:`Bearer ${auth.token}`},cache:"no-store"});
      if(!response.ok)throw new Error("Sample unavailable");
      const form=new FormData();form.set("file",new File([await response.blob()],fileName,{type:"application/pdf"}));
      // Queue first: extraction can exceed the proxy timeout. Pipeline polls the durable job.
      const queued=await fetch(`/api/cases/${item.id}/platform/jobs`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`},body:form,signal:AbortSignal.timeout(20_000)});
      if(queued.status===409)return {duplicate:true};
      if(!queued.ok)throw new Error(queued.status===429?"limit":"importError");
      return documentReceiptSchema.parse(await queued.json());
    } finally {sampleInFlight.current=false;setBusy(false);}
  }
  function saveDraft(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const data=new FormData(event.currentTarget);
    const body=JSON.stringify({applicant:data.get("applicant"),coApplicant:data.get("coApplicant"),purpose:data.get("purpose"),domain:data.get('domain'),amountEuro:editor==='edit'?(item?.amountEuro||0):0,version:editor==='edit'?(item?.version||0):0});
    setDomainFilter('all');
    void request(editor==="new"?"/api/cases":`/api/cases/${item!.id}`,editor==="new"?"POST":"PATCH",body);
  }
  function inspect(doc:CreditDocument,page=1) {setChat(false);setTrustOpen(false);setInspectedPage(page);setInspected(doc);setReviewValues((doc.fields||[]).map(f=>f.value));setError("");}
  async function original(doc:CreditDocument) {
    if(!item)return;
    try {const response=await fetch(`/api/cases/${item.id}/documents/${doc.id}/original`,{headers:{Authorization:`Bearer ${auth.token}`}});if(!response.ok)throw new Error();
      downloadBlob(await response.blob(),doc.name);
    } catch {setError("error");}
  }
  const status=(c:WorkspaceCase)=>t(c.status==="DRAFT"?"draft":c.status==="REVIEW_COMPLETE"?"complete":"humanReview");
  const shown=domainCases.filter(c=>searchText(`${c.applicant} ${c.id} ${c.purpose}`).includes(searchText(query)));
  const customer=customerUx(locale);
  const legacyDocs=item?.documents.filter(legacyPayroll)||[];
  const payrollUx=datevLibraryUx(locale);
  function documentRow(doc:CreditDocument){return <DocumentResultCard key={doc.id} doc={doc} locale={locale} open={inspect} ask={askNova} historical/>;}
  return <div className="workspace-shell">
    <aside className={`workspace-sidebar ${menu?"sidebar-open":""}`}><a href={`/${locale}`} className="brand"><span className="brand-icon"><FileSearch size={23}/></span><span>Document Intelligence<small>{t("lab")}</small></span></a>
      <button className="icon-button sidebar-close" onClick={()=>setMenu(false)} aria-label={t("close")}><X/></button>
      <nav className="workspace-nav-groups" aria-label={t('workspace')}>{navigation.map(group=><section key={group.title}><h2>{t(group.title)}</h2>{group.items.map(([id,Icon])=><button key={id} data-page-tour={`menu-${id}`} className={`nav-button ${tab===id?"nav-active":""}`} aria-label={t(id)} aria-current={tab===id?"page":undefined} onClick={()=>navigate(id)}><Icon size={19}/><span className="nav-label">{t(id)}</span>{["studio","documents"].includes(id)?<span className="nav-ai-mark" aria-hidden="true">{auth.mode==="demo"?"DEMO":ai.ai}</span>:null}</button>)}</section>)}</nav>
      <div className="sidebar-footer"><ShieldCheck size={22}/><strong>{auth.mode==="demo"?d("badge"):t("security")}</strong><p>{t("notice")}</p><label htmlFor="workspace-language">{t("language")}</label><select id="workspace-language" value={locale} onChange={event=>router.replace(workspaceLocalePath(`#${tab}`,item?.id),{locale:event.target.value})}><option value="en">English</option><option value="de">Deutsch</option><option value="vi">Tiếng Việt</option></select></div>
    </aside>
    <main className="workspace-main"><header className="workspace-header"><div className="flex items-center gap-3"><button className="icon-button mobile-menu" onClick={()=>setMenu(true)} aria-label={t("workspace")}><Menu size={21}/></button><span className="text-sm font-semibold">{t("workspace")}</span></div><div className="flex items-center gap-3"><span className="hidden text-xs text-slate-500 sm:inline">{auth.authenticated?auth.displayName:t("noSession")}</span>{auth.mode==="demo"?<span className="lab-badge">{d("badge")}</span>:<button className="button-secondary" disabled={!auth.ready} onClick={auth.authenticated&&auth.mode==="keycloak"?auth.logout:auth.login}><LogIn size={16}/>{t(auth.authenticated&&auth.mode==="keycloak"?"signOut":"signIn")}</button>}</div></header>
      <div className="workspace-content"><div className="workspace-page-guide"><p>{guideText.intro}</p><button data-page-tour="page-guide-button" className="button-secondary" disabled={!auth.authenticated||!item} onClick={startPageGuide}><Compass size={17}/>{guideText.start} · {t(tab)}</button></div><div className="notice-lab"><ShieldCheck size={17}/>{auth.mode==="demo"?d("notice"):t("notice")}</div>
        {!["overview","studio","experiments","pipeline","controls","operations","evaluation"].includes(tab)?<section className="workspace-hero"><div><p className="eyebrow">{t(tab)}</p><h1>{t(tab==="overview"?"welcome":tab)}</h1><p>{tab==="documents"?ux.documentsSubtitle:tab==="banking"?domainCopy.subtitle:tab==="audit"?ux.auditSubtitle:t("subtitle")}</p></div><div className="hero-mark" aria-hidden="true"><FileSearch size={55}/><span>01 / AI LAB</span></div></section>:null}
        {auth.error?<p className="notice-error" role="alert">{t("error")}</p>:null}
        {!auth.authenticated?<section className="surface p-8"><h2 className="text-lg font-bold">{t("noSession")}</h2><p className="my-4 text-sm leading-relaxed text-slate-600">{t("publicLogin")}</p><button className="button-primary" onClick={auth.login} disabled={!auth.ready}>{t(auth.ready?"signIn":"loading")}</button></section>:<>
          <DocumentDomains locale={locale} cases={cases} value={domainFilter} compact={tab!=='overview'} onChange={value=>{if(busy)return;setDomainFilter(value);setSelected('');setCasePicker(true);setChat(false);setGuide(null);setInspected(null);setEditor(null);setTrustOpen(false);setChatQuestion(undefined);setChatOptions(undefined);setQuery('');setSuccess(false);window.history.replaceState(null,'',`${window.location.pathname}#${tab}`);}}/>
          <div className="case-toolbar"><div className="search-input"><Search size={17}/><input data-page-tour="case-search" aria-label={t("search")} placeholder={t("search")} value={query} onChange={e=>{setQuery(e.target.value);setCasePicker(true);}}/></div><button data-page-tour="case-refresh" className="button-secondary" disabled={loading||busy} onClick={()=>void refresh()}><RefreshCw size={16}/>{t("refresh")}</button><button data-page-tour="case-new" className="button-primary" disabled={!canWrite||busy} onClick={()=>{setEditor("new");setError("");}}><Plus size={17}/>{t("newCase")}</button></div>
          {error?<div className="notice-error workspace-recovery" role="alert"><p>{t(error)}</p>{error==="sessionExpired"?<button className="button-secondary" onClick={auth.login}>{t("signIn")}</button>:error==="serviceUnavailable"?<button className="button-secondary" disabled={loading} onClick={()=>void refresh()}><RefreshCw size={16}/>{t("refresh")}</button>:null}</div>:null}{success?<p className="notice-success" role="status">{t("saved")}</p>:null}
          {loading?<p className="p-4" role="status">{t("loading")}</p>:<div className="case-switcher" data-page-tour="case-select"><button className="case-switcher-button" aria-expanded={casePicker||!item} aria-controls="case-options" onClick={()=>{setCasePicker(value=>!value);setQuery("");}}><span>{item?.id||t("selectCase")} · {domainCases.length} {customer.cases}</span><span>{casePicker?customer.hideCases:customer.changeCase} <ArrowUpRight size={15}/></span></button>{casePicker||!item?<div id="case-options" className="case-options" aria-label={t("selectCase")}>{shown.map(c=><button key={c.id} className={`case-card ${item?.id===c.id?"case-selected":""}`} aria-pressed={item?.id===c.id} onClick={()=>select(c.id)}><small>{c.id}</small><strong>{c.applicant}</strong><span>{status(c)}</span></button>)}{showCaseEmpty(shown.length,loading,error)?<p className="p-4 text-slate-600">{t("noCases")}</p>:null}</div>:null}</div>}
          {item?<><div className="selected-heading"><div><span className="eyebrow">{domainCopy[domainOf(item.domain)]} · {item.id} · {t("version")} {item.version||0}</span><h2>{item.applicant}</h2><p>{item.purpose}</p><p className="domain-requirement">{domainCopy.requirement}: {domainCopy[`${domainOf(item.domain)}Required`]}</p></div><div className="flex flex-wrap gap-2"><button className="button-secondary" disabled={!canWrite||busy} onClick={()=>setEditor("edit")}>{t("editCase")}</button><button className="button-primary" onClick={()=>askNova()} disabled={!auth.authenticated}><MessageSquareText size={17}/>{t("askNova")}</button></div></div>
            {tab==="overview"?<><WorkspaceAIOverview locale={locale} demo={auth.mode==="demo"} documentMode={analysis?.mode} capabilities={aiCapabilities} navigate={navigate} openNova={()=>askNova()} documents={item.documents} openTrust={auth.mode==='keycloak'?openTrust:undefined}/><div className="metrics-grid">{[[t("progress"),`${item.progress}%`],[t("documentsCount"),item.documents.filter(d=>d.status!=="missing").length],[t("issues"),item.issues.length]].map(([label,value])=><div className="surface metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><section className="surface p-6"><h3 className="section-heading">{t("issues")}</h3>{item.issues.length?item.issues.map((issue,i)=><div className="review-item" key={i}><span className="review-dot"/><div><strong>{t(issue.title.includes("Missing")?"missingDocument":issue.title.replaceAll(" ","_"))}</strong><p>{t(issue.detail)}</p></div><button className="button-link" onClick={()=>{const doc=item.documents.find(d=>d.id===issue.documentId);if(doc)inspect(doc);else navigate("documents");}}>{t("inspect")} →</button></div>):<p className="mt-4 text-slate-500">{t("noIssues")}</p>}</section></>:null}
            {tab!=="overview"?<AIPageBanner page={tab} locale={locale} capabilities={aiCapabilities} demo={auth.mode==="demo"} ask={askNova}/>:null}
            {tab==='experiments'?<DocumentResearchPanel key={`${item.id}:${item.version}`} caseId={item.id} caseVersion={item.version||0} locale={locale} view="experiments" inspect={(id,page)=>{const doc=item.documents.find(d=>d.id===id);if(doc)inspect(doc,page);}}/>:null}
            {auth.mode==='keycloak'?<div className="trust-entry"><ShieldCheck size={18}/><span>{trustText(locale).intro}</span><button type="button" className="button-secondary" onClick={()=>openTrust()}>{trustText(locale).open}</button></div>:null}
            {tab==="documents"?<section className="surface"><header className="section-toolbar"><div><h3 className="section-heading">{t("documents")}</h3><p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-500">{analysis&&analysis.mode!=="local"?t("uploadHintAzure").replace("{pages}",String(analysis.maxPages)):t("uploadHint")}</p></div><input ref={inputFile} type="file" className="hidden" accept={analysis&&analysis.mode!=="local"?".pdf,.png,.jpg,.jpeg":".pdf,.png,.jpg,.jpeg,.txt"} onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(file)uploadFile(file);}}/><div className="flex flex-wrap gap-2"><button className="button-secondary" disabled={!canWrite||busy} onClick={()=>document.getElementById("datev-library")?.scrollIntoView({behavior:"smooth",block:"start"})} style={domainOf(item.domain)!=='banking'?{display:'none'}:undefined}><FileSearch size={16}/>{t("uploadSample")}</button><button data-page-tour="documents-upload" className="button-primary" disabled={!canWrite||busy} onClick={()=>inputFile.current?.click()}><Upload size={16}/>{t(busy?"loading":"upload")}</button></div></header>
              {uploading?<p className="notice-lab notice-processing" role="status" aria-live="polite">{documentText(locale)("processing")}</p>:null}
              <p className="px-6 py-3 text-xs leading-relaxed text-slate-600">{documentText(locale)("policy")}</p>
              <DocumentAnalysisWorkspace key={`document-analysis:${item.id}`} caseId={item.id} documents={item.documents} locale={locale} busy={busy} canImport={canWrite&&!!analysis} azure={!!analysis&&analysis.mode!=="local"} importSample={uploadSample} refreshCase={refresh} open={inspect} ask={askNova} technical={()=>navigate("pipeline")} showPayroll={domainOf(item.domain)==='banking'} domain={domainOf(item.domain)}/>
              {legacyDocs.length?<details className="payroll-legacy"><summary>{payrollUx.legacy} · {legacyDocs.length}</summary><p>{payrollUx.kept}</p>{legacyDocs.map(documentRow)}</details>:null}</section>:null}
            {(["studio","pipeline","controls","operations","evaluation"] as string[]).includes(tab)?<PlatformWorkbench key={item.id} domain={item.domain} caseId={item.id} locale={locale} view={tab as "studio"|"pipeline"|"controls"|"operations"|"evaluation"} caseVersion={item.version||0} documents={item.documents} changed={refresh} ask={askNova} inspect={(id,page)=>{const doc=item.documents.find(d=>d.id===id);if(doc)inspect(doc,page);else navigate("documents");}}/>:null}
            {auth.mode==='keycloak'&&tab==='controls'?<TrustWorkbench key={`trust-${item.id}`} caseId={item.id} caseVersion={item.version||0} locale={locale} onDraft={askNova} openSource={openCitation} initialSection="tasks"/>:null}
            {tab==="audit"?<section className="surface p-6"><h3 className="section-heading">{t("activity")}</h3><div className="overflow-x-auto"><table data-page-tour="audit-table" className="audit-table"><thead><tr><th>{t("time")}</th><th>{t("event")}</th><th>{t("actor")}</th></tr></thead><tbody>{item.audit.toReversed().map(([time,event,actor],i)=><tr key={i}><td>{time}</td><td>{t(event)}</td><td><code>{actor}</code></td></tr>)}</tbody></table></div></section>:null}
          </>:null}</>}
        {tab==="banking"&&item?<DomainResearch locale={locale} item={item} ask={askNova} inspect={inspect}/>:null}
        <footer className="mt-8 border-t border-slate-200 pt-5 text-xs leading-relaxed text-slate-500">{auth.mode==="demo"?d("badge"):t(canWrite?"labWrites":"readonly")}</footer>
      </div>
    </main>
    {editor&&auth.authenticated?<ModalSurface title={t(editor==="new"?"newCase":"editCase")} label={t("close")} close={()=>{if(!busy)setEditor(null);}}><form key={editor} onSubmit={saveDraft} className="draft-form"><label>{domainCopy.domain}<select name="domain" defaultValue={editor==='edit'?domainOf(item?.domain):domainFilter==='all'?'general':domainFilter}>{documentDomains.map(domain=><option value={domain} key={domain}>{domainCopy[domain]}</option>)}</select></label>{[["applicant","applicant",editor==="edit"?item?.applicant:""],["purpose","purpose",editor==="edit"?item?.purpose:""],["coApplicant","coApplicant",editor==="edit"?item?.coApplicant:""]].map(([name,label,value])=><label key={name}>{t(label!)}<input name={name} required={name!=="coApplicant"} maxLength={name==="purpose"?160:120} defaultValue={value}/></label>)}<p className="domain-requirement">{domainCopy.boundary}</p>{error?<p className="notice-error" role="alert">{t(error)}</p>:null}<div className="flex justify-end gap-2"><button type="button" className="button-secondary" disabled={busy} onClick={()=>setEditor(null)}>{t("cancel")}</button><button className="button-primary" disabled={busy}>{t(busy?"loading":"save")}</button></div></form></ModalSurface>:null}
    {inspected&&item?<ModalSurface wide title={inspected.name} label={t("close")} close={()=>{if(!busy)setInspected(null);}}><p className="notice-lab">{inspected.originalAvailable?documentText(locale)("review"):t("fixture")} · {inspected.analysisProvider||"local"} · {inspected.modelId||"transparent-rules"}</p><DocumentEvidence initialPage={inspectedPage} onExplain={question=>{setInspected(null);askNova(question);}} key={inspected.id} doc={inspected} caseId={item.id} locale={locale} editable={canReview&&!!inspected.originalAvailable&&!busy} values={reviewValues} onChange={(index,value)=>setReviewValues(v=>v.map((previous,i)=>i===index?value:previous))}/>
      {error?<p className="notice-error" role="alert">{t(error)}</p>:null}<div className="mt-6 flex flex-wrap justify-end gap-2">{inspected.originalAvailable?<button className="button-secondary" onClick={()=>void original(inspected)}>{t("original")}</button>:null}<button className="button-primary" disabled={!canReview||!inspected.originalAvailable||!inspected.fields?.length||reviewValues.some(v=>!v.trim())||busy} onClick={()=>void request(`/api/cases/${item.id}/documents/${inspected.id}/review`,"POST",JSON.stringify({version:item.version||0,values:reviewValues}))}><CheckCircle2 size={17}/>{t(busy?"loading":"confirm")}</button></div></ModalSurface>:null}
    {trustOpen&&item&&auth.mode==='keycloak'?<ModalSurface wide title={trustText(locale).title} label={t('close')} close={()=>setTrustOpen(false)}><TrustWorkbench initialSection={trustSection} key={`${item.id}:${trustSection}`} caseId={item.id} caseVersion={item.version||0} locale={locale} onDraft={askNova} openSource={openCitation}/></ModalSurface>:null}
    {item&&auth.authenticated?<div hidden={Boolean(editor||inspected||trustOpen)}><Chat aiCapabilities={aiCapabilities} key={`${item.id}:${auth.tenantId}:${auth.displayName}`} item={item} locale={locale} open={chat} onOpen={()=>setChat(true)} navigate={navigate} currentTab={tab} onPageGuide={startPageGuide} pageGuideLabel={`${guideText.start} · ${t(tab)}`} openSource={openCitation} initialQuestion={chatQuestion} initialOptions={chatOptions} onDraft={askNova} onTrust={auth.mode==='keycloak'?()=>openTrust():undefined} close={()=>{setChat(false);setChatQuestion(undefined);}}/></div>:null}
    {guide&&auth.authenticated&&!editor&&!inspected?<PageTour locale={locale} page={guide.page} domain={item?.domain} step={guide.step} onStep={step=>setGuide(previous=>previous?{...previous,step}:null)} close={()=>setGuide(null)}/>:null}
  </div>;
}
