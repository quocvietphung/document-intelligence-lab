import { setRequestLocale } from "next-intl/server";
import ReviewsSection from "@/components/sections/ReviewsSection";

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReviewsSection />;
}

