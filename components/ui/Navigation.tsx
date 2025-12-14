"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function Navigation() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);

  useEffect(() => {
    setShowMobileMenu(false);
  }, [pathname]);

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
    { label: t("gold"), href: `/${locale}/gold` },
    { label: t("rentenrechner"), href: `/${locale}/rentenrechner` },
    { label: t("sparrechner"), href: `/${locale}/sparrechner` },
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
    <nav className="bg-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0">
            <Link href={`/${locale}`} className="text-xl sm:text-2xl font-bold text-blue-600 hover:text-blue-700 transition">
              Finance Consulting
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 text-sm font-medium transition duration-200 rounded-md ${
                  isActive(item.href)
                    ? "text-blue-600 bg-blue-50 border-b-2 border-blue-600"
                    : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Desktop Language Selector & Mobile Hamburger */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setShowLanguages(!showLanguages)}
                className="text-sm sm:text-sm font-medium text-gray-700 hover:text-blue-600 focus:outline-none transition px-2 sm:px-3 py-2 rounded-md hover:bg-gray-50"
              >
                {localeLabels[locale]}
              </button>
              {showLanguages && (
                <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl py-2 z-50 min-w-max">
                  {Object.keys(localeLabels).map((loc) => (
                    <Link
                      key={loc}
                      href={getLocalePath(loc)}
                      onClick={() => setShowLanguages(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition first:rounded-t-md last:rounded-b-md"
                    >
                      {localeLabels[loc]}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-50 focus:outline-none transition"
              aria-label="Toggle menu"
            >
              <svg
                className={`w-6 h-6 transition-transform duration-300 ${showMobileMenu ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {showMobileMenu ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden pb-4 pt-2 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-4 py-3 text-base font-medium rounded-md transition duration-200 ${
                    isActive(item.href)
                      ? "text-blue-600 bg-blue-50 border-l-4 border-blue-600"
                      : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
