'use client';

import {useTranslations} from 'next-intl';

export default function Services() {
  const t = useTranslations('services');

  const services = [
    {
      key: 'tax_consulting',
      icon: '📊',
    },
    {
      key: 'income_tax',
      icon: '💰',
    },
    {
      key: 'vat',
      icon: '📈',
    },
  ];

  return (
    <section id="services" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            {t('title')}
          </h2>
          <p className="text-xl text-gray-600">
            {t('subtitle')}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {services.map((service) => (
            <div
              key={service.key}
              className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className="text-5xl mb-4">{service.icon}</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {t(`${service.key}.title`)}
              </h3>
              <p className="text-gray-600">
                {t(`${service.key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
