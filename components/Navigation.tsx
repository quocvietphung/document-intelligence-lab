'use client';

import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/routing';
import {usePathname} from 'next/navigation';

export default function Navigation() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  const links = [
    {href: '/', label: t('home')},
    {href: '/#services', label: t('services')},
    {href: '/blog', label: t('blog')},
    {href: '/#contact', label: t('contact')},
  ];

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">
              Steuerberatung
            </Link>
          </div>
          <div className="flex items-center space-x-8">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                {link.label}
              </a>
            ))}
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </nav>
  );
}

function LanguageSwitcher() {
  const pathname = usePathname();
  
  return (
    <div className="flex space-x-2">
      <a 
        href={`/de${pathname}`}
        className="px-3 py-1 rounded hover:bg-gray-100"
      >
        DE
      </a>
      <a 
        href={`/en${pathname}`}
        className="px-3 py-1 rounded hover:bg-gray-100"
      >
        EN
      </a>
    </div>
  );
}
