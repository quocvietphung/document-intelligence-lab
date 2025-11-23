import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";

export default async function RentenrechnerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <RentenrechnerContent />
  );
}

function RentenrechnerContent() {
  const t = useTranslations("rentenrechner");

  return (
    <section className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50 py-12 md:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            {t("title")}
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
            {t("description")}
          </p>
        </div>

        {/* Iframe Container */}
        <div className="relative w-full bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          <iframe
            src="https://rentenrechner.dieversicherer.de/app/ergo.html"
            className="w-full"
            style={{ minHeight: "1200px" }}
            title="Rentenrechner"
            allowFullScreen
            loading="lazy"
          />
        </div>

        {/* Footer Info */}
        <div className="mt-12 p-6 md:p-8 bg-blue-50 rounded-xl border border-blue-200">
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {t("info_title")}
          </h3>
          <p className="text-gray-700 leading-relaxed">
            {t("info_description")}
          </p>
        </div>
      </div>
    </section>
  );
}

