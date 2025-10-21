'use client';

import {useTranslations} from 'next-intl';

export default function Hero() {
  const t = useTranslations('hero');

  return (
    <section className="relative bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            {t('title')}
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-blue-100">
            {t('subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#contact"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              {t('cta')}
            </a>
            <a
              href="#services"
              className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors"
            >
              {t('ctaSecondary')}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
