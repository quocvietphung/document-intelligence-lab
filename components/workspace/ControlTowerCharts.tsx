import type {ReactNode} from "react";
import {badgeOf, formatKpi, kpiDetail, type ControlTower, type Copy, type MeasurementMode} from "@/lib/control-tower";
import {barPercent, chartableKpis, donutDash, layerLink, maxOf, tallyChecks, validShare} from "@/lib/control-tower-charts";

/** Badge per measurement mode, shared by the tiles, the tables and the charts. */
export function Badge({mode, t}: {mode: MeasurementMode; t: Copy}) {
  const badge = badgeOf(mode);
  return <span className={`ct-badge ct-badge-${badge}`} title={mode === "deterministic" ? t.rule : undefined}>{t.badges[badge]}</span>;
}

/** A chart is a captioned figure. Each number is shown once: in a chart, a tile or a table. */
function Chart({id, title, note, children}: {id: string; title: string; note: string; children: ReactNode}) {
  return <figure className="ct-chart" aria-labelledby={id}>
    <figcaption id={id}>{title}<small>{note}</small></figcaption>
    {children}
  </figure>;
}

type Bar = {key: string; label: string; detail?: string; share: number; text: string; mode?: MeasurementMode; configured?: boolean};

/** Horizontal bars. The value is printed beside each bar, so the bar itself is decorative. */
function Bars({bars, t}: {bars: Bar[]; t: Copy}) {
  if (!bars.length) return <p className="ct-note">{t.charts.empty}</p>;
  return <ul className="ct-bars">{bars.map((bar) => <li key={bar.key} className="ct-bar">
    <span className="ct-bar-label">{bar.label}{bar.detail ? <small>{bar.detail}</small> : null}</span>
    <span className="ct-bar-track" aria-hidden="true"><span className={bar.configured ? "ct-bar-fill ct-bar-fill-configured" : "ct-bar-fill"} style={{width: `${bar.share}%`}}/></span>
    <span className="ct-bar-value">{bar.text}{bar.mode ? <Badge mode={bar.mode} t={t}/> : null}</span>
  </li>)}</ul>;
}

/** Latency of each ETL step of this run, drawn against the slowest step; the row count sits under the label. */
export function StageChart({tower, t, locale}: {tower: ControlTower; t: Copy; locale: string}) {
  const max = maxOf(tower.stages.map((stage) => stage.latencyMs));
  const bars = tower.stages.map((stage) => ({
    key: stage.stage, label: t.stages[stage.stage] ?? stage.stage, share: barPercent(stage.latencyMs, max), text: formatKpi(stage.latencyMs, "ms", locale), mode: stage.mode,
    detail: stage.rows === null ? undefined : `${t.columns.rows}: ${formatKpi(stage.rows, "rows", locale)}`,
  }));
  return <Chart id="ct-chart-stages" title={t.charts.stages} note={t.charts.stagesNote}><Bars bars={bars} t={t}/></Chart>;
}

function FlowNode({label, value, locale}: {label: string; value: number | null; locale: string}) {
  return <div className="ct-flow-node"><span>{label}</span><strong>{formatKpi(value, "rows", locale)}</strong></div>;
}

function FlowArrow({step, locale}: {step: ControlTower["lineage"][number] | null; locale: string}) {
  return <div className="ct-flow-arrow"><b aria-hidden="true">→</b>
    <small>{step ? `${formatKpi(step.rowsIn, "rows", locale)} → ${formatKpi(step.rowsOut, "rows", locale)}` : "—"}</small></div>;
}

/** Rows of each layer of this run. Each arrow is the lineage step between two layers. */
export function FlowChart({tower, t, locale}: {tower: ControlTower; t: Copy; locale: string}) {
  return <Chart id="ct-chart-flow" title={t.charts.flow} note={t.charts.flowNote}>
    <div className="ct-flow">
      <FlowNode label={t.charts.layers.bronze} value={tower.rowCounts.bronze ?? null} locale={locale}/>
      <FlowArrow step={layerLink(tower.lineage, "bronze", "silver")} locale={locale}/>
      <FlowNode label={t.charts.layers.silver} value={tower.rowCounts.silver ?? null} locale={locale}/>
      <FlowArrow step={layerLink(tower.lineage, "silver", "gold")} locale={locale}/>
      <FlowNode label={t.charts.layers.gold} value={tower.rowCounts.reviewedGold ?? null} locale={locale}/>
    </div>
  </Chart>;
}

/** Passed against failed items as a donut, with the count of passed items in the middle. */
function Donut({id, title, note, passed, failed, t, children}: {id: string; title: string; note: string; passed: number; failed: number; t: Copy; children?: ReactNode}) {
  const total = passed + failed;
  return <Chart id={id} title={title} note={note}>
    {total ? <div className="ct-donut-wrap">
      <svg className="ct-donut" viewBox="0 0 36 36" role="img" aria-label={`${t.passed}: ${passed} · ${t.failed}: ${failed}`}>
        <circle className="ct-donut-fail" cx="18" cy="18" r="15.9155" pathLength="100"/>
        <circle className="ct-donut-pass" cx="18" cy="18" r="15.9155" pathLength="100" strokeDasharray={donutDash(passed, failed)} transform="rotate(-90 18 18)"/>
        <text className="ct-donut-text" x="18" y="19.2" textAnchor="middle">{`${passed}/${total}`}</text>
      </svg>
      <ul className="ct-donut-legend">
        <li><span className="ct-swatch ct-swatch-pass" aria-hidden="true"/>{t.passed}: <strong>{passed}</strong></li>
        <li><span className="ct-swatch ct-swatch-fail" aria-hidden="true"/>{t.failed}: <strong>{failed}</strong></li>
      </ul>
    </div> : <p className="ct-note">{t.charts.empty}</p>}
    {children}
  </Chart>;
}

/** Data-quality checks of the run: the donut counts them and the list names each check with its result. */
export function CheckChart({tower, t}: {tower: ControlTower; t: Copy}) {
  const {passed, failed} = tallyChecks(tower.dataQuality);
  return <Donut id="ct-chart-checks" title={t.charts.checks} note={t.charts.checksNote} passed={passed} failed={failed} t={t}>
    {tower.dataQuality.length ? <ul className="ct-checks">{tower.dataQuality.map((check) => <li key={check.check} className="ct-check">
      <span>{t.checks[check.check] ?? check.check}{check.detail ? <small> · {check.detail}</small> : null}</span>
      <b className={check.passed ? "ct-check-pass" : "ct-check-fail"}>{check.passed ? t.passed : t.failed}</b>
    </li>)}</ul> : null}
  </Donut>;
}

/** Ratio KPIs on a 0–100% scale, each with its detail. A KPI that has not run keeps its bar empty and shows a dash. */
export function KpiChart({tower, keys, id, title, note, t, locale}: {tower: ControlTower; keys: string[]; id: string; title: string; note: string; t: Copy; locale: string}) {
  const bars = chartableKpis(tower.kpis, keys).map((kpi) => {
    const empty = kpi.mode === "not-run" || kpi.value === null;
    return {
      key: kpi.key, label: t.kpis[kpi.key] ?? kpi.key, detail: kpiDetail(kpi, t.details) || undefined, share: empty ? 0 : barPercent(kpi.value, 1),
      text: empty ? "—" : formatKpi(kpi.value, kpi.unit, locale), mode: kpi.mode,
    };
  });
  return <Chart id={id} title={title} note={note}><Bars bars={bars} t={t}/></Chart>;
}

/** Configured cost per model. Local engines carry no token fee, so their bars stay empty. */
export function CostChart({tower, t, locale}: {tower: ControlTower; t: Copy; locale: string}) {
  const rows = tower.cost.filter((entry) => entry.mode !== "simulated");
  const max = maxOf(rows.map((entry) => entry.estimatedCost));
  const bars = rows.map((entry) => ({
    key: `${entry.provider}-${entry.model}`, label: `${entry.provider} · ${entry.model}`, share: barPercent(entry.estimatedCost, max),
    text: formatKpi(entry.estimatedCost, "EUR", locale), mode: entry.mode, configured: true,
  }));
  return <Chart id="ct-chart-cost" title={t.charts.cost} note={t.charts.costNote}><Bars bars={bars} t={t}/></Chart>;
}

/** Share of valid field observations per model in this run. */
export function ModelChart({tower, t}: {tower: ControlTower; t: Copy}) {
  const bars = tower.models.map((entry) => {
    const share = validShare(entry);
    return {key: `${entry.provider}-${entry.model}`, label: `${entry.provider} · ${entry.model}`, share: share === null ? 0 : barPercent(share, 1), text: `${entry.valid}/${entry.observations}`};
  });
  return <Chart id="ct-chart-models" title={t.charts.valid} note={t.charts.validNote}><Bars bars={bars} t={t}/></Chart>;
}
