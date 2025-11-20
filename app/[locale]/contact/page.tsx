import { setRequestLocale } from "next-intl/server";
import ContactSection from "@/components/sections/ContactSection";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ContactSection />;
}

