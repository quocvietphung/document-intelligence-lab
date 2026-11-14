import {ArrowUpRight, Microscope} from "lucide-react";
import {ai103Locale, ai103Text, fill} from "@/lib/ai103/language";
import {buckets, manifest, summarize} from "@/lib/ai103/model";
import {workspacePageName} from "@/lib/workspace-presentation";

/** The only capability summary outside the lab: four counts from the manifest and the way to the details. */
export function Ai103Summary({locale, openCatalog}: {locale: string; openCatalog?: () => void}) {
  const t = ai103Text(locale);
  const summary = summarize(manifest.capabilities);
  return <section className="surface ai103-summary" data-page-tour="overview-ai103" aria-labelledby="ai103-summary-title">
    <header>
      <h2 id="ai103-summary-title"><Microscope size={17} aria-hidden="true"/> {t.pageTitle}</h2>
      <div className="ai103-summary-actions">
        <a className="button-secondary" href={`/${ai103Locale(locale)}/ai103`}>{t.summaryOpen}<ArrowUpRight size={15} aria-hidden="true"/></a>
        {openCatalog ? <button type="button" className="button-link" onClick={openCatalog}>{fill(t.summaryCatalog, {page: workspacePageName(locale, "trust")})}</button> : null}
      </div>
    </header>
    <dl>{buckets.map((bucket) => <div key={bucket}><dt>{t.kpi[bucket]}</dt><dd>{summary[bucket]}</dd></div>)}</dl>
    <p>{t.kpiNote}</p>
  </section>;
}
