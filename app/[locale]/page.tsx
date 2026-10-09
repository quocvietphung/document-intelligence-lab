import { setRequestLocale } from "next-intl/server";
import { CreditWorkspace } from "@/components/workspace/CreditWorkspace";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <CreditWorkspace locale={locale} />;
}
