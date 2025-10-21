import { setRequestLocale } from "next-intl/server";

export default async function ImpressumPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-white py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Impressum</h1>
        
        <div className="prose prose-lg">
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            Angaben gemäß § 5 TMG
          </h2>
          
          <p className="text-gray-700 mb-4">
            <strong>Firmenname:</strong><br />
            Tax Consulting GmbH<br />
            Musterstraße 123<br />
            10115 Berlin<br />
            Deutschland
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Kontakt</h2>
          <p className="text-gray-700 mb-4">
            <strong>Telefon:</strong> +49 (0) 30 123456789<br />
            <strong>E-Mail:</strong> info@tax-consulting.de
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            Registereintrag
          </h2>
          <p className="text-gray-700 mb-4">
            <strong>Eintragung im Handelsregister:</strong><br />
            Registergericht: Amtsgericht Berlin-Charlottenburg<br />
            Registernummer: HRB 123456 B
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            Umsatzsteuer-ID
          </h2>
          <p className="text-gray-700 mb-4">
            Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz:<br />
            DE123456789
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            Berufsbezeichnung und berufsrechtliche Regelungen
          </h2>
          <p className="text-gray-700 mb-4">
            <strong>Berufsbezeichnung:</strong> Steuerberater<br />
            <strong>Zuständige Kammer:</strong> Steuerberaterkammer Berlin<br />
            <strong>Verliehen in:</strong> Deutschland
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV
          </h2>
          <p className="text-gray-700 mb-4">
            Max Mustermann<br />
            Musterstraße 123<br />
            10115 Berlin
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            Haftungsausschluss
          </h2>
          
          <h3 className="text-xl font-bold text-gray-900 mt-6 mb-3">
            Haftung für Inhalte
          </h3>
          <p className="text-gray-700 mb-4">
            Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die 
            Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch 
            keine Gewähr übernehmen. Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG 
            für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.
          </p>

          <h3 className="text-xl font-bold text-gray-900 mt-6 mb-3">
            Haftung für Links
          </h3>
          <p className="text-gray-700 mb-4">
            Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte 
            wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch 
            keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der 
            jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
          </p>

          <h3 className="text-xl font-bold text-gray-900 mt-6 mb-3">Urheberrecht</h3>
          <p className="text-gray-700 mb-4">
            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten 
            unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, 
            Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes 
            bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
          </p>
        </div>
      </div>
    </div>
  );
}
