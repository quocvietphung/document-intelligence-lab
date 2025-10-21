import {useTranslations} from 'next-intl';
import {setRequestLocale} from 'next-intl/server';
import Navigation from '@/components/Navigation';
import Hero from '@/components/Hero';
import Services from '@/components/Services';
import Process from '@/components/Process';
import Testimonials from '@/components/Testimonials';
import ContactForm from '@/components/ContactForm';
import Footer from '@/components/Footer';

export default async function HomePage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  return (
    <>
      <Navigation />
      <main>
        <Hero />
        <Services />
        <Process />
        <Testimonials />
        <ContactForm />
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
      ? 'Steuerberatung Deutschland - Ihre Experten für Steuern'
      : 'Tax Consulting Germany - Your Tax Experts',
    description: locale === 'de'
      ? 'Professionelle Steuerberatung für Privatpersonen und Unternehmen in Deutschland. Einkommensteuer, Umsatzsteuer und mehr.'
      : 'Professional tax consulting for individuals and businesses in Germany. Income tax, VAT and more.',
    keywords: locale === 'de'
      ? 'Steuerberatung, Einkommensteuer, Umsatzsteuer, Steuererklärung, Deutschland'
      : 'tax consulting, income tax, VAT, tax return, Germany',
    openGraph: {
      title: locale === 'de' 
        ? 'Steuerberatung Deutschland'
        : 'Tax Consulting Germany',
      description: locale === 'de'
        ? 'Ihre Experten für Steuerberatung in Deutschland'
        : 'Your tax consulting experts in Germany',
      locale: locale,
      type: 'website',
    },
  };
}
