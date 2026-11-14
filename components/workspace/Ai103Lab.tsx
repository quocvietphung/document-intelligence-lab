"use client";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {ArrowLeft, BookOpen, CloudOff, Play, Search, ShieldCheck, X} from "lucide-react";
import {ai103Locale, ai103Text, fill, type Ai103Text} from "@/lib/ai103/language";
import {
  azureStatuses, buckets, checkResultSchema, filterCapabilities, groupIds, localStatuses, summarize,
  type Capability, type CapabilityId, type CheckResult, type GroupId, type Side, type Status,
} from "@/lib/ai103/model";

type RunState = {state: "running"} | {state: "done"; result: CheckResult} | {state: "command"; command: string | null} | {state: "error"};
type StatusFilter = Status | "all" | "no-azure-adapter";

const fileName = (path: string) => path.split("/").pop() ?? path;
function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeZone: "UTC"}).format(new Date(`${value}T00:00:00Z`));
}
function formatLatency(value: number | null, t: Ai103Text) {
  if (value === null) return t.detail.notMeasured;
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${value} ms`;
}

function StatusPill({status, t}: {status: Status; t: Ai103Text}) {
  return <span className={`ai103-pill ai103-pill-${status}`}>{t.statuses[status]}</span>;
}
function AzurePill({capability, t}: {capability: Capability; t: Ai103Text}) {
  return capability.azure ? <StatusPill status={capability.azure.status} t={t}/> : <span className="ai103-pill ai103-pill-none">{t.noAzure}</span>;
}

function Record({side, t, locale}: {side: Side; t: Ai103Text; locale: string}) {
  return <dl className="ai103-record">
    <div><dt>{t.detail.lastTested}</dt><dd>{side.lastTested ? <time dateTime={side.lastTested}>{formatDate(side.lastTested, locale)}</time> : t.notTested}</dd></div>
    <div><dt>{t.detail.command}</dt><dd>{side.command ? <code>{side.command}</code> : t.notApplicable}</dd></div>
    <div><dt>{t.detail.expected}</dt><dd>{side.expected}</dd></div>
    <div><dt>{t.detail.actual}</dt><dd>{side.actual}</dd></div>
    <div><dt>{t.detail.latency}</dt><dd>{formatLatency(side.latencyMs, t)}</dd></div>
    <div><dt>{t.detail.cost}</dt><dd>{side.cost}</dd></div>
    <div><dt>{t.detail.evidence}</dt><dd><code>{side.log}</code></dd></div>
  </dl>;
}

function RunResult({run, capability, t, locale}: {run: RunState | undefined; capability: Capability; t: Ai103Text; locale: string}) {
  if (!run || run.state === "running") return null;
  if (run.state === "error") return <p className="notice-error" role="alert">{t.run.error}</p>;
  if (run.state === "command") return <div className="ai103-result ai103-result-neutral"><p>{t.run.noCheck}</p>{run.command ? <code>{run.command}</code> : null}</div>;
  const {result} = run;
  return <div className={`ai103-result ${result.passed ? "ai103-result-pass" : "ai103-result-fail"}`}>
    <h4>{t.run.heading}: {result.passed ? t.run.passed : t.run.failed}</h4>
    <p className="ai103-result-meta">{t.run.at} <time dateTime={result.ranAt}>{new Date(result.ranAt).toLocaleString(locale)}</time> · {t.detail.latency} {result.latencyMs} ms · {t.detail.cost}: {capability.local.cost}</p>
    <div className="ai103-scroll">
      <table className="ai103-cases">
        <caption>{t.run.cases}</caption>
        <thead><tr><th scope="col">{t.run.caseName}</th><th scope="col">{t.detail.expected}</th><th scope="col">{t.detail.actual}</th><th scope="col">{t.run.result}</th></tr></thead>
        <tbody>{result.cases.map((entry) => <tr key={entry.name}>
          <th scope="row">{entry.name}</th><td>{entry.expected}</td><td>{entry.actual}</td>
          <td><span className={`ai103-pill ${entry.passed ? "ai103-pill-local-real" : "ai103-pill-fail"}`}>{entry.passed ? t.run.passed : t.run.failed}</span></td>
        </tr>)}</tbody>
      </table>
    </div>
    {result.notRun.length ? <div className="ai103-not-run"><h5>{t.run.notRun}</h5><ul>{result.notRun.map((entry) => <li key={entry}>{entry}</li>)}</ul></div> : null}
  </div>;
}

function Detail({capability, t, locale, run, onRun, onClose}: {capability: Capability; t: Ai103Text; locale: string; run: RunState | undefined; onRun: () => void; onClose: () => void}) {
  const copy = t.capabilities[capability.id];
  return <div className="ai103-drawer-body">
    <header className="ai103-drawer-head">
      <div><p className="eyebrow">{t.groups[capability.group]}</p><h2 id="ai103-detail-title">{copy.name}</h2></div>
      <button type="button" className="icon-button" aria-label={`${t.close}: ${copy.name}`} onClick={onClose}><X size={18} aria-hidden="true"/></button>
    </header>
    <dl className="ai103-contract">
      <div><dt>{t.detail.business}</dt><dd>{copy.useCase}</dd></div>
      <div><dt>{t.input}</dt><dd>{copy.input}</dd></div>
      <div><dt>{t.detail.samples}</dt><dd><ul className="ai103-fixtures">{capability.fixtures.map((path) => <li key={path}><code>{path}</code></li>)}</ul></dd></div>
      <div><dt>{t.detail.pipeline}</dt><dd>{copy.pipeline}</dd></div>
    </dl>
    {capability.parts ? <ul className="ai103-parts">{capability.parts.map((part) => <li key={part.name}><span>{t.parts[part.name] ?? part.name}</span><StatusPill status={part.status} t={t}/></li>)}</ul> : null}
    <section className="ai103-side" aria-labelledby="ai103-local-title">
      <h3 id="ai103-local-title">{t.detail.localEquivalent} <StatusPill status={capability.local.status} t={t}/></h3>
      <p>{copy.localEquivalent}</p>
      <Record side={capability.local} t={t} locale={locale}/>
      <button type="button" className="button-primary" onClick={onRun} disabled={run?.state === "running"}>
        <Play size={15} aria-hidden="true"/>{run?.state === "running" ? t.run.running : t.run.local}
      </button>
      <div aria-live="polite"><RunResult run={run} capability={capability} t={t} locale={locale}/></div>
    </section>
    <section className="ai103-side" aria-labelledby="ai103-azure-title">
      <h3 id="ai103-azure-title">{t.azureImplementation} <AzurePill capability={capability} t={t}/></h3>
      <p>{copy.azureImplementation}</p>
      {capability.azure ? <Record side={capability.azure} t={t} locale={locale}/> : null}
      <button type="button" className="button-secondary" disabled aria-describedby="ai103-azure-off"><CloudOff size={15} aria-hidden="true"/>{t.run.azure}</button>
      <p id="ai103-azure-off" className="ai103-muted">{t.azureDisabled}</p>
      <a className="button-link ai103-learn" href={capability.learnUrl} target="_blank" rel="noopener noreferrer"><BookOpen size={15} aria-hidden="true"/>{t.learn}</a>
    </section>
    {capability.id === "service-selection" ? <section className="ai103-side" aria-labelledby="ai103-matrix-title">
      <h3 id="ai103-matrix-title">{t.decision.title}</h3>
      <p>{t.decision.intro}</p>
      <div className="ai103-scroll"><table className="ai103-matrix">
        <thead><tr>{(["choice", "data", "latency", "cost", "governance", "local", "use"] as const).map((key) => <th key={key} scope="col">{t.decision.columns[key]}</th>)}</tr></thead>
        <tbody>{t.decision.rows.map((row) => <tr key={row.choice}><th scope="row">{row.choice}</th><td>{row.data}</td><td>{row.latency}</td><td>{row.cost}</td><td>{row.governance}</td><td>{row.local}</td><td>{row.use}</td></tr>)}</tbody>
      </table></div>
    </section> : null}
    <section className="ai103-limits"><h3>{t.detail.limits}</h3><ul>{copy.limits.map((entry) => <li key={entry}>{entry}</li>)}</ul></section>
  </div>;
}

/**
 * The AI-103 capability lab: one viewport on desktop. Five groups as tabs, a compact grid of the selected group, and a
 * drawer per capability. Every status and result comes from the manifest or from the server-side check run.
 */
export function Ai103Lab({locale, capabilities}: {locale: string; capabilities: Capability[]}) {
  const t = ai103Text(locale);
  const [group, setGroup] = useState<GroupId>("ingest");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<CapabilityId | null>(null);
  const [runs, setRuns] = useState<Partial<Record<CapabilityId, RunState>>>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const summary = useMemo(() => summarize(capabilities), [capabilities]);
  const nameOf = useCallback((id: CapabilityId) => t.capabilities[id].name, [t]);
  const searching = query.trim() !== "" || status !== "all";
  const visible = useMemo(() => filterCapabilities(capabilities, {status, query, nameOf, group: searching ? undefined : group}), [capabilities, status, query, nameOf, group, searching]);
  const capability = capabilities.find((entry) => entry.id === selected);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const id = new URLSearchParams(window.location.search).get("capability");
      const found = capabilities.find((entry) => entry.id === id);
      if (found) {
        setGroup(found.group);
        setSelected(found.id);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [capabilities]);
  useEffect(() => {
    const element = dialog.current;
    if (selected && element && !element.open) element.showModal();
  }, [selected]);

  function syncUrl(id: CapabilityId | null) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("capability", id);
    else url.searchParams.delete("capability");
    window.history.replaceState(window.history.state, "", url);
  }
  function open(id: CapabilityId, element: HTMLElement) {
    opener.current = element;
    setSelected(id);
    syncUrl(id);
  }
  function closed() {
    setSelected(null);
    syncUrl(null);
    opener.current?.focus();
  }
  async function runLocal(target: Capability) {
    setRuns((current) => ({...current, [target.id]: {state: "running"}}));
    try {
      const response = await fetch(`/api/ai103/capabilities/${encodeURIComponent(target.id)}/run-local`, {method: "POST", cache: "no-store"});
      if (!response.ok) throw new Error(`status ${response.status}`);
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "mode" in body && body.mode === "command") {
        const command = "command" in body && typeof body.command === "string" ? body.command : null;
        setRuns((current) => ({...current, [target.id]: {state: "command", command}}));
        return;
      }
      setRuns((current) => ({...current, [target.id]: {state: "done", result: checkResultSchema.parse(body)}}));
    } catch {
      setRuns((current) => ({...current, [target.id]: {state: "error"}}));
    }
  }

  const shown = fill(t.shown, {shown: visible.length, total: capabilities.length});
  return <main className="ai103-lab">
    <header className="ai103-header">
      <div className="ai103-header-row">
        <a href={`/${ai103Locale(locale)}`} className="button-link ai103-back"><ArrowLeft size={16} aria-hidden="true"/>{t.back}</a>
        <nav className="ai103-languages" aria-label={t.language}>
          {(["en", "de", "vi"] as const).map((code) => <a key={code} href={`/${code}/ai103`} hrefLang={code} lang={code} aria-current={code === ai103Locale(locale) ? "true" : undefined}>
            {code === "en" ? "English" : code === "de" ? "Deutsch" : "Tiếng Việt"}
          </a>)}
        </nav>
      </div>
      <div className="ai103-title-row">
        <div><p className="eyebrow">{t.eyebrow}</p><h1>{t.pageTitle}</h1><p className="ai103-intro">{t.intro}</p></div>
        <section aria-labelledby="ai103-kpi-title" className="ai103-kpis">
          <h2 id="ai103-kpi-title" className="ai103-visually-hidden">{t.kpiTitle}</h2>
          <dl className="ai103-kpi-grid">{buckets.map((bucket) => <div key={bucket} className={`ai103-kpi ai103-kpi-${bucket}`}><dt>{t.kpi[bucket]}</dt><dd>{summary[bucket]}</dd></div>)}</dl>
          <p className="ai103-kpi-note"><strong>{t.kpiNote}</strong> {t.kpiRule}</p>
        </section>
      </div>
    </header>

    <section className="ai103-board surface" aria-labelledby="ai103-board-title">
      <h2 id="ai103-board-title" className="ai103-visually-hidden">{t.listTitle}</h2>
      <div className="ai103-toolbar">
        <div className="ai103-groups" role="tablist" aria-label={t.groupsLabel}>
          {groupIds.map((id) => {
            const count = capabilities.filter((entry) => entry.group === id).length;
            return <button key={id} type="button" role="tab" id={`ai103-tab-${id}`} aria-controls="ai103-panel" aria-selected={!searching && group === id}
              className="ai103-group" onClick={() => { setGroup(id); setQuery(""); setStatus("all"); }}>{t.groups[id]} <span>{count}</span></button>;
          })}
        </div>
        <label className="ai103-search">
          <Search size={16} aria-hidden="true"/><span className="ai103-visually-hidden">{t.search}</span>
          <input type="search" value={query} maxLength={100} placeholder={t.search} onChange={(event) => setQuery(event.target.value)}/>
        </label>
        <label className="ai103-filter"><span>{t.status}</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
            <option value="all">{t.allStatuses}</option>
            {localStatuses.map((value) => <option key={value} value={value}>{t.statuses[value]}</option>)}
            {azureStatuses.map((value) => <option key={value} value={value}>{t.statuses[value]}</option>)}
            <option value="no-azure-adapter">{t.noAzure}</option>
          </select>
        </label>
      </div>
      <div id="ai103-panel" role="tabpanel" aria-labelledby={searching ? undefined : `ai103-tab-${group}`} aria-label={searching ? t.allResults : undefined}>
        <p className="ai103-count" role="status">{searching ? `${t.allResults} · ` : ""}{shown}</p>
        {visible.length ? <ul className="ai103-grid">{visible.map((entry) => {
          const name = t.capabilities[entry.id].name;
          return <li key={entry.id}>
            <button type="button" className={`ai103-tile${selected === entry.id ? " ai103-tile-selected" : ""}`} aria-haspopup="dialog" aria-label={`${t.openLab}: ${name}`}
              onClick={(event) => open(entry.id, event.currentTarget)}>
              <span className="ai103-tile-name">{name}</span>
              <span className="ai103-tile-badges"><StatusPill status={entry.local.status} t={t}/><AzurePill capability={entry} t={t}/></span>
              <span className="ai103-tile-meta"><code>{fileName(entry.fixtures[0])}</code>{entry.local.lastTested ? <time dateTime={entry.local.lastTested}>{formatDate(entry.local.lastTested, locale)}</time> : null}</span>
              {searching ? <span className="ai103-tile-group">{t.groups[entry.group]}</span> : null}
            </button>
          </li>;
        })}</ul> : <div className="ai103-empty"><p>{t.noMatches}</p><button type="button" className="button-secondary" onClick={() => { setQuery(""); setStatus("all"); }}>{t.reset}</button></div>}
      </div>
    </section>

    <p className="ai103-footnote"><ShieldCheck size={15} aria-hidden="true"/><span>{t.footnote} {t.detail.recordedEnglish}</span></p>

    <dialog ref={dialog} className="ai103-drawer" aria-labelledby="ai103-detail-title" onClose={closed}>
      {capability ? <Detail capability={capability} t={t} locale={locale} run={runs[capability.id]} onRun={() => void runLocal(capability)} onClose={() => dialog.current?.close()}/> : null}
    </dialog>
  </main>;
}
