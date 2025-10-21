import {getTranslations, setRequestLocale} from 'next-intl/server';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

export default async function DatenschutzPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('datenschutz');

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
                {t('intro')}
              </h2>
              <p className="text-gray-700">{t('introText')}</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                {t('responsible')}
              </h2>
              <p className="text-gray-700">{t('responsibleText')}</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                {t('dataProcessing')}
              </h2>
              <p className="text-gray-700">{t('dataProcessingList')}</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                {t('purposes')}
              </h2>
              <p className="text-gray-700">{t('purposesList')}</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                {t('rights')}
              </h2>
              <p className="text-gray-700">{t('rightsText')}</p>
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
    title: locale === 'de' ? 'Datenschutz' : 'Privacy Policy',
    description: locale === 'de'
      ? 'Datenschutzerklärung und Informationen zum Umgang mit Ihren Daten'
      : 'Privacy policy and information about data handling',
  };
}
