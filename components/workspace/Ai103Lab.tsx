"use client";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {ArrowLeft, ArrowUpRight, CloudOff, Play, Search, ShieldCheck, X} from "lucide-react";
import {ai103Locale, ai103Text, fill, type Ai103Text} from "@/lib/ai103/language";
import {
  buckets, checkResultSchema, filterCapabilities, statuses, summarize,
  type Capability, type CapabilityId, type CheckResult, type Side, type Status,
} from "@/lib/ai103/model";

type RunState = {state: "running"} | {state: "done"; result: CheckResult} | {state: "command"; command: string | null} | {state: "error"};

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

function SideRecord({label, side, t, locale}: {label: string; side: Side; t: Ai103Text; locale: string}) {
  const logPath = side.log.split("#")[0];
  return <section className="ai103-side" aria-label={`${label} · ${t.detail.latest}`}>
    <h3>{label} <StatusPill status={side.status} t={t}/></h3>
    <dl>
      <div><dt>{t.detail.lastTested}</dt><dd>{side.lastTested ? <time dateTime={side.lastTested}>{formatDate(side.lastTested, locale)}</time> : t.notTested}</dd></div>
      <div><dt>{t.detail.command}</dt><dd>{side.command ? <code>{side.command}</code> : t.notApplicable}</dd></div>
      <div><dt>{t.detail.expected}</dt><dd>{side.expected}</dd></div>
      <div><dt>{t.detail.actual}</dt><dd>{side.actual}</dd></div>
      <div><dt>{t.detail.latency}</dt><dd>{formatLatency(side.latencyMs, t)}</dd></div>
      <div><dt>{t.detail.cost}</dt><dd>{side.cost}</dd></div>
      <div><dt>{t.detail.evidence}</dt><dd><code title={side.log}>{fileName(logPath)}{side.log.includes("#") ? `#${side.log.split("#")[1]}` : ""}</code></dd></div>
    </dl>
  </section>;
}

function RunResult({run, capability, t, locale}: {run: RunState | undefined; capability: Capability; t: Ai103Text; locale: string}) {
  if (!run || run.state === "running") return null;
  if (run.state === "error") return <p className="notice-error" role="alert">{t.run.error}</p>;
  if (run.state === "command") return <div className="ai103-result ai103-result-neutral"><p>{t.run.noCheck}</p>{run.command ? <code>{run.command}</code> : null}</div>;
  const {result} = run;
  return <div className={`ai103-result ${result.passed ? "ai103-result-pass" : "ai103-result-fail"}`}>
    <h3>{t.run.heading}: {result.passed ? t.run.passed : t.run.failed}</h3>
    <p className="ai103-result-meta">
      {t.run.at} <time dateTime={result.ranAt}>{new Date(result.ranAt).toLocaleString(locale)}</time> · {t.detail.latency} {result.latencyMs} ms · {t.detail.cost}: {capability.local.cost}
    </p>
    <div className="ai103-scroll">
      <table className="ai103-cases">
        <caption>{t.run.cases}</caption>
        <thead><tr><th scope="col">{t.run.caseName}</th><th scope="col">{t.detail.expected}</th><th scope="col">{t.detail.actual}</th><th scope="col">{t.run.result}</th></tr></thead>
        <tbody>{result.cases.map((entry) => <tr key={entry.name}>
          <th scope="row">{entry.name}</th><td>{entry.expected}</td><td>{entry.actual}</td>
          <td><span className={`ai103-pill ${entry.passed ? "ai103-pill-verified-local" : "ai103-pill-blocked"}`}>{entry.passed ? t.run.passed : t.run.failed}</span></td>
        </tr>)}</tbody>
      </table>
    </div>
    {result.notRun.length ? <div className="ai103-not-run"><h4>{t.run.notRun}</h4><ul>{result.notRun.map((entry) => <li key={entry}>{entry}</li>)}</ul></div> : null}
  </div>;
}

/**
 * The AI-103 capability lab. Every status, date and result shown here comes from the manifest that the server
 * passes in, or from the server-side check run; the page never decides by itself that something passed.
 */
export function Ai103Lab({locale, capabilities}: {locale: string; capabilities: Capability[]}) {
  const t = ai103Text(locale);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status | "all">("all");
  const [selected, setSelected] = useState<CapabilityId | null>(null);
  const [runs, setRuns] = useState<Partial<Record<CapabilityId, RunState>>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const summary = useMemo(() => summarize(capabilities), [capabilities]);
  const nameOf = useCallback((id: CapabilityId) => t.capabilities[id].name, [t]);
  const visible = useMemo(() => filterCapabilities(capabilities, {status, query, nameOf}), [capabilities, status, query, nameOf]);
  const capability = capabilities.find((entry) => entry.id === selected);

  // A direct link (?capability=<id>) opens that lab.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const id = new URLSearchParams(window.location.search).get("capability");
      if (id && capabilities.some((entry) => entry.id === id)) setSelected(id as CapabilityId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [capabilities]);
  useEffect(() => {
    if (selected) heading.current?.focus();
  }, [selected]);

  function syncUrl(id: CapabilityId | null) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("capability", id);
    else url.searchParams.delete("capability");
    window.history.replaceState(window.history.state, "", url);
  }
  function open(id: CapabilityId, button: HTMLButtonElement) {
    opener.current = button;
    setSelected(id);
    syncUrl(id);
  }
  function close() {
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
      const result = checkResultSchema.parse(body);
      setRuns((current) => ({...current, [target.id]: {state: "done", result}}));
    } catch {
      setRuns((current) => ({...current, [target.id]: {state: "error"}}));
    }
  }

  const shown = fill(t.shown, {shown: visible.length, total: capabilities.length});
  const run = capability ? runs[capability.id] : undefined;
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
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.pageTitle}</h1>
      <p className="ai103-intro">{t.intro}</p>
    </header>

    <section className="ai103-kpis" aria-labelledby="ai103-kpi-title">
      <h2 id="ai103-kpi-title" className="ai103-visually-hidden">{t.kpiTitle}</h2>
      <dl className="ai103-kpi-grid">{buckets.map((bucket) => <div key={bucket} className={`ai103-kpi ai103-kpi-${bucket}`}>
        <dt>{t.kpi[bucket]}</dt><dd>{summary[bucket]}</dd>
      </div>)}</dl>
      <p className="ai103-kpi-note"><strong>{t.kpiNote}</strong> {t.kpiRule}</p>
    </section>

    <div className={`ai103-workspace${capability ? " ai103-workspace-open" : ""}`}>
      <section className="ai103-list surface" aria-labelledby="ai103-list-title">
        <div className="ai103-toolbar">
          <h2 id="ai103-list-title">{t.listTitle}</h2>
          <label className="ai103-search">
            <Search size={16} aria-hidden="true"/>
            <span className="ai103-visually-hidden">{t.search}</span>
            <input type="search" value={query} maxLength={100} placeholder={t.search} onChange={(event) => setQuery(event.target.value)}/>
          </label>
          <label className="ai103-filter">
            <span>{t.status}</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as Status | "all")}>
              <option value="all">{t.allStatuses}</option>
              {statuses.map((value) => <option key={value} value={value}>{t.statuses[value]}</option>)}
            </select>
          </label>
          <p className="ai103-count" role="status">{shown}</p>
        </div>
        {visible.length ? <div className="ai103-scroll">
          <table className="ai103-table" id="ai103-table">
            <caption className="ai103-visually-hidden">{t.listTitle} · {shown}</caption>
            <thead><tr>
              <th scope="col">{t.columns.capability}</th><th scope="col">{t.columns.local}</th><th scope="col">{t.columns.azure}</th>
              <th scope="col">{t.columns.fixture}</th><th scope="col">{t.columns.lastTested}</th><th scope="col"><span className="ai103-visually-hidden">{t.columns.action}</span></th>
            </tr></thead>
            <tbody>{visible.map((entry) => {
              const name = t.capabilities[entry.id].name;
              const position = capabilities.indexOf(entry) + 1;
              return <tr key={entry.id} className={selected === entry.id ? "ai103-row-selected" : undefined}>
                <th scope="row" data-label={t.columns.capability}><span className="ai103-row-number" aria-hidden="true">{String(position).padStart(2, "0")}</span>{name}</th>
                <td data-label={t.columns.local}><StatusPill status={entry.local.status} t={t}/></td>
                <td data-label={t.columns.azure}>{entry.azure ? <StatusPill status={entry.azure.status} t={t}/> : <span className="ai103-muted">{t.notApplicable}</span>}</td>
                <td data-label={t.columns.fixture}><span className="ai103-fixture-cell"><code title={entry.fixtures[0]}>{fileName(entry.fixtures[0])}</code>{entry.fixtures.length > 1 ? <small> {fill(t.moreFixtures, {count: entry.fixtures.length - 1})}</small> : null}</span></td>
                <td data-label={t.columns.lastTested}>{entry.local.lastTested ? <time dateTime={entry.local.lastTested}>{formatDate(entry.local.lastTested, locale)}</time> : t.notTested}</td>
                <td className="ai103-action-cell">
                  <button type="button" className="button-secondary ai103-open" aria-label={`${t.openLab}: ${name}`} aria-expanded={selected === entry.id} aria-controls="ai103-detail" onClick={(event) => open(entry.id, event.currentTarget)}>
                    {t.openLab}<ArrowUpRight size={15} aria-hidden="true"/>
                  </button>
                </td>
              </tr>;
            })}</tbody>
          </table>
        </div> : <div className="ai103-empty"><p>{t.noMatches}</p><button type="button" className="button-secondary" onClick={() => { setQuery(""); setStatus("all"); }}>{t.reset}</button></div>}
      </section>

      {capability ? <section id="ai103-detail" className="ai103-detail surface" aria-labelledby="ai103-detail-title">
        <header className="ai103-detail-header">
          <div>
            <p className="eyebrow">{t.columns.capability} {String(capabilities.indexOf(capability) + 1).padStart(2, "0")} / {capabilities.length}</p>
            <h2 id="ai103-detail-title" tabIndex={-1} ref={heading}>{t.capabilities[capability.id].name}</h2>
          </div>
          <button type="button" className="icon-button" aria-label={`${t.close}: ${t.capabilities[capability.id].name}`} onClick={close}><X size={18} aria-hidden="true"/></button>
        </header>
        <dl className="ai103-facts">
          <div><dt>{t.detail.business}</dt><dd>{t.capabilities[capability.id].useCase}</dd></div>
          <div><dt>{t.detail.pipeline}</dt><dd>{t.capabilities[capability.id].pipeline}</dd></div>
          <div><dt>{t.detail.localEquivalent}</dt><dd>{t.capabilities[capability.id].localEquivalent}</dd></div>
          <div><dt>{t.detail.azureService}</dt><dd>{capability.azureService ?? t.notApplicable}</dd></div>
          <div><dt>{t.detail.samples}</dt><dd><ul className="ai103-fixtures">{capability.fixtures.map((path) => <li key={path}><code>{path}</code></li>)}</ul></dd></div>
        </dl>
        {capability.parts ? <div className="ai103-parts">
          <h3>{t.detail.parts}</h3>
          <ul>{capability.parts.map((part) => <li key={part.name}><span>{t.parts[part.name] ?? part.name}</span><StatusPill status={part.status} t={t}/></li>)}</ul>
        </div> : null}
        <div className="ai103-sides">
          <SideRecord label={t.detail.localSide} side={capability.local} t={t} locale={locale}/>
          {capability.azure ? <SideRecord label={t.detail.azureSide} side={capability.azure} t={t} locale={locale}/> : null}
        </div>
        <div className="ai103-actions">
          <button type="button" className="button-primary" onClick={() => void runLocal(capability)} disabled={run?.state === "running"}>
            <Play size={15} aria-hidden="true"/>{run?.state === "running" ? t.run.running : t.run.local}
          </button>
          <p className="ai103-azure-off"><CloudOff size={15} aria-hidden="true"/>{capability.azure ? t.run.azureOff : `${t.detail.azureService}: ${t.notApplicable}`}</p>
        </div>
        <div aria-live="polite"><RunResult run={run} capability={capability} t={t} locale={locale}/></div>
        <div className="ai103-limits">
          <h3>{t.detail.limits}</h3>
          <ul>{t.capabilities[capability.id].limits.map((entry) => <li key={entry}>{entry}</li>)}</ul>
        </div>
      </section> : null}
    </div>

    <section className="ai103-decision surface" aria-labelledby="ai103-decision-title">
      <h2 id="ai103-decision-title">{t.decision.title}</h2>
      <p>{t.decision.intro}</p>
      <div className="ai103-scroll">
        <table className="ai103-matrix">
          <thead><tr>{(["choice", "data", "latency", "cost", "governance", "local", "use"] as const).map((key) => <th key={key} scope="col">{t.decision.columns[key]}</th>)}</tr></thead>
          <tbody>{t.decision.rows.map((row) => <tr key={row.choice}>
            <th scope="row">{row.choice}</th><td>{row.data}</td><td>{row.latency}</td><td>{row.cost}</td><td>{row.governance}</td><td>{row.local}</td><td>{row.use}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    <p className="ai103-footnote"><ShieldCheck size={15} aria-hidden="true"/><span>{t.footnote} {t.detail.recordedEnglish}</span></p>
  </main>;
}
