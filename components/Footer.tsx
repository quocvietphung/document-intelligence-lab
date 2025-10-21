'use client';

import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/routing';

export default function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-2xl font-bold mb-4">{t('company')}</h3>
            <p className="text-gray-400">{t('description')}</p>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4">{t('quickLinks')}</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-gray-400 hover:text-white transition-colors">
                  {t('company')}
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-gray-400 hover:text-white transition-colors">
                  Blog
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4">{t('legal')}</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/impressum" className="text-gray-400 hover:text-white transition-colors">
                  {t('impressum')}
                </Link>
              </li>
              <li>
                <Link href="/datenschutz" className="text-gray-400 hover:text-white transition-colors">
                  {t('datenschutz')}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; {new Date().getFullYear()} {t('company')}. {t('rights')}.</p>
        </div>
      </div>
    </footer>
  );
}
