import type {Metadata} from "next";
import {setRequestLocale} from "next-intl/server";
import {ControlTower} from "@/components/workspace/ControlTower";
import {controlTowerText} from "@/lib/control-tower";

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  const t = controlTowerText(locale);
  return {title: `${t.title} · Document Intelligence Lab`, description: t.intro};
}

/** Data & AI Control Tower: reads the reviewed Gold marts of a dossier's latest ETL run through the case API. */
export default async function ControlTowerPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  return <ControlTower locale={locale}/>;
}
