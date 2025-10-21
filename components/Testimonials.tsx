'use client';

import {useTranslations} from 'next-intl';

export default function Testimonials() {
  const t = useTranslations('testimonials');

  const testimonials = [
    { key: 'testimonial1' },
    { key: 'testimonial2' },
    { key: 'testimonial3' },
  ];

  return (
    <section className="py-20 bg-gray-50">
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
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.key}
              className="bg-white p-8 rounded-lg shadow-lg"
            >
              <div className="text-yellow-500 text-2xl mb-4">⭐⭐⭐⭐⭐</div>
              <p className="text-gray-700 mb-6 italic">
                &quot;{t(`${testimonial.key}.text`)}&quot;
              </p>
              <div className="border-t pt-4">
                <p className="font-bold text-gray-900">
                  {t(`${testimonial.key}.author`)}
                </p>
                <p className="text-gray-600 text-sm">
                  {t(`${testimonial.key}.role`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
