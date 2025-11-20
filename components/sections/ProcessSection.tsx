import { useTranslations } from "next-intl";

export default function ProcessSection() {
  const t = useTranslations("process");

  const steps = [
    {
      number: "1",
      title: t("step1.title"),
      description: t("step1.description"),
    },
    {
      number: "2",
      title: t("step2.title"),
      description: t("step2.description"),
    },
    {
      number: "3",
      title: t("step3.title"),
      description: t("step3.description"),
    },
  ];

  return (
    <section className="relative py-24 overflow-hidden bg-gradient-to-b from-white via-blue-50 to-white">
      {/* Background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -z-10" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-block mb-4 px-4 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full border border-blue-200">
            <span className="text-sm font-bold text-blue-700 tracking-wide uppercase">{t("subtitle")}</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
            {t("title")}
          </h2>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed font-light">
            Unser bewährter Prozess für Ihren Erfolg
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connection line */}
          <div className="hidden md:block absolute top-32 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent -z-5" />

          {steps.map((step, index) => (
            <div key={index} className="relative">
              <div className="text-center group">
                {/* Step number circle */}
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-3xl font-bold mb-6 shadow-lg group-hover:shadow-2xl group-hover:scale-110 transition-all duration-300 relative z-10">
                  {step.number}
                  <div className="absolute inset-0 rounded-full bg-blue-400 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300" />
                </div>

                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                  {step.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
