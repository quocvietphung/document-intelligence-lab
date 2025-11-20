"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type Service = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  href?: string;
  badge?: string;
};

export default function ServicesSection() {
  const t = useTranslations("services");

  const services: Service[] = [
    {
      id: "tax-declaration",
      title: t("tax_declaration.title"),
      description: t("tax_declaration.description"),
      href: "/services/tax-declaration",
      badge: "Individuelle Lösungen",
      iconBg: "bg-gradient-to-br from-blue-50 to-blue-100",
      icon: (
        <svg className="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 3v5H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "tax-optimization",
      title: t("tax_optimization.title"),
      description: t("tax_optimization.description"),
      href: "/services/tax-optimization",
      badge: "Kostenersparnis",
      iconBg: "bg-gradient-to-br from-amber-50 to-yellow-100",
      icon: (
        <svg className="w-8 h-8 text-amber-600" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M9 18h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 22h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 3a6 6 0 0 0-4 10c0 2 1 3 1 3h6s1-1 1-3a6 6 0 0 0-4-10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "real-estate",
      title: t("real_estate.title"),
      description: t("real_estate.description"),
      href: "/services/real-estate",
      badge: "Vermögensschutz",
      iconBg: "bg-gradient-to-br from-green-50 to-emerald-100",
      icon: (
        <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 11.5L12 4l9 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 21h14a1 1 0 0 0 1-1V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "it-consulting",
      title: t("it_consulting.title"),
      description: t("it_consulting.description"),
      href: "/services/it-consulting",
      badge: "Innovation",
      iconBg: "bg-gradient-to-br from-indigo-50 to-indigo-100",
      icon: (
        <svg className="w-8 h-8 text-indigo-600" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3" y="5" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 19h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "accounting",
      title: t("accounting.title"),
      description: t("accounting.description"),
      href: "/services/accounting",
      badge: "Transparenz",
      iconBg: "bg-gradient-to-br from-rose-50 to-pink-100",
      icon: (
        <svg className="w-8 h-8 text-rose-600" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 20v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 20V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 20v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <section id="services" aria-labelledby="services-heading" className="relative py-24 overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-blue-50 -z-10" />
      <div className="absolute top-20 right-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob -z-10" />
      <div className="absolute bottom-20 left-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-block mb-4 px-4 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full">
            <span className="text-sm font-semibold text-blue-700">EXPERTISE & VERTRAUEN</span>
          </div>
          <h2 id="services-heading" className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-4">
            {t("title")}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">{t("subtitle")}</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-6 mb-16">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">500+</div>
            <div className="text-gray-600 mt-1">Zufriedene Kunden</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-emerald-600">15+</div>
            <div className="text-gray-600 mt-1">Jahre Erfahrung</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-rose-600">€2M+</div>
            <div className="text-gray-600 mt-1">Ersparnisse für Kunden</div>
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-16">
          {services.map((service) => (
            <Link
              key={service.id}
              href={service.href ?? "/contact"}
              className="group relative bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-blue-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
            >
              {/* Badge */}
              {service.badge && (
                <div className="inline-block mb-4">
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
                    {service.badge}
                  </span>
                </div>
              )}

              {/* Icon Container */}
              <div className={`${service.iconBg} w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                {service.icon}
              </div>

              {/* Content */}
              <h3 className="text-lg font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                {service.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">{service.description}</p>

              {/* Info Row */}
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium">{t("deliverables")}:</span>
                  <span>{t("deliverables_short")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">{t("turnaround")}:</span>
                  <span>{t("turnaround_short")}</span>
                </div>
              </div>

              {/* Arrow indicator */}
              <div className="mt-4 flex items-center text-blue-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
                {t("learn_more")}
                <span className="ml-2">→</span>
              </div>
            </Link>
          ))}
        </div>

        {/* CTA Section */}
        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-12 text-center text-white overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width=%2260%27%20height=%2760%27%20viewBox=%270%200%2060%2060%27%20xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cg%20fill=%27none%27%20fill-rule=%27evenodd%27%3E%3Cg%20fill=%27%23ffffff%27%20fill-opacity=%270.1%27%3E%3Cpath%20d=%27M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%27/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
          </div>
          <div className="relative z-10">
            <p className="text-lg mb-4">{t("cta_subtext")}</p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-lg bg-white text-blue-600 px-8 py-4 font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-transform duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white"
            >
              {t("cta_button")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
