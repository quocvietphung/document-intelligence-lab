"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import reviews from "../../data/reviews.json";

export default function ReviewsSection() {
  const t = useTranslations("reviews");

  return (
    <section id="reviews" className="relative py-24 overflow-hidden bg-gradient-to-b from-white via-slate-50 to-blue-50">
      {/* Background elements */}
      <div className="absolute top-20 right-10 w-96 h-96 bg-slate-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -z-10" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="inline-block mb-4 px-4 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full border border-blue-200 hover:shadow-lg transition-shadow">
            <span className="text-sm font-bold text-blue-700 tracking-wide uppercase">{t("label") || "Customer Reviews"}</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
            {t("title")}
          </h2>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed font-light">
            {t("subtitle")}
          </p>
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {reviews.map((r) => (
            <article
              key={r.id}
              className="group relative bg-white p-8 rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-blue-300 hover:-translate-y-2"
            >
              {/* Verified badge */}
              {r.verified && (
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                    ✓ {t("verified") || "Verified"}
                  </span>
                </div>
              )}

              {/* Author Info */}
              <div className="flex items-start gap-4 mb-6">
                {r.avatar ? (
                  <Image
                    src={r.avatar}
                    alt={r.name}
                    width={64}
                    height={64}
                    className="rounded-full shadow-lg group-hover:scale-110 transition-transform flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:scale-110 transition-transform flex-shrink-0">
                    {r.name.split(" ")[0][0]}
                  </div>
                )}
                <div className="flex-grow min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 truncate">{r.name}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">{r.source}</span>
                    {r.date && <span className="text-xs text-gray-500">{r.date}</span>}
                  </div>
                </div>
              </div>

              {/* Stars Rating */}
              <div className="flex items-center gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className={`text-lg ${i < r.rating ? "text-yellow-400" : "text-gray-300"}`}>
                    ★
                  </span>
                ))}
                <span className="ml-2 text-sm font-semibold text-gray-700">{r.rating}/5</span>
              </div>

              {/* Review Quote */}
              <p className="text-gray-700 leading-relaxed mb-6 italic text-sm">
                &quot;{r.quote || t("placeholder_quote") || "Great service!"}&quot;
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-100 text-xs text-gray-500">
                <span>{r.source}</span>
                <span className="font-medium">
                  {r.verified ? "✓ " + (t("verified") || "Verified") : t("unverified") || "Unverified"}
                </span>
              </div>

              {/* Hover effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl -z-10" />
            </article>
          ))}
        </div>

        {/* Trust Badge */}
        <div className="p-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 text-center">
          <p className="text-base text-gray-700">
            <span className="font-bold text-gray-900">💯 {t("trust_label") || "100% Verified Reviews"}</span>
            <br />
            <span className="text-sm text-gray-600">{t("trust_desc") || "From real customers on leading platforms"}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

