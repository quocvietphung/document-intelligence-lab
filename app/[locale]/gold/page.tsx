import React from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import GoldPriceWidget from '@/components/GoldPriceWidget';

export default function GoldConsultingPage() {
  const t = useTranslations('gold');

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-amber-50 py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {t('title')}
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {/* Gold Price Widget */}
        <div className="mb-12">
          <GoldPriceWidget />
        </div>

        {/* Consulting Services */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          <div className="bg-white rounded-xl shadow-lg p-6">
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

          <div className="bg-white rounded-xl shadow-lg p-6">
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

          <div className="bg-white rounded-xl shadow-lg p-6">
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
        <div className="bg-white rounded-xl shadow-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {t('marketInsights.title')}
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {t('marketInsights.factors.title')}
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li>• {t('marketInsights.factors.economic')}</li>
                <li>• {t('marketInsights.factors.inflation')}</li>
                <li>• {t('marketInsights.factors.geopolitical')}</li>
                <li>• {t('marketInsights.factors.currency')}</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {t('marketInsights.tips.title')}
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li>• {t('marketInsights.tips.diversify')}</li>
                <li>• {t('marketInsights.tips.longTerm')}</li>
                <li>• {t('marketInsights.tips.monitor')}</li>
                <li>• {t('marketInsights.tips.consult')}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-to-r from-yellow-400 to-amber-500 rounded-xl p-8 text-white">
          <h2 className="text-2xl font-bold mb-4">
            {t('cta.title')}
          </h2>
          <p className="text-lg mb-6 opacity-90">
            {t('cta.subtitle')}
          </p>
          <Link
            href="/#contact"
            className="inline-block bg-white text-yellow-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            {t('cta.button')}
          </Link>
        </div>
      </div>
    </div>
  );
}
