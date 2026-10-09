"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileSearch,
  Gauge,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  Menu,
  MessageSquareText,
  PanelLeftClose,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/KeycloakProvider";
import { demoCase, type CreditDocument } from "@/lib/credit-data";

const chatTransport = new DefaultChatTransport({ api: "/api/chat" });
type Tab = "overview" | "documents" | "evaluation" | "audit";

const tabItems = [
  ["overview", "Overview", LayoutDashboard],
  ["documents", "Document AI", FileSearch],
  ["evaluation", "AI evaluation", Gauge],
  ["audit", "Audit trail", ClipboardCheck],
] as const;

const quickQuestions = [
  "Welche Unterlagen fehlen?",
  "Erkläre den erkannten Konflikt.",
  "Wie ist der Tenant geschützt?",
];

function messageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function BrandMark() {
  return (
    <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#0a625d] text-white shadow-[0_8px_24px_rgba(9,107,101,.25)]">
      <Activity size={21} strokeWidth={2.4} />
    </div>
  );
}

function StatusPill({ children, tone = "mint" }: { children: React.ReactNode; tone?: "mint" | "gold" | "red" | "slate" }) {
  const colors = {
    mint: "bg-emerald-50 text-emerald-700 border-emerald-200",
    gold: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${colors[tone]}`}>{children}</span>;
}

function Confidence({ value }: { value: number }) {
  const tone = value >= 90 ? "bg-emerald-500" : value >= 80 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${tone}`} style={{ width: `${value}%` }} /></div>
      <span className="text-xs font-semibold tabular-nums text-slate-600">{value}%</span>
    </div>
  );
}

function DocumentRow({ document }: { document: CreditDocument }) {
  return (
    <div className="group grid gap-4 border-b border-slate-100 px-5 py-4 last:border-0 hover:bg-[#fbfdfc] md:grid-cols-[1.3fr_.8fr_.6fr_auto] md:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${document.status === "missing" ? "bg-red-50 text-red-500" : "bg-[#e8f5f1] text-[#096b65]"}`}>
          {document.status === "missing" ? <AlertTriangle size={19} /> : <FileCheck2 size={19} />}
        </div>
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-[#17383a]">{document.name}</p><p className="mt-0.5 text-xs text-slate-500">{document.type}</p></div>
      </div>
      <div>{document.status === "verified" ? <StatusPill><CheckCircle2 size={12} /> Verified</StatusPill> : document.status === "review" ? <StatusPill tone="gold"><Clock3 size={12} /> Review</StatusPill> : <StatusPill tone="red">Missing</StatusPill>}</div>
      <div>{document.confidence ? <Confidence value={document.confidence} /> : <span className="text-xs text-slate-400">—</span>}</div>
      <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-[#70a9a3] hover:text-[#096b65]">Inspect</button>
    </div>
  );
}

function Overview() {
  return (
    <div className="space-y-5 animate-rise">
      <section className="grid gap-4 xl:grid-cols-[1.45fr_.8fr]">
        <div className="rounded-[22px] border border-[#dce8e6] bg-white p-5 shadow-[0_12px_40px_rgba(24,65,62,.05)] md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#6d8584]">Active application</p><h2 className="mt-2 text-2xl font-bold tracking-[-.03em] text-[#123537]">{demoCase.purpose}</h2><p className="mt-1 text-sm text-slate-500">{demoCase.id} · submitted {demoCase.submittedAt}</p></div>
            <StatusPill tone="gold"><Clock3 size={12} /> {demoCase.status}</StatusPill>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[['Applicant', demoCase.applicant], ['Co-applicant', demoCase.coApplicant], ['Requested', demoCase.amount]].map(([label, value]) => <div key={label} className="rounded-2xl bg-[#f4f8f7] p-4"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">{label}</p><p className="mt-2 text-sm font-semibold text-[#17383a]">{value}</p></div>)}
          </div>
          <div className="mt-6"><div className="mb-2 flex items-center justify-between text-xs font-semibold"><span>Application completeness</span><span className="text-[#096b65]">{demoCase.progress}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-[#edf2f1]"><div className="h-full rounded-full bg-gradient-to-r from-[#0b625d] to-[#40a58e]" style={{ width: `${demoCase.progress}%` }} /></div></div>
        </div>
        <div className="relative overflow-hidden rounded-[22px] bg-[#0b4746] p-6 text-white shadow-[0_16px_40px_rgba(8,58,57,.18)]">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#2c8d7d]/30 blur-2xl" />
          <ShieldCheck className="relative text-[#8de2cb]" size={27} />
          <p className="relative mt-6 text-[11px] font-bold uppercase tracking-[.18em] text-[#9dd3c8]">Decision boundary</p>
          <h3 className="relative mt-2 text-xl font-bold">AI prepares. Humans decide.</h3>
          <p className="relative mt-3 text-sm leading-6 text-[#d6ebe7]">OCR, extraction and validation support the reviewer. No automatic approval, rejection or credit advice.</p>
          <div className="relative mt-5 flex items-center gap-2 text-xs font-semibold text-[#a9e8d8]"><LockKeyhole size={14} /> Synthetic data only</div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="overflow-hidden rounded-[22px] border border-[#dce8e6] bg-white shadow-[0_12px_40px_rgba(24,65,62,.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">Document pipeline</p><h3 className="mt-1 font-bold text-[#17383a]">Evidence & extraction</h3></div><button className="flex items-center gap-2 rounded-xl bg-[#e5f3ef] px-3 py-2 text-xs font-bold text-[#096b65]"><Upload size={14} /> Upload demo</button></div>
          {demoCase.documents.slice(0, 3).map((document) => <DocumentRow document={document} key={document.id} />)}
        </div>
        <div className="rounded-[22px] border border-[#dce8e6] bg-white p-5 shadow-[0_12px_40px_rgba(24,65,62,.04)]">
          <div className="flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">Review queue</p><h3 className="mt-1 font-bold text-[#17383a]">2 items need attention</h3></div><AlertTriangle className="text-amber-500" size={23} /></div>
          <div className="mt-4 space-y-3">{demoCase.issues.map((issue) => <div key={issue.title} className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4"><p className="text-sm font-bold text-[#4c3a18]">{issue.title}</p><p className="mt-1 text-xs leading-5 text-[#7a6844]">{issue.detail}</p><button className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#096b65]">Open evidence <ArrowRight size={13} /></button></div>)}</div>
        </div>
      </section>
    </div>
  );
}

function Documents() {
  return <div className="animate-rise overflow-hidden rounded-[22px] border border-[#dce8e6] bg-white shadow-[0_12px_40px_rgba(24,65,62,.05)]"><div className="border-b border-slate-100 p-6"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#6d8584]">Document intelligence</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold tracking-[-.03em]">Extraction with evidence</h2><p className="mt-1 text-sm text-slate-500">Every value retains confidence and a path to the source document.</p></div><StatusPill tone="slate">Pipeline v0.1 · synthetic</StatusPill></div></div>{demoCase.documents.map((document) => <DocumentRow document={document} key={document.id} />)}<div className="grid gap-4 border-t border-slate-100 bg-[#f8fbfa] p-5 md:grid-cols-3">{demoCase.documents.filter((d) => d.fields).flatMap((d) => d.fields || []).map((field) => <div key={field.label} className="rounded-xl border border-[#dce8e6] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">{field.label}</p><p className="mt-2 font-bold">{field.value}</p><div className="mt-3"><Confidence value={field.confidence} /></div></div>)}</div></div>;
}

function Evaluation() {
  const metrics = [["Document classification", "94%", "Macro-F1 · 50 labelled samples"], ["Field extraction", "91%", "Exact match · synthetic set"], ["Conflict detection", "88%", "Recall · 24 planted conflicts"], ["Human escalation", "100%", "Low-confidence policy coverage"]];
  return <div className="space-y-5 animate-rise"><div className="rounded-[22px] border border-[#dce8e6] bg-white p-6"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#6d8584]">Reference-set evaluation</p><h2 className="mt-2 text-2xl font-bold tracking-[-.03em]">Quality before capability claims</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">These numbers are demonstrative metrics from a labelled synthetic dataset—not production performance. The lab separates “the API runs” from “the model is correct”.</p><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([name, value, detail]) => <div key={name} className="rounded-2xl border border-[#dce8e6] bg-[#f8fbfa] p-4"><p className="text-xs font-semibold text-slate-500">{name}</p><p className="mt-3 text-3xl font-bold tracking-[-.04em] text-[#0b625d]">{value}</p><p className="mt-2 text-[11px] leading-4 text-slate-400">{detail}</p></div>)}</div></div><div className="rounded-[22px] border border-[#dce8e6] bg-white p-6"><h3 className="font-bold">Evaluation gates</h3><div className="mt-4 space-y-3">{["No automated decision endpoint", "Confidence below 90% routes to review", "Missing evidence blocks completion", "Prompts and outputs exclude raw identity documents"].map((text) => <div key={text} className="flex items-center gap-3 rounded-xl bg-[#f4f8f7] px-4 py-3 text-sm font-medium"><Check className="text-emerald-600" size={17} />{text}</div>)}</div></div></div>;
}

function Audit() {
  return <div className="animate-rise rounded-[22px] border border-[#dce8e6] bg-white p-6"><div className="flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#6d8584]">Tamper-aware event log</p><h2 className="mt-2 text-2xl font-bold tracking-[-.03em]">Audit trail</h2></div><StatusPill><ShieldCheck size={12} /> PII-safe logs</StatusPill></div><div className="mt-6">{demoCase.audit.map(([time, event, actor], index) => <div key={event} className="grid grid-cols-[55px_28px_1fr] gap-3 pb-6 last:pb-0"><p className="pt-0.5 text-xs font-semibold tabular-nums text-slate-400">{time}</p><div className="relative flex justify-center"><div className="z-10 mt-1.5 h-2.5 w-2.5 rounded-full bg-[#168175] ring-4 ring-[#e4f2ef]" />{index < demoCase.audit.length - 1 && <div className="absolute top-4 h-[calc(100%+8px)] w-px bg-[#dce8e6]" />}</div><div><p className="text-sm font-bold text-[#17383a]">{event}</p><p className="mt-1 text-xs text-slate-500">{actor}</p></div></div>)}</div></div>;
}

function Copilot({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error, stop, setMessages } = useChat({ transport: chatTransport });
  const busy = status === "submitted" || status === "streaming";
  const submit = async (text: string) => { const clean = text.trim(); if (!clean || busy) return; setInput(""); await sendMessage({ text: clean }); };
  const onSubmit = (event: FormEvent) => { event.preventDefault(); void submit(input); };
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex justify-end bg-[#082f2d]/35 p-0 backdrop-blur-sm md:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label="Nova AI copilot" className="flex h-full w-full flex-col overflow-hidden bg-[#f8fbfa] shadow-2xl md:max-w-[470px] md:rounded-[26px]">
    <header className="relative overflow-hidden bg-[#0b5551] px-5 pb-5 pt-5 text-white"><div className="absolute -right-14 -top-20 h-48 w-48 rounded-full bg-[#43ac95]/25 blur-2xl" /><div className="relative flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/20"><Sparkles size={21} /></div><div><div className="flex items-center gap-2"><h2 className="font-bold">Nova</h2><span className="h-2 w-2 rounded-full bg-[#74e4be]" /></div><p className="text-xs text-[#bde1da]">Case copilot · human-in-control</p></div></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 hover:bg-white/15" aria-label="Close"><X size={18} /></button></div><div className="relative mt-4 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-[11px] leading-4 text-[#cde8e2]">Explains synthetic case evidence. No credit decision or financial advice.</div></header>
    <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-4 py-5">{messages.length === 0 && <div><div className="rounded-2xl border border-[#dce8e6] bg-white p-4 text-sm leading-6 text-slate-600 shadow-sm"><span className="font-bold text-[#0b625d]">Guten Tag.</span> I can explain the demo case, required documents, OCR confidence, conflicts and the security architecture.</div><div className="mt-4 grid gap-2">{quickQuestions.map((question) => <button key={question} onClick={() => void submit(question)} className="flex items-center justify-between rounded-xl border border-[#dce8e6] bg-white px-4 py-3 text-left text-xs font-semibold text-[#315557] transition hover:border-[#7ab5aa] hover:bg-[#f0f8f5]">{question}<ArrowRight size={13} /></button>)}</div></div>}
      {messages.map((message) => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-[#0b625d] text-white" : "border border-[#dce8e6] bg-white text-slate-650 shadow-sm"}`}>{messageText(message)}</div></div>)}
      {status === "submitted" && <div className="flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 animate-pulse rounded-full bg-[#159184]" />Retrieving case evidence…</div>}{error && <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error.message}</p>}
    </div>
    <form onSubmit={onSubmit} className="border-t border-[#dce8e6] bg-white p-4"><div className="flex items-end gap-2 rounded-2xl border border-[#cddeda] bg-[#f8fbfa] p-2 focus-within:border-[#4f9e93]"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(input); } }} rows={1} placeholder="Ask about this synthetic case…" className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400" />{busy ? <button type="button" onClick={stop} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-200 text-slate-700" aria-label="Stop"><X size={16} /></button> : <button type="submit" disabled={!input.trim()} className="grid h-10 w-10 place-items-center rounded-xl bg-[#0b625d] text-white disabled:opacity-40" aria-label="Send"><Send size={16} /></button>}</div><div className="mt-2 flex items-center justify-between text-[10px] text-slate-400"><span>Azure OIDC when configured · local demo fallback</span>{messages.length > 0 && <button type="button" onClick={() => setMessages([])} className="font-semibold text-slate-500">Clear</button>}</div></form>
  </section></div>;
}

export function CreditWorkspace({ locale }: { locale: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [sidebar, setSidebar] = useState(false);
  const [chat, setChat] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const auth = useAuth();
  useEffect(() => {
    if (!auth.token) return;
    const controller = new AbortController();
    void fetch("/api/cases", {
      headers: { Authorization: `Bearer ${auth.token}` },
      signal: controller.signal,
    }).then((response) => setApiConnected(response.ok)).catch(() => setApiConnected(false));
    return () => controller.abort();
  }, [auth.token]);
  const javaApiConnected = Boolean(auth.token && apiConnected);
  const content = useMemo(() => tab === "overview" ? <Overview /> : tab === "documents" ? <Documents /> : tab === "evaluation" ? <Evaluation /> : <Audit />, [tab]);
  return <div className="min-h-screen bg-[#f3f7f6]">
    <div className="flex min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col border-r border-[#dce8e6] bg-[#f9fbfa] p-4 transition-transform lg:static lg:translate-x-0 ${sidebar ? "translate-x-0" : "-translate-x-full"}`}><div className="flex items-center justify-between px-2 py-2"><div className="flex items-center gap-3"><BrandMark /><div><p className="text-sm font-extrabold tracking-[-.02em]">Credit Intelligence</p><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#6c8583]">Banking AI Lab</p></div></div><button onClick={() => setSidebar(false)} className="lg:hidden"><PanelLeftClose size={18} /></button></div>
        <div className="mt-6 rounded-2xl border border-[#dce8e6] bg-white p-3"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e5f3ef] text-[#0b625d]"><BriefcaseBusiness size={17} /></div><div className="min-w-0"><p className="truncate text-xs font-bold">PraxisBank Demo</p><p className="truncate text-[10px] text-slate-400">Tenant · {auth.tenantId}</p></div><ChevronDown className="ml-auto text-slate-400" size={14} /></div></div>
        <nav className="mt-6 space-y-1">{tabItems.map(([id, label, Icon]) => <button key={id} onClick={() => { setTab(id); setSidebar(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${tab === id ? "bg-[#dff1ec] text-[#075c57]" : "text-[#5c7474] hover:bg-white hover:text-[#17383a]"}`}><Icon size={17} />{label}{id === "documents" && <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] text-amber-700">1 review</span>}</button>)}</nav>
        <div className="mt-auto rounded-2xl bg-[#0c4c49] p-4 text-white"><div className="flex items-center gap-2 text-xs font-bold"><LockKeyhole size={14} className="text-[#7bdec5]" /> Security lab</div><p className="mt-2 text-[11px] leading-5 text-[#bddbd5]">OAuth 2.0 · tenant claims · audit-safe events · keyless Azure AI</p></div><p className="mt-3 px-2 text-[9px] leading-4 text-slate-400">Independent portfolio project. Not affiliated with apoBank or any lender.</p>
      </aside>
      {sidebar && <button className="fixed inset-0 z-30 bg-[#082f2d]/30 lg:hidden" onClick={() => setSidebar(false)} aria-label="Close navigation" />}
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-[#dce8e6] bg-[#f3f7f6]/90 px-4 py-3 backdrop-blur-xl md:px-7"><div className="mx-auto flex max-w-[1500px] items-center gap-3"><button onClick={() => setSidebar(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-[#dce8e6] bg-white lg:hidden" aria-label="Open navigation"><Menu size={18} /></button><div className="relative hidden min-w-0 max-w-md flex-1 md:block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input className="h-10 w-full rounded-xl border border-[#dce8e6] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#73aca4]" placeholder="Search synthetic cases…" /></div><div className="ml-auto flex items-center gap-2"><StatusPill tone={javaApiConnected ? "mint" : auth.mode === "demo" ? "gold" : "slate"}>{javaApiConnected ? "Java API" : auth.mode === "demo" ? "Demo auth" : "Sign in"}</StatusPill><button onClick={() => auth.authenticated && auth.mode === "keycloak" ? auth.logout() : auth.login()} className="flex h-10 items-center gap-2 rounded-xl border border-[#dce8e6] bg-white px-3 text-xs font-bold text-[#35585a]"><CircleUserRound size={17} /><span className="hidden sm:inline">{auth.displayName}</span>{auth.mode === "keycloak" && !auth.authenticated && <LogIn size={14} />}</button><button onClick={() => setChat(true)} className="flex h-10 items-center gap-2 rounded-xl bg-[#0b625d] px-3 text-xs font-bold text-white shadow-[0_8px_20px_rgba(11,98,93,.18)]"><Sparkles size={16} /><span className="hidden sm:inline">Ask Nova</span></button></div></div></header>
        <div className="mx-auto max-w-[1500px] p-4 md:p-7"><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#6d8584]"><span className="h-2 w-2 rounded-full bg-emerald-500" />Secure workspace</div><h1 className="mt-2 text-3xl font-extrabold tracking-[-.045em] text-[#123537] md:text-[38px]">Good morning, {auth.displayName.split(" ")[0]}.</h1><p className="mt-2 text-sm text-slate-500">Review the evidence, not just the prediction.</p></div><div className="flex items-center gap-2 rounded-xl border border-[#dce8e6] bg-white px-3 py-2 text-xs text-slate-500"><Users size={15} className="text-[#0b625d]" /><b className="text-[#17383a]">{locale.toUpperCase()}</b> · ADVISOR · REVIEWER</div></div>{content}</div>
      </main>
    </div>
    <button onClick={() => setChat(true)} className="fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-[#0b625d] text-white shadow-[0_14px_34px_rgba(8,72,68,.28)] transition hover:-translate-y-1 md:hidden" aria-label="Open Nova"><MessageSquareText size={22} /></button>
    <Copilot open={chat} onClose={() => setChat(false)} />
  </div>;
}
