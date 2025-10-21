'use client';

import {useTranslations} from 'next-intl';

export default function Process() {
  const t = useTranslations('process');

  const steps = [
    { key: 'step1', icon: '📅' },
    { key: 'step2', icon: '🔍' },
    { key: 'step3', icon: '⚙️' },
    { key: 'step4', icon: '🤝' },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            {t('title')}
          </h2>
          <p className="text-xl text-gray-600">
            {t('subtitle')}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={step.key} className="text-center">
              <div className="bg-blue-600 text-white w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                {step.icon}
              </div>
              <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-4">
                {index + 1}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {t(`${step.key}.title`)}
              </h3>
              <p className="text-gray-600">
                {t(`${step.key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
