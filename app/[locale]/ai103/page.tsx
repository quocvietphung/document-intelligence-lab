import type {Metadata} from "next";
import {setRequestLocale} from "next-intl/server";
import {Ai103Lab} from "@/components/workspace/Ai103Lab";
import {ai103Text} from "@/lib/ai103/language";
import {manifest} from "@/lib/ai103/model";

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  const t = ai103Text(locale);
  return {title: `${t.pageTitle} · Document Intelligence Lab`, description: t.intro};
}

/** AI-103 capability lab. The manifest is read on the server; the client never adds or changes a status. */
export default async function Ai103Page({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  return <Ai103Lab locale={locale} capabilities={manifest.capabilities}/>;
}
