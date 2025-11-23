"use client";

import { useTranslations } from "next-intl";

export default function FAQSection() {
  const t = useTranslations("gold.faq");

  const faqs = [
    {
      title: t("q1_title"),
      body: t("q1_body"),
    },
    {
      title: t("q2_title"),
      body: t("q2_body"),
    },
    {
      title: t("q3_title"),
      body: t("q3_body"),
    },
    {
      title: t("q4_title"),
      body: t("q4_body"),
    },
  ];

  return (
    <div className="mb-16">
      <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
        {t("title")}
      </h2>

      <div className="grid md:grid-cols-2 gap-6 mb-12">
        {faqs.map((faq, index) => (
          <details
            key={index}
            className="bg-white rounded-lg shadow p-6 cursor-pointer group hover:shadow-lg transition-shadow"
          >
            <summary className="font-semibold text-gray-900 flex items-center justify-between select-none">
              {faq.title}
              <span className="transform group-open:rotate-180 transition-transform duration-300 ml-2 flex-shrink-0">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </span>
            </summary>
            <p className="text-gray-600 mt-4 leading-relaxed text-sm">
              {faq.body}
            </p>
          </details>
        ))}
      </div>

      {/* Disclaimer Section */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-lg">
        <h3 className="font-bold text-amber-900 mb-3">
          {t("disclaimer_title")}
        </h3>
        <p className="text-amber-900 text-sm leading-relaxed">
          {t("disclaimer_body")}
        </p>
      </div>
    </div>
  );
}

