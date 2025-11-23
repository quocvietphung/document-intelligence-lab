import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";

export default function HeroSection() {
  const t = useTranslations("hero");
  const locale = useLocale();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 pt-20 pb-20">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 -z-10">
        {/* Gradient orbs */}
        <div className="absolute top-20 left-10 w-96 h-96 bg-blue-500/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
        <div className="absolute top-40 right-10 w-96 h-96 bg-cyan-500/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-indigo-500/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000" />

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width=%2760%27%20height=%2760%27%20viewBox=%270%200%2060%2060%27%20xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cg%20fill=%27none%27%20fill-rule=%27evenodd%27%3E%3Cg%20stroke=%27%23ffffff%27%20stroke-opacity=%270.05%27%3E%3Cpath%20d=%27M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%27/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-10" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full backdrop-blur-md hover:border-blue-500/50 transition-all">
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-blue-200">✨ {t("badge") || "Professional Solutions"}</span>
            </div>

            {/* Main Title */}
            <div>
              <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight tracking-tight mb-6">
                <span className="bg-gradient-to-r from-blue-200 via-cyan-200 to-blue-200 bg-clip-text text-transparent">
                  {t("title")}
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-blue-100/90 leading-relaxed max-w-2xl">
                {t("subtitle")}
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link
                href={`/${locale}/contact`}
                className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-8 py-4 rounded-lg font-bold shadow-2xl hover:shadow-3xl hover:scale-105 active:scale-95 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400"
              >
                <span>{t("cta") || "Get Started"}</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>
              <Link
                href={`/${locale}/#services`}
                className="inline-flex items-center justify-center gap-2 border-2 border-blue-400/50 text-blue-200 px-8 py-4 rounded-lg font-bold hover:border-blue-400 hover:text-white hover:bg-blue-500/10 transition-all duration-300 backdrop-blur-sm"
              >
                <span>{t("learn_more") || "Learn More"}</span>
                <span className="group-hover:translate-x-1 transition-transform">↓</span>
              </Link>
              <Link
                href={`/${locale}/rentenrechner`}
                className="inline-flex items-center justify-center gap-2 border-2 border-emerald-400/50 text-emerald-200 px-8 py-4 rounded-lg font-bold hover:border-emerald-400 hover:text-white hover:bg-emerald-500/10 transition-all duration-300 backdrop-blur-sm"
              >
                <span>💰 Rentenrechner</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-blue-500/20">
              <div>
                <div className="text-3xl font-bold text-cyan-300">500+</div>
                <div className="text-sm text-blue-200/70">{t("stat1") || "Happy Clients"}</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-cyan-300">15+</div>
                <div className="text-sm text-blue-200/70">{t("stat2") || "Years Experience"}</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-cyan-300">€2M+</div>
                <div className="text-sm text-blue-200/70">{t("stat3") || "Savings Achieved"}</div>
              </div>
            </div>
          </div>

          {/* Right: Visual Element */}
          <div className="relative hidden lg:block">
            <div className="relative w-full h-96 rounded-2xl overflow-hidden">
              {/* Card with gradient border */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl backdrop-blur-xl border border-blue-400/30" />

              {/* Inner content */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="inline-block p-4 bg-blue-500/20 rounded-xl border border-blue-400/30">
                    <svg className="w-16 h-16 text-cyan-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v20M2 12h20M12 2a10 10 0 0 1 10 10M2 12a10 10 0 0 1 10-10" />
                    </svg>
                  </div>
                  <p className="text-white font-semibold">Professional Finance Services</p>
                  <p className="text-blue-200/70 text-sm">Optimized for your success</p>
                </div>
              </div>

              {/* Animated border */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-blue-500/30 to-transparent animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
