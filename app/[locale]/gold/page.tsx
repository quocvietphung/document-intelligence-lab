import React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import GoldPriceWidget from '@/components/gold/GoldPriceWidget';
import GoldInvestmentCalculator from '@/components/gold/GoldInvestmentCalculator';

export default function GoldConsultingPage() {
  const t = useTranslations('gold');
  const locale = useLocale();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      {/* HERO */}
      <header className="relative overflow-hidden border-b border-yellow-500/30">
        {/* soft golden glow background */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-yellow-400/35 blur-3xl" />
          <div className="absolute bottom-[-5rem] right-[-3rem] h-72 w-72 rounded-full bg-amber-500/35 blur-3xl" />
          <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-yellow-300/25 blur-2xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-18 flex flex-col items-center text-center gap-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-yellow-400/40 bg-black/30 px-4 py-1 text-[0.65rem] md:text-xs font-medium uppercase tracking-[0.18em] text-yellow-100/90 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Gold Investment Advisory
          </span>

          <h1 className="text-[2.1rem] md:text-[2.6rem] lg:text-[3rem] font-semibold tracking-tight leading-tight">
            <span className="bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 bg-clip-text text-transparent">
              {t('title')}
            </span>
          </h1>

          <p className="max-w-2xl text-[0.9rem] md:text-base text-slate-200/85">
            {t('subtitle')}
          </p>

          {/* primary hero CTA */}
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href={`/${locale}/contact`}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 px-6 py-2.5 text-xs md:text-sm font-semibold text-slate-950 shadow-lg shadow-yellow-500/30 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-yellow-400/40"
            >
              <span>{t('cta.button')}</span>
            </Link>
            <a
              href="tel:+49123456789"
              className="inline-flex items-center gap-2 rounded-full border border-slate-500/70 bg-slate-900/60 px-5 py-2 text-xs md:text-sm font-medium text-slate-50/90 hover:border-slate-300 hover:bg-slate-800/80 transition-colors duration-200"
            >
              <span>{'Call Now'}</span>
            </a>
          </div>

          {/* mini stats */}
          <dl className="mt-5 grid grid-cols-3 gap-3 text-[0.65rem] md:text-xs text-slate-200/80">
            <div className="rounded-lg border border-yellow-500/18 bg-slate-900/60 px-3 py-2 backdrop-blur-sm">
              <dt className="text-[0.6rem] uppercase tracking-[0.17em] text-slate-400">Investors</dt>
              <dd className="text-sm md:text-base font-semibold text-yellow-100">10k+</dd>
            </div>
            <div className="rounded-lg border border-yellow-500/18 bg-slate-900/60 px-3 py-2 backdrop-blur-sm">
              <dt className="text-[0.6rem] uppercase tracking-[0.17em] text-slate-400">Availability</dt>
              <dd className="text-sm md:text-base font-semibold text-yellow-100">24/7</dd>
            </div>
            <div className="rounded-lg border border-yellow-500/18 bg-slate-900/60 px-3 py-2 backdrop-blur-sm">
              <dt className="text-[0.6rem] uppercase tracking-[0.17em] text-slate-400">Satisfaction</dt>
              <dd className="text-sm md:text-base font-semibold text-yellow-100">99%</dd>
            </div>
          </dl>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="relative py-9 md:py-11">
        {/* golden glow background */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-10 -left-32 h-96 w-96 rounded-full bg-yellow-500/20 blur-3xl" />
          <div className="absolute top-1/2 right-[-5rem] h-80 w-80 rounded-full bg-amber-400/18 blur-3xl" />
          <div className="absolute bottom-20 left-1/3 h-72 w-72 rounded-full bg-yellow-400/15 blur-2xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-9 md:space-y-11">
          {/* Widgets Layout - vertical */}
          <section className="space-y-6 md:space-y-7">
            <div className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm md:text-base font-semibold text-slate-50">
                  {t('priceWidget.title')}
                </h2>
                <span className="text-[0.7rem] text-slate-400 hidden sm:inline">
                  {t('priceWidget.subtitle')}
                </span>
              </div>
              <div className="relative mt-1 rounded-2xl border border-yellow-500/40 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950/80 p-3.5 md:p-4 shadow-xl shadow-yellow-500/15 transition-transform duration-200 hover:-translate-y-[1px] hover:shadow-yellow-400/20 overflow-hidden">
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-yellow-400/5 to-amber-500/5" />
                <div className="relative z-10">
                  <GoldPriceWidget />
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm md:text-base font-semibold text-slate-50">
                  {t('calculator.title')}
                </h2>
                <span className="text-[0.7rem] text-slate-400 hidden sm:inline">
                  {t('calculator.description')}
                </span>
              </div>
              <div className="relative mt-1 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950/80 p-3.5 md:p-4 shadow-xl shadow-amber-500/15 transition-transform duration-200 hover:-translate-y-[1px] hover:shadow-amber-400/20 overflow-hidden">
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-400/5 to-yellow-500/5" />
                <div className="relative z-10">
                  <GoldInvestmentCalculator />
                </div>
              </div>
            </div>
          </section>

          {/* Services - compact but premium */}
          <section className="grid md:grid-cols-3 gap-3.5">
            <article className="rounded-xl border border-slate-700 bg-slate-950/40 p-4 shadow-md hover:border-yellow-400/60 hover:shadow-lg hover:shadow-yellow-500/15 transition-all duration-200">
              <h3 className="mb-1.5 text-xs md:text-sm font-semibold text-slate-50">
                {t('services.priceAnalysis')}
              </h3>
              <p className="text-[0.7rem] md:text-xs text-slate-300/90 leading-relaxed">
                {t('services.priceAnalysisDesc')}
              </p>
            </article>

            <article className="rounded-xl border border-slate-700 bg-slate-950/40 p-4 shadow-md hover:border-amber-400/60 hover:shadow-lg hover:shadow-amber-400/15 transition-all duration-200">
              <h3 className="mb-1.5 text-xs md:text-sm font-semibold text-slate-50">
                {t('services.investmentAdvice')}
              </h3>
              <p className="text-[0.7rem] md:text-xs text-slate-300/90 leading-relaxed">
                {t('services.investmentAdviceDesc')}
              </p>
            </article>

            <article className="rounded-xl border border-slate-700 bg-slate-950/40 p-4 shadow-md hover:border-orange-400/60 hover:shadow-lg hover:shadow-orange-400/15 transition-all duration-200">
              <h3 className="mb-1.5 text-xs md:text-sm font-semibold text-slate-50">
                {t('services.taxOptimization')}
              </h3>
              <p className="text-[0.7rem] md:text-xs text-slate-300/90 leading-relaxed">
                {t('services.taxOptimizationDesc')}
              </p>
            </article>
          </section>

          {/* Key Insights - 2 Columns */}
          <section className="grid md:grid-cols-2 gap-5">
            <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-5 shadow-md">
              <h3 className="text-xs md:text-sm font-semibold text-slate-50 mb-3">
                {t('marketInsights.factors.title')}
              </h3>
              <ul className="space-y-1.5 text-[0.7rem] md:text-xs">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-yellow-400" />
                  <span className="text-slate-200">{t('marketInsights.factors.economic')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-yellow-400" />
                  <span className="text-slate-200">{t('marketInsights.factors.inflation')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-yellow-400" />
                  <span className="text-slate-200">{t('marketInsights.factors.geopolitical')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-yellow-400" />
                  <span className="text-slate-200">{t('marketInsights.factors.currency')}</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-5 shadow-md">
              <h3 className="text-xs md:text-sm font-semibold text-slate-50 mb-3">
                {t('marketInsights.tips.title')}
              </h3>
              <ul className="space-y-1.5 text-[0.7rem] md:text-xs">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-3 w-3 rounded-full border border-emerald-400/70" />
                  <span className="text-slate-200">{t('marketInsights.tips.diversify')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-3 w-3 rounded-full border border-emerald-400/70" />
                  <span className="text-slate-200">{t('marketInsights.tips.longTerm')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-3 w-3 rounded-full border border-emerald-400/70" />
                  <span className="text-slate-200">{t('marketInsights.tips.monitor')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-3 w-3 rounded-full border border-emerald-400/70" />
                  <span className="text-slate-200">{t('marketInsights.tips.consult')}</span>
                </li>
              </ul>
            </div>
          </section>

          {/* CTA Section */}
          <section className="mt-2 rounded-2xl border border-yellow-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-7 md:p-9 shadow-2xl shadow-black/60 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-x-10 -top-20 h-32 rounded-full bg-yellow-400/12 blur-3xl" />
            <div className="relative z-10 text-center max-w-2xl mx-auto space-y-3.5">
              <h2 className="text-2xl md:text-3xl font-semibold text-slate-50">
                {t('cta.title')}
              </h2>
              <p className="text-xs md:text-sm text-slate-200/90">
                {t('cta.subtitle')}
              </p>
              <div className="mt-3 flex flex-col sm:flex-row gap-2.5 justify-center">
                <Link
                  href={`/${locale}/contact`}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 px-7 py-2.5 text-xs md:text-sm font-semibold text-slate-950 shadow-lg shadow-yellow-500/40 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-yellow-400/50"
                >
                  <span>{t('cta.button')}</span>
                </Link>
                <a
                  href="tel:+49123456789"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-500/80 bg-slate-900/70 px-7 py-2.5 text-xs md:text-sm font-medium text-slate-50 hover:border-slate-200 hover:bg-slate-800/80 transition-colors duration-200"
                >
                  <span>{'Call Now'}</span>
                </a>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
