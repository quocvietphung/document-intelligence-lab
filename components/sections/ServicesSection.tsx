"use client";

import { useTranslations } from "next-intl";

export default function ServicesSection() {
    const t = useTranslations("services");

    const services = [
        {
            title: t("tax_declaration.title"),
            description: t("tax_declaration.description"),
            icon: "📋",
        },
        {
            title: t("tax_optimization.title"),
            description: t("tax_optimization.description"),
            icon: "💡",
        },
        {
            title: t("real_estate.title"),
            description: t("real_estate.description"),
            icon: "🏠",
        },
        {
            title: t("it_consulting.title"),
            description: t("it_consulting.description"),
            icon: "💻",
        },
        {
            title: t("accounting.title"),
            description: t("accounting.description"),
            icon: "📊",
        },
    ];

    return (
        <section id="services" className="py-20 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section header */}
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                        {t("title")}
                    </h2>
                    <p className="text-xl text-gray-600">{t("subtitle")}</p>
                </div>

                {/* Service cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {services.map((service, index) => (
                        <div
                            key={index}
                            className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-shadow duration-300 transform hover:-translate-y-1"
                        >
                            <div className="text-5xl mb-6">{service.icon}</div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-3">
                                {service.title}
                            </h3>
                            <p className="text-gray-600 leading-relaxed">
                                {service.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
