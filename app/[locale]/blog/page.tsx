import {getTranslations, setRequestLocale} from 'next-intl/server';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

const blogPosts = [
  {
    id: 1,
    title: {
      de: 'Steuervorteile bei der Altersvorsorge',
      en: 'Tax Benefits for Retirement Planning'
    },
    excerpt: {
      de: 'Wie Sie mit der richtigen Altersvorsorge Steuern sparen können.',
      en: 'How you can save taxes with the right retirement planning.'
    },
    date: '2024-01-15',
    image: '📊'
  },
  {
    id: 2,
    title: {
      de: 'Umsatzsteuer-Änderungen 2024',
      en: 'VAT Changes 2024'
    },
    excerpt: {
      de: 'Die wichtigsten Änderungen im Umsatzsteuerrecht für das Jahr 2024.',
      en: 'The most important changes in VAT law for 2024.'
    },
    date: '2024-01-10',
    image: '📈'
  },
  {
    id: 3,
    title: {
      de: 'Tipps zur Steuererklärung',
      en: 'Tax Return Tips'
    },
    excerpt: {
      de: 'Die besten Tipps für eine erfolgreiche Steuererklärung.',
      en: 'The best tips for a successful tax return.'
    },
    date: '2024-01-05',
    image: '💰'
  }
];

export default async function BlogPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('blog');

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {t('title')}
            </h1>
            <p className="text-xl text-gray-600">
              {t('subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {blogPosts.map((post) => (
              <article
                key={post.id}
                className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="bg-blue-600 text-white p-8 text-6xl text-center">
                  {post.image}
                </div>
                <div className="p-6">
                  <time className="text-sm text-gray-500">
                    {new Date(post.date).toLocaleDateString(locale)}
                  </time>
                  <h2 className="text-2xl font-bold text-gray-900 mt-2 mb-3">
                    {post.title[locale as 'de' | 'en']}
                  </h2>
                  <p className="text-gray-600 mb-4">
                    {post.excerpt[locale as 'de' | 'en']}
                  </p>
                  <a
                    href="#"
                    className="text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    {t('readMore')} →
                  </a>
                </div>
              </article>
            ))}
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
    title: locale === 'de' 
      ? 'Blog - Steuertipps & Neuigkeiten'
      : 'Blog - Tax Tips & News',
    description: locale === 'de'
      ? 'Aktuelle Informationen und Tipps rund um das Thema Steuern in Deutschland.'
      : 'Current information and tips about taxes in Germany.',
  };
}
