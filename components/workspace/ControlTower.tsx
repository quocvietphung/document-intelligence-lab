"use client";
import {useCallback, useEffect, useMemo, useState} from "react";
import {ArrowLeft, RefreshCw} from "lucide-react";
import {useAuth} from "@/components/auth/KeycloakProvider";
import {
  areaKpis, areas, controlTowerText, defaultDossier, dossierChoices, formatKpi, kpiDetail, latestControlTower, parseBox,
  type Area, type ControlTower as Tower, type DossierChoices, type DossierOption,
} from "@/lib/control-tower";
import {Badge, CheckChart, CostChart, FlowChart, KpiChart, ModelChart, StageChart} from "./ControlTowerCharts";

type Copy = ReturnType<typeof controlTowerText>;
type Loaded = ReturnType<typeof latestControlTower>;

function Kpis({tower, keys, t, locale}: {tower: Tower; keys: string[]; t: Copy; locale: string}) {
  const shown = tower.kpis.filter((kpi) => keys.includes(kpi.key));
  return <div className="ct-kpis">{shown.map((kpi) => <div key={kpi.key} className="ct-kpi">
    <span>{t.kpis[kpi.key] ?? kpi.key}</span>
    <strong>{kpi.mode === "not-run" ? "—" : formatKpi(kpi.value, kpi.unit, locale)}</strong>
    <small><Badge mode={kpi.mode} t={t}/> {kpiDetail(kpi, t.details)}</small>
  </div>)}</div>;
}

/** Pipeline: two headline numbers, then the charts that carry the rest: step latency, layer flow and the checks. */
function Pipeline({tower, t, locale}: {tower: Tower; t: Copy; locale: string}) {
  return <>
    <Kpis tower={tower} keys={areaKpis.pipeline} t={t} locale={locale}/>
    <div className="ct-charts"><StageChart tower={tower} t={t} locale={locale}/><FlowChart tower={tower} t={t} locale={locale}/><CheckChart tower={tower} t={t}/></div>
  </>;
}

function Quality({tower, t, locale}: {tower: Tower; t: Copy; locale: string}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [kpiKey, setKpiKey] = useState("ocr_disagreement_rate");
  const row = tower.drill.find((entry) => entry.observationId === selected);
  const box = parseBox(row?.boundingBox ?? null);
  const kpi = [...tower.kpis, ...tower.simulatedKpis].find((entry) => entry.key === kpiKey && (row?.mode === "simulated" ? entry.mode === "simulated" : entry.mode !== "simulated"));
  return <>
    <Kpis tower={tower} keys={areaKpis.quality} t={t} locale={locale}/>
    {tower.simulatedKpis.length ? <div className="ct-simulated" role="note">{tower.simulatedKpis.map((entry) => <p key={entry.key}><Badge mode={entry.mode} t={t}/> {t.kpis[entry.key] ?? entry.key}: <strong>{formatKpi(entry.value, entry.unit, locale)}</strong> · {t.simulated}</p>)}</div> : null}
    <div className="ct-split">
      <div className="ai103-scroll"><table className="ct-table"><caption>{t.captions.observations}</caption>
        <thead><tr><th scope="col">{t.columns.document}</th><th scope="col">{t.columns.page}</th><th scope="col">{t.columns.field}</th><th scope="col">{t.columns.raw}</th><th scope="col">{t.columns.reviewed}</th><th scope="col">{t.columns.mode}</th></tr></thead>
        <tbody>{tower.drill.map((entry) => <tr key={entry.observationId} data-selected={entry.observationId === selected}>
          <td><button type="button" className="button-link" aria-pressed={entry.observationId === selected} onClick={() => { setSelected(entry.observationId); setKpiKey("ocr_disagreement_rate"); }}>{entry.documentName}</button></td>
          <td>{entry.page}</td><td>{entry.field}</td><td>{entry.rawValue}</td><td>{entry.reviewedValue ?? t.drill.none}</td><td><Badge mode={entry.mode} t={t}/></td>
        </tr>)}</tbody>
      </table></div>
      <section className="ct-drill" aria-labelledby="ct-drill-title" aria-live="polite">
        <h3 id="ct-drill-title">{t.drill.title}</h3>
        {row ? <dl className="ct-chain">
          <div><dt>{t.drill.kpi}</dt><dd>{t.kpis[kpiKey]}: {kpi ? formatKpi(kpi.value, kpi.unit, locale) : "—"} {kpi ? <Badge mode={kpi.mode} t={t}/> : null}</dd></div>
          <div><dt>{t.drill.document}</dt><dd>{row.documentName} · {row.provider} · <code>{row.model}</code></dd></div>
          <div><dt>{t.drill.page}</dt><dd>{row.page}</dd></div>
          <div><dt>{t.drill.box}</dt><dd>{box ? <><div className="ct-page-box" role="img" aria-label={`${t.drill.box} ${box.join(", ")}`}>
            <span style={{left: `${box[0] * 100}%`, top: `${box[1] * 100}%`, width: `${Math.max(1, (box[2] - box[0]) * 100)}%`, height: `${Math.max(1, (box[3] - box[1]) * 100)}%`}}/></div>
            <code>[{box.join(", ")}]</code> · {row.bboxSource}</> : t.drill.noBox}</dd></div>
          <div><dt>{t.drill.ocr}</dt><dd>{row.ocrText ?? "—"}</dd></div>
          <div><dt>{t.drill.normalized}</dt><dd>{row.normalizedValue ?? "—"} <small>({t.columns.raw}: {row.rawValue})</small></dd></div>
          <div><dt>{t.drill.reviewed}</dt><dd>{row.reviewedValue ?? t.drill.none} · {row.reviewStatus} · <Badge mode={row.mode} t={t}/></dd></div>
        </dl> : <p className="ct-note">{t.drill.empty}</p>}
      </section>
    </div>
  </>;
}

/** RAG: each ratio once, as a bar with its detail, then the case tables behind them. */
function Rag({tower, t, locale}: {tower: Tower; t: Copy; locale: string}) {
  return <>
    <div className="ct-charts"><KpiChart tower={tower} keys={areaKpis.rag} id="ct-chart-rag" title={t.charts.ragKpis} note={t.charts.ragNote} t={t} locale={locale}/></div>
    <div className="ct-split">
      <div className="ai103-scroll"><table className="ct-table"><caption>{t.captions.retrieval}</caption>
        <thead><tr><th scope="col">{t.columns.case}</th><th scope="col">{t.columns.expected}</th><th scope="col">{t.columns.rank}</th><th scope="col">{t.columns.result}</th></tr></thead>
        <tbody>{tower.retrieval.map((entry) => <tr key={entry.case}><th scope="row">{entry.case}</th><td>{entry.expectedAbstain ? t.abstained : entry.expected}</td><td>{entry.rank ?? "—"}</td>
          <td>{entry.passed ? t.passed : t.failed} <Badge mode={entry.mode} t={t}/></td></tr>)}</tbody>
      </table></div>
      <div className="ai103-scroll"><table className="ct-table"><caption>{t.captions.citations}</caption>
        <thead><tr><th scope="col">{t.columns.value}</th><th scope="col">{t.columns.expected}</th><th scope="col">{t.columns.found}</th><th scope="col">{t.columns.box}</th></tr></thead>
        <tbody>{tower.citations.map((entry) => <tr key={entry.case}><th scope="row">{entry.value}</th><td>{entry.expected}</td><td>{entry.found ?? "—"}</td><td>{entry.bboxMatch ? t.passed : t.failed}</td></tr>)}</tbody>
      </table></div>
    </div>
  </>;
}

/** Cost: the per-document figure, then the configured cost and the valid observations of each model. */
function Cost({tower, t, locale}: {tower: Tower; t: Copy; locale: string}) {
  return <>
    <Kpis tower={tower} keys={areaKpis.cost} t={t} locale={locale}/>
    <div className="ct-charts"><CostChart tower={tower} t={t} locale={locale}/><ModelChart tower={tower} t={t}/></div>
  </>;
}

const dossierOption = (entry: DossierOption) => <option key={entry.id} value={entry.id}>{entry.label}</option>;

/** Reads one dossier's latest ETL run with Control Tower marts. Nothing on this page writes data or calls a cloud service. */
export function ControlTower({locale}: {locale: string}) {
  const t = controlTowerText(locale);
  const auth = useAuth();
  const [choices, setChoices] = useState<DossierChoices>({known: false, ready: [], others: []});
  const [caseId, setCaseId] = useState<string>("");
  const [loaded, setLoaded] = useState<Loaded | undefined>();
  const [error, setError] = useState(false);
  const [area, setArea] = useState<Area>("pipeline");
  const headers = useMemo(() => ({Authorization: `Bearer ${auth.token}`}), [auth.token]);

  useEffect(() => {
    if (!auth.authenticated || !auth.token) return;
    const controller = new AbortController();
    // The list of dossiers with marts is optional: an older API without it still shows every dossier.
    const runs = fetch("/api/cases/control-tower-runs", {headers, cache: "no-store", signal: controller.signal})
      .then((response) => response.ok ? response.json() as Promise<unknown> : undefined).catch(() => undefined);
    const timer = window.setTimeout(() => void fetch("/api/cases", {headers, cache: "no-store", signal: controller.signal}).then(async (response) => {
      if (!response.ok) throw new Error();
      const list = (await response.json()) as {id: string; applicant?: string; purpose?: string}[];
      const options = list.map((entry) => ({id: entry.id, label: `${entry.id}${entry.purpose ? ` · ${entry.purpose}` : ""}`}));
      const next = dossierChoices(options, await runs);
      if (controller.signal.aborted) return;
      setChoices(next);
      const requested = new URLSearchParams(window.location.search).get("case");
      setCaseId((current) => current || defaultDossier(requested, next));
    }).catch(() => { if (!controller.signal.aborted) setError(true); }), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [auth.authenticated, auth.token, headers]);

  const load = useCallback(async (id: string, signal?: AbortSignal) => {
    setLoaded(undefined);
    setError(false);
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(id)}/platform/etl`, {headers, cache: "no-store", signal});
      if (!response.ok) throw new Error();
      setLoaded(latestControlTower(await response.json()));
    } catch {
      if (!signal?.aborted) setError(true);
    }
  }, [headers]);
  useEffect(() => {
    if (!caseId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(caseId, controller.signal), 0);
    const url = new URL(window.location.href);
    url.searchParams.set("case", caseId);
    window.history.replaceState(window.history.state, "", url);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [caseId, load]);

  const tower = loaded?.state === "ready" ? loaded.tower : undefined;
  return <main className="ct-page">
    <a href={`/${locale === "de" || locale === "vi" ? locale : "en"}`} className="button-link ai103-back"><ArrowLeft size={16} aria-hidden="true"/>{t.back}</a>
    <header className="ct-head">
      <div><h1>{t.title}</h1><p>{t.intro}</p></div>
      {auth.authenticated ? <div className="ct-controls">
        <label>{t.dossier}<select value={caseId} onChange={(event) => setCaseId(event.target.value)}>{choices.known ? <>
          {choices.ready.length ? <optgroup label={t.withData.replace("{count}", String(choices.ready.length))}>{choices.ready.map(dossierOption)}</optgroup> : null}
          {choices.others.length ? <optgroup label={t.withoutData.replace("{count}", String(choices.others.length))}>{choices.others.map(dossierOption)}</optgroup> : null}
        </> : choices.others.map(dossierOption)}</select></label>
        <button type="button" className="button-secondary" onClick={() => caseId && void load(caseId)}><RefreshCw size={15} aria-hidden="true"/>{t.refresh}</button>
      </div> : null}
    </header>
    <div className="ct-legend" aria-label={t.legend}>{t.legend}: <Badge mode="measured" t={t}/> <Badge mode="simulated" t={t}/> <Badge mode="configured" t={t}/> <Badge mode="not-run" t={t}/></div>
    {!auth.ready ? <p className="ct-note" role="status">{t.loading}</p>
      : !auth.authenticated ? <div className="surface ct-empty"><p>{t.signIn}</p><button type="button" className="button-primary" onClick={() => auth.login()}>{auth.displayName}</button></div>
      : error ? <p className="notice-error" role="alert">{t.error}</p>
      : !loaded ? <p className="ct-note" role="status">{t.loading}</p>
      : loaded.state !== "ready" ? <div className="surface ct-empty">
        <p>{loaded.state === "older" ? t.older : t.noRun}</p>
        <a className="button-primary" href={`/${locale}?case=${encodeURIComponent(caseId)}&pipeline=assets#pipeline`}>{t.openPipeline}</a>
        {choices.ready.some((entry) => entry.id !== caseId) ? <div className="ct-empty-alternatives">
          <p>{t.openWithData}</p>
          <ul>{choices.ready.filter((entry) => entry.id !== caseId).slice(0, 3).map((entry) =>
            <li key={entry.id}><button type="button" className="button-link" onClick={() => setCaseId(entry.id)}>{entry.label}</button></li>)}</ul>
        </div> : null}
      </div>
      : tower ? <>
        <p className="ct-run">{t.run} <code>{loaded.run.id}</code> · {new Date(loaded.run.time).toLocaleString(locale)} · {t.method} <code>{loaded.run.method}</code>{loaded.run.current ? "" : ` · ${t.historical}`}</p>
        <section className="surface ct-board" aria-label={t.title}>
          <div className="ct-tabs" role="tablist" aria-label={t.title}>{areas.map((id) => <button key={id} type="button" role="tab" id={`ct-tab-${id}`} aria-controls="ct-panel" aria-selected={area === id} onClick={() => setArea(id)}>{t.areas[id]}</button>)}</div>
          <div className="ct-panel" id="ct-panel" role="tabpanel" aria-labelledby={`ct-tab-${area}`}>
            {area === "pipeline" ? <Pipeline tower={tower} t={t} locale={locale}/> : area === "quality" ? <Quality tower={tower} t={t} locale={locale}/> : area === "rag" ? <Rag tower={tower} t={t} locale={locale}/> : <Cost tower={tower} t={t} locale={locale}/>}
          </div>
        </section>
        <section className="surface ct-panel" aria-labelledby="ct-export-title">
          <h2 id="ct-export-title" className="section-heading">{t.captions.export}</h2>
          <details className="ct-more"><summary className="ct-note">{t.columns.table} · {tower.export.length}</summary>
            <ul className="ct-files">{tower.export.map((file) => <li key={file.table}><code>{file.table}</code><span>{file.rows}</span></li>)}</ul>
            <p className="ct-note">{t.exportNote}</p>
          </details>
          <details><summary className="ct-note">{t.limitations}</summary><ul className="ai103-limits">{tower.limitations.map((entry) => <li key={entry}>{entry}</li>)}</ul></details>
        </section>
      </> : null}
  </main>;
}
