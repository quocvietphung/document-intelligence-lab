import { setRequestLocale } from "next-intl/server";
import ProcessSection from "@/components/sections/ProcessSection";

export default async function ProcessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProcessSection />;
}

