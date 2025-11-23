import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'gold' });

  return {
    title: `${t('title')} | Finance Consulting`,
    description: t('subtitle'),
    keywords: ['gold price', 'gold investment', 'gold consulting', 'precious metals', 'investment advice'],
    openGraph: {
      title: t('title'),
      description: t('subtitle'),
      type: 'website',
    },
  };
}

