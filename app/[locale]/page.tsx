import { CreditWorkspace } from "@/components/workspace/CreditWorkspace";

export default async function HomePage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  return <CreditWorkspace locale={locale} />;
}
