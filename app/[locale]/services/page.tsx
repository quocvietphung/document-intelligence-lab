import { setRequestLocale } from "next-intl/server";
import ServicesSection from "@/components/sections/ServicesSection";

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ServicesSection />;
}

