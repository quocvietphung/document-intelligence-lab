"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import reviews from "../../data/reviews.json";

export default function ReviewsSection() {
  const t = useTranslations("reviews");

  return (
    <section id="reviews" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t("title")}</h2>
          <p className="text-xl text-gray-600">{t("subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((r) => (
            <article key={r.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-start gap-4">
                {r.avatar ? (
                  <Image src={r.avatar} alt={r.name} width={64} height={64} className="rounded-full" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold">
                    {r.name.split(" ")[0][0]}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{r.name}</h3>
                    <span className="text-sm text-gray-500">· {r.source}</span>
                  </div>
                  <div className="text-sm text-yellow-500 mt-1">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
                </div>
              </div>

              <p className="text-gray-700 mt-4">{r.quote || t("placeholder_quote")}</p>

              <div className="mt-4 text-sm text-gray-500">
                {r.verified ? <span className="font-medium text-green-600">{t("verified")}</span> : <span>{t("unverified")}</span>} · <span>{r.date || "—"}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          {t("note_html")}
        </div>
      </div>
    </section>
  );
}

