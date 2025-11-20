"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function Navigation() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const [showLanguages, setShowLanguages] = useState(false);

  const getLocalePath = (newLocale: string) => {
    const path = pathname.replace(`/${locale}`, `/${newLocale}`);
    return path;
  };

  const localeLabels: Record<string, string> = {
    en: "🇬🇧 EN",
    de: "🇩🇪 DE",
    vi: "🇻🇳 VI"
  };

  const navItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("services"), href: `/${locale}/services` },
    { label: t("gold"), href: `/${locale}/gold` },
    { label: t("blog"), href: `/${locale}/blog` },
    { label: t("contact"), href: `/${locale}/contact` },
  ];

  const isActive = (href: string) => {
    if (href === `/${locale}`) {
      return pathname === `/${locale}`;
    }
    return pathname.startsWith(href);
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
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 text-sm font-medium ${
                  isActive(item.href)
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-700 hover:text-blue-600"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center space-x-4 relative">
            <button
              onClick={() => setShowLanguages(!showLanguages)}
              className="text-sm font-medium text-gray-700 hover:text-blue-600 focus:outline-none"
            >
              {localeLabels[locale]}
            </button>
            {showLanguages && (
              <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50">
                {Object.keys(localeLabels).map((loc) => (
                  <Link
                    key={loc}
                    href={getLocalePath(loc)}
                    onClick={() => setShowLanguages(false)}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {localeLabels[loc]}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
