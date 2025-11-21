"use client";

import React, { useState } from "react";
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
  details?: string;
  features?: string[];
  benefits?: string[];
  deliverables?: string[];
};

export default function ServicesSection() {
  const t = useTranslations("services");
  const [hoveredService, setHoveredService] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const services: Service[] = [
    {
      id: "finance-declaration",
      title: t("finance_declaration.title"),
      description: t("finance_declaration.description"),
      href: "/contact",
      badge: "Individuelle Lösungen",
      iconBg: "bg-gradient-to-br from-blue-50 to-blue-100",
      details: "Unsere Finanzerklärungs-Service deckt alle Aspekte Ihrer jährlichen Finanzpflichten ab. Wir kümmern uns um die Komplexität und stellen sicher, dass Sie maximale Abzüge erhalten.",
      features: [
        "Vollständige Finanzerklärung für Privatpersonen und Unternehmen",
        "Optimierung von Abzügen und Freibeträgen",
        "Unterstützung bei Einkommen, Körperschaft und Umsatzsteuern",
        "Umgang mit Rückerstattungen und Nachzahlungen"
      ],
      benefits: [
        "✓ Maximale Finanzbückerstattung",
        "✓ Vollständige Compliance mit Behörden",
        "✓ Zeitersparnis und weniger Stress",
        "✓ Professionelle Dokumentation und Unterstützung"
      ],
      deliverables: [
        "Vollständige Finanzerklärung",
        "Detaillierter Bericht",
        "Beratung zur zukünftigen Planung"
      ],
      icon: (
        <svg className="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 3v5H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "finance-optimization",
      title: t("finance_optimization.title"),
      description: t("finance_optimization.description"),
      href: "/contact",
      badge: "Kostenersparnis",
      iconBg: "bg-gradient-to-br from-amber-50 to-yellow-100",
      details: "Strategische Steuerplanung zur Minimierung Ihrer Steuerlast. Wir identifizieren legale Möglichkeiten, Ihre Steuern zu reduzieren.",
      features: [
        "Analyse Ihrer aktuellen Steuersituation",
        "Identifikation von Sparpotentialen",
        "Strategische Geschäftsstrukturierung",
        "Investitionsoptimierung und Vermögensschutz"
      ],
      benefits: [
        "✓ Bis zu 30% Steuereinsparungen",
        "✓ Legale und sichere Strategien",
        "✓ Langfristige Steuerplanung",
        "✓ Transparente Dokumentation"
      ],
      deliverables: [
        "Steuersparplan",
        "Implementierungsberatung",
        "Laufende Überwachung"
      ],
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
      href: "/contact",
      badge: "Vermögensschutz",
      iconBg: "bg-gradient-to-br from-green-50 to-emerald-100",
      details: "Umfassende Beratung für Immobilieninvestitionen mit steuerlicher Optimierung und Vermögensschutz.",
      features: [
        "Steueroptimierung bei Immobilienkäufen und -verkäufen",
        "Vermietungsstrategien und Einnahmemaximierung",
        "Abschreibungsoptimierung",
        "Internationale Immobilienwertschöpfung"
      ],
      benefits: [
        "✓ Maximale Renditen auf Immobilieninvestitionen",
        "✓ Steuereffiziente Vermögensstrukturierung",
        "✓ Rechtssicherheit bei Transaktionen",
        "✓ Langfristige Vermögensplanung"
      ],
      deliverables: [
        "Investitionsanalyse",
        "Steuerpläne",
        "Vertragsprüfung und -beratung"
      ],
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
      href: "/contact",
      badge: "Innovation",
      iconBg: "bg-gradient-to-br from-indigo-50 to-indigo-100",
      details: "Modernisierung Ihrer Finanzprozesse durch cloudbasierte Lösungen und automatisierte Systeme.",
      features: [
        "Cloud-Migration für Finanzsysteme",
        "Automatisierte Buchführung und Fakturierung",
        "Sichere digitale Dokumentenverwaltung",
        "Integration mit bestehenden Systemen"
      ],
      benefits: [
        "✓ 50% Zeit- und Kostenersparnis",
        "✓ Verbesserte Datensicherheit",
        "✓ Echtzeit-Finanzübersicht",
        "✓ Skalierbare Lösungen"
      ],
      deliverables: [
        "Systemimplementierung",
        "Schulung und Support",
        "Laufende Wartung"
      ],
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
      href: "/contact",
      badge: "Transparenz",
      iconBg: "bg-gradient-to-br from-rose-50 to-pink-100",
      details: "Vollständige Buchhaltungs- und Bilanzierungslösungen für Unternehmen aller Größen.",
      features: [
        "Laufende Buchhaltung und Finanzbuchhaltung",
        "Monatliche und jährliche Abschlüsse",
        "Gewinn- und Verlustrechnung",
        "Bilanz- und Berichterstattung"
      ],
      benefits: [
        "✓ Vollständige finanzielle Transparenz",
        "✓ Compliance mit Rechnungslegungsstandards",
        "✓ Zeitnahe Finanzberichte",
        "✓ Datengestützte Geschäftsentscheidungen"
      ],
      deliverables: [
        "Monatliche Abschlüsse",
        "Jahresabschluss",
        "Finanzberichte und Analyse"
      ],
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="inline-block mb-4 px-4 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full border border-blue-200 hover:shadow-lg transition-shadow">
            <span className="text-sm font-bold text-blue-700 tracking-wide uppercase">{t("subtitle")}</span>
          </div>
          <h2 id="services-heading" className="text-5xl md:text-6xl font-bold text-gray-900 tracking-tight mb-6 leading-tight">
            {t("title")}
          </h2>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed font-light">
            Umfassende Lösungen für Ihre Finanzen und Geschäfte
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 hover:shadow-lg transition-shadow">
            <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent mb-2">500+</div>
            <div className="text-gray-700 font-medium">Zufriedene Kunden</div>
          </div>
          <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 hover:shadow-lg transition-shadow">
            <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent mb-2">15+</div>
            <div className="text-gray-700 font-medium">Jahre Erfahrung</div>
          </div>
          <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100 hover:shadow-lg transition-shadow">
            <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-rose-600 to-rose-700 bg-clip-text text-transparent mb-2">€2M+</div>
            <div className="text-gray-700 font-medium">Ersparnisse für Kunden</div>
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-16">
          {services.map((service) => (
            <div
              key={service.id}
              onMouseEnter={() => setHoveredService(service.id)}
              onMouseLeave={() => setHoveredService(null)}
              className="h-full"
            >
              <button
                onClick={() => setSelectedService(service)}
                className="group relative w-full h-full bg-white rounded-2xl p-6 shadow-sm hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-blue-400 hover:-translate-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 flex flex-col text-left"
              >
                {/* Badge */}
                {service.badge && (
                  <div className="inline-block mb-4 self-start">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full transition-all duration-300 ${
                      hoveredService === service.id 
                        ? "bg-blue-600 text-white scale-105" 
                        : "bg-blue-50 text-blue-700"
                    }`}>
                      {service.badge}
                    </span>
                  </div>
                )}

                {/* Icon */}
                <div className={`${service.iconBg} w-16 h-16 rounded-xl flex items-center justify-center mb-4 group-hover:scale-125 group-hover:shadow-lg transition-all duration-300`}>
                  {service.icon}
                </div>

                {/* Content */}
                <div className="flex-grow">
                  <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors duration-300">
                    {service.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    {service.description}
                  </p>
                </div>

                {/* Info */}
                <div className={`text-xs text-gray-500 space-y-1 mb-4 transition-all duration-300 ${
                  hoveredService === service.id ? "opacity-75" : "opacity-60"
                }`}>
                  <div className="flex justify-between">
                    <span className="font-medium">{t("deliverables")}:</span>
                    <span>{t("deliverables_short")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">{t("turnaround")}:</span>
                    <span>{t("turnaround_short")}</span>
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-2 flex items-center text-blue-600 font-medium text-sm group-hover:text-blue-700 group-hover:translate-x-2 transition-all duration-300">
                  {t("learn_more")}
                  <span className="ml-2 group-hover:translate-x-1 transition-transform duration-300">→</span>
                </div>
              </button>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-3xl p-16 text-center text-white overflow-hidden shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width=%2760%27%20height=%2760%27%20viewBox=%270%200%2060%2060%27%20xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cg%20fill=%27none%27%20fill-rule=%27evenodd%27%3E%3Cg%20fill=%27%23ffffff%27%20fill-opacity=%270.1%27%3E%3Cpath%20d=%27M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%27/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
          </div>
          <div className="absolute top-10 right-10 w-32 h-32 bg-white opacity-5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-40 h-40 bg-white opacity-5 rounded-full blur-3xl" />

          <div className="relative z-10">
            <h3 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
              Bereit für professionelle Unterstützung?
            </h3>
            <p className="text-lg md:text-xl mb-8 text-blue-100 max-w-2xl mx-auto">
              Lassen Sie uns Ihnen helfen, Ihre Steuern zu optimieren und Ihr Geschäft zu wachsen.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl bg-white text-blue-700 px-10 py-4 font-bold shadow-2xl hover:shadow-3xl hover:scale-110 active:scale-95 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white gap-2"
            >
              <span>Kostenlose Beratung anfordern</span>
              <span className="text-xl">→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedService && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setSelectedService(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`${selectedService.iconBg} relative p-8 flex items-start justify-between`}>
              <div className="flex items-start gap-4">
                <div className={`${selectedService.iconBg} w-20 h-20 rounded-2xl flex items-center justify-center`}>
                  {selectedService.icon}
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">{selectedService.title}</h2>
                  <p className="text-gray-600 mt-2">{selectedService.badge}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="text-gray-500 hover:text-gray-700 text-3xl font-bold w-10 h-10 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 space-y-8">
              {selectedService.details && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Übersicht</h3>
                  <p className="text-gray-700 leading-relaxed">{selectedService.details}</p>
                </div>
              )}

              {selectedService.features && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Leistungsmerkmale</h3>
                  <ul className="space-y-2">
                    {selectedService.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-gray-700">
                        <span className="text-blue-600 font-bold text-lg mt-0.5">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedService.benefits && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Vorteile</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedService.benefits.map((benefit, idx) => (
                      <div key={idx} className="bg-blue-50 p-4 rounded-lg text-gray-700 font-medium">
                        {benefit}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedService.deliverables && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Leistungen</h3>
                  <div className="space-y-2">
                    {selectedService.deliverables.map((deliverable, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-gray-700">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        <span>{deliverable}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-gray-200">
                <Link
                  href="/contact"
                  className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <span>Jetzt kontaktieren</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
