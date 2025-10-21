"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();

  const toggleLocale = () => {
    const newLocale = locale === "en" ? "de" : "en";
    const path = pathname.replace(`/${locale}`, `/${newLocale}`);
    return path;
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href={`/${locale}`} className="text-2xl font-bold text-blue-600">
              TaxConsult
            </Link>
          </div>
          
          <div className="hidden md:flex space-x-8">
            <Link
              href={`/${locale}`}
              className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium"
            >
              {t("home")}
            </Link>
            <Link
              href={`/${locale}#services`}
              className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium"
            >
              {t("services")}
            </Link>
            <Link
              href={`/${locale}/blog`}
              className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium"
            >
              {t("blog")}
            </Link>
            <Link
              href={`/${locale}#contact`}
              className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium"
            >
              {t("contact")}
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href={toggleLocale()}
              className="text-sm font-medium text-gray-700 hover:text-blue-600"
            >
              {locale === "en" ? "🇩🇪 DE" : "🇬🇧 EN"}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
