import { setRequestLocale } from "next-intl/server";
import TestimonialsSection from "@/components/sections/TestimonialsSection";

export default async function TestimonialsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TestimonialsSection />;
}

