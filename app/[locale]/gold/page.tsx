import React from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import GoldPriceWidget from '@/components/GoldPriceWidget';
import GoldInvestmentCalculator from '@/components/GoldInvestmentCalculator';

export default function GoldConsultingPage() {
  const t = useTranslations('gold');

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-amber-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-400 to-amber-500 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {t('title')}
          </h1>
          <p className="text-xl text-white opacity-90 max-w-3xl mx-auto">
            {t('subtitle')}
          </p>
        </div>
      </div>

      <div className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Gold Price Widget */}
          <div className="mb-16">
            <GoldPriceWidget />
          </div>

          {/* Investment Calculator */}
          <div className="mb-16">
            <GoldInvestmentCalculator />
          </div>

          {/* Consulting Services */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {t('services.priceAnalysis')}
              </h3>
              <p className="text-gray-600">
                {t('services.priceAnalysisDesc')}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {t('services.investmentAdvice')}
              </h3>
              <p className="text-gray-600">
                {t('services.investmentAdviceDesc')}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {t('services.taxOptimization')}
              </h3>
              <p className="text-gray-600">
                {t('services.taxOptimizationDesc')}
              </p>
            </div>
          </div>

          {/* Market Insights */}
          <div className="bg-white rounded-xl shadow-lg p-8 mb-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {t('marketInsights.title')}
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {t('marketInsights.factors.title')}
                </h3>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 font-bold mt-1">•</span>
                    <span>{t('marketInsights.factors.economic')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 font-bold mt-1">•</span>
                    <span>{t('marketInsights.factors.inflation')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 font-bold mt-1">•</span>
                    <span>{t('marketInsights.factors.geopolitical')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 font-bold mt-1">•</span>
                    <span>{t('marketInsights.factors.currency')}</span>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {t('marketInsights.tips.title')}
                </h3>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 font-bold mt-1">✓</span>
                    <span>{t('marketInsights.tips.diversify')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 font-bold mt-1">✓</span>
                    <span>{t('marketInsights.tips.longTerm')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 font-bold mt-1">✓</span>
                    <span>{t('marketInsights.tips.monitor')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 font-bold mt-1">✓</span>
                    <span>{t('marketInsights.tips.consult')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
              Frequently Asked Questions
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {/* FAQ 1 */}
              <details className="bg-white rounded-lg shadow p-6 cursor-pointer group">
                <summary className="font-semibold text-gray-900 flex items-center justify-between">
                  Why invest in gold?
                  <span className="transform group-open:rotate-180 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </span>
                </summary>
                <p className="text-gray-600 mt-4">
                  Gold is a hedge against inflation, currency devaluation, and economic uncertainty. It has maintained value across centuries and provides portfolio diversification.
                </p>
              </details>

              {/* FAQ 2 */}
              <details className="bg-white rounded-lg shadow p-6 cursor-pointer group">
                <summary className="font-semibold text-gray-900 flex items-center justify-between">
                  What factors affect gold prices?
                  <span className="transform group-open:rotate-180 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </span>
                </summary>
                <p className="text-gray-600 mt-4">
                  Interest rates, inflation, geopolitical tensions, currency strength, and central bank policies all influence gold prices significantly.
                </p>
              </details>

              {/* FAQ 3 */}
              <details className="bg-white rounded-lg shadow p-6 cursor-pointer group">
                <summary className="font-semibold text-gray-900 flex items-center justify-between">
                  How to buy gold safely?
                  <span className="transform group-open:rotate-180 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </span>
                </summary>
                <p className="text-gray-600 mt-4">
                  Buy from reputable dealers, verify purity and weight, consider storage options (vault, home safe), and maintain proper insurance coverage.
                </p>
              </details>

              {/* FAQ 4 */}
              <details className="bg-white rounded-lg shadow p-6 cursor-pointer group">
                <summary className="font-semibold text-gray-900 flex items-center justify-between">
                  What are tax implications?
                  <span className="transform group-open:rotate-180 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </span>
                </summary>
                <p className="text-gray-600 mt-4">
                  Gold investments may be subject to capital gains tax. Consult with tax professionals to optimize your strategy based on local regulations.
                </p>
              </details>
            </div>
          </div>

          {/* Risk Disclaimer */}
          <div className="bg-blue-50 border-l-4 border-blue-600 rounded-lg p-6 mb-16">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">⚠️ Important Disclaimer</h3>
            <p className="text-blue-800">
              Gold investments carry risks including market volatility, liquidity constraints, storage costs, and currency fluctuations. Past performance does not guarantee future results.
              Please consult with a qualified financial advisor before making investment decisions. This information is for educational purposes only and not financial advice.
            </p>
          </div>

          {/* CTA Section */}
          <div className="text-center bg-gradient-to-r from-yellow-400 to-amber-500 rounded-xl p-8 md:p-12 text-white mb-16">
            <h2 className="text-3xl font-bold mb-4">
              {t('cta.title')}
            </h2>
            <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
              {t('cta.subtitle')}
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <Link
                href="/#contact"
                className="inline-block bg-white text-yellow-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                {t('cta.button')}
              </Link>
              <a
                href="tel:+49123456789"
                className="inline-block bg-yellow-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-yellow-700 transition-colors"
              >
                📞 Call Us Now
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
