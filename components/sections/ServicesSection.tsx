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
      title: t("business_consulting.title"),
      description: t("business_consulting.description"),
      icon: "💼",
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
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {t("title")}
          </h2>
          <p className="text-xl text-gray-600">{t("subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div
              key={index}
              className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className="text-5xl mb-4">{service.icon}</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {service.title}
              </h3>
              <p className="text-gray-600">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
