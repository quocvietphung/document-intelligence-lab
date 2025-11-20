import { getTranslations, setRequestLocale } from "next-intl/server";
import HeroSection from "@/components/sections/HeroSection";
import ContactSection from "@/components/sections/ContactSection";
import Link from "next/link";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const servicesT = await getTranslations("services");
  const processT = await getTranslations("process");
  const testimonialsT = await getTranslations("testimonials");
  const reviewsT = await getTranslations("reviews");
  const contactT = await getTranslations("contact");

  const quickLinks = [
    {
      href: `/${locale}/services`,
      title: servicesT("title"),
      description: servicesT("subtitle"),
    },
    {
      href: `/${locale}/process`,
      title: processT("title"),
      description: processT("subtitle"),
    },
    {
      href: `/${locale}/testimonials`,
      title: testimonialsT("title"),
      description: testimonialsT("subtitle"),
    },
    {
      href: `/${locale}/reviews`,
      title: reviewsT("title"),
      description: reviewsT("subtitle"),
    },
    {
      href: `/${locale}/contact`,
      title: contactT("title"),
      description: contactT("subtitle"),
    },
  ];

  return (
    <>
      <HeroSection />
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="p-8 border rounded-2xl shadow-sm hover:shadow-md transition-shadow bg-gray-50"
              >
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  {link.title}
                </h3>
                <p className="text-gray-600">{link.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <ContactSection />
    </>
  );
}
