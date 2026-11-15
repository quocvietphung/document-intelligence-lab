import type {ControlTower} from "./control-tower";

type Kpi = ControlTower["kpis"][number];
type Lineage = ControlTower["lineage"][number];

/** Bar length in percent of `max`. Missing, zero or negative values draw an empty bar, and no bar passes 100%. */
export function barPercent(value: number | null | undefined, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 1000) / 10);
}

/** The largest finite value of a list, or 0 when there is none. */
export function maxOf(values: readonly (number | null | undefined)[]): number {
  return values.reduce<number>((top, value) => (typeof value === "number" && Number.isFinite(value) && value > top ? value : top), 0);
}

/** Passed and failed counts of a list of checks. */
export function tallyChecks(checks: readonly {passed: boolean}[]): {passed: number; failed: number} {
  const passed = checks.filter((check) => check.passed).length;
  return {passed, failed: checks.length - passed};
}

/** stroke-dasharray of the passed arc of a donut drawn on a circle with pathLength 100. */
export function donutDash(passed: number, failed: number): string {
  const total = passed + failed;
  const on = total > 0 ? Math.round((passed / total) * 1000) / 10 : 0;
  return `${on} ${Math.round((100 - on) * 10) / 10}`;
}

/** The KPIs of the given keys, in that order. A simulated value never reaches a chart, and a missing KPI is skipped. */
export function chartableKpis(kpis: readonly Kpi[], keys: readonly string[]): Kpi[] {
  return keys.flatMap((key) => {
    const kpi = kpis.find((entry) => entry.key === key && entry.mode !== "simulated");
    return kpi ? [kpi] : [];
  });
}

/** The lineage step from one layer to the next, matched by table-name prefix. */
export function layerLink(lineage: readonly Lineage[], from: string, to: string): Lineage | null {
  return lineage.find((edge) => edge.from.startsWith(from) && edge.to.startsWith(to)) ?? null;
}

/** Share of valid observations of one model, or null when the model has none. */
export function validShare(entry: {observations: number; valid: number}): number | null {
  return entry.observations > 0 ? entry.valid / entry.observations : null;
}
