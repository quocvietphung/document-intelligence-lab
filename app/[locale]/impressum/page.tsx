import {getTranslations, setRequestLocale} from 'next-intl/server';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

export default async function ImpressumPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('impressum');

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">
            {t('title')}
          </h1>
          <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                {t('responsibleFor')}
              </h2>
              <p className="text-gray-700">{t('company')}</p>
              <p className="text-gray-700">{t('address')}</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                {t('contact')}
              </h2>
              <p className="text-gray-700">{t('phone')}</p>
              <p className="text-gray-700">{t('email')}</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                {t('register')}
              </h2>
              <p className="text-gray-700">{t('registerNumber')}</p>
              <p className="text-gray-700">{t('taxNumber')}</p>
              <p className="text-gray-700">{t('chamber')}</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                {t('liability')}
              </h2>
              <p className="text-gray-700">{t('liabilityText')}</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  
  return {
    title: locale === 'de' ? 'Impressum' : 'Legal Notice',
    description: locale === 'de'
      ? 'Rechtliche Informationen und Impressum'
      : 'Legal information and legal notice',
  };
}
