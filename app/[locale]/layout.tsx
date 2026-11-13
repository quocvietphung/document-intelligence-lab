import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/routing";
import { KeycloakProvider } from "@/components/auth/KeycloakProvider";

import "../globals.css";

export const metadata: Metadata = {
  title: "Document Intelligence Lab",
  description:
    "An Azure AI document research lab for banking, insurance, real-estate and general documents, with source-grounded RAG and human review.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <KeycloakProvider>{children}</KeycloakProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
