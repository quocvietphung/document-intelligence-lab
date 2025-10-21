import { setRequestLocale } from "next-intl/server";

export default async function DatenschutzPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-white py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Datenschutzerklärung
        </h1>

        <div className="prose prose-lg">
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            1. Datenschutz auf einen Blick
          </h2>

          <h3 className="text-xl font-bold text-gray-900 mt-6 mb-3">
            Allgemeine Hinweise
          </h3>
          <p className="text-gray-700 mb-4">
            Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren 
            personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene 
            Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
          </p>

          <h3 className="text-xl font-bold text-gray-900 mt-6 mb-3">
            Datenerfassung auf dieser Website
          </h3>
          <p className="text-gray-700 mb-4">
            <strong>Wer ist verantwortlich für die Datenerfassung auf dieser Website?</strong>
          </p>
          <p className="text-gray-700 mb-4">
            Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. 
            Dessen Kontaktdaten können Sie dem Impressum dieser Website entnehmen.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            2. Allgemeine Hinweise und Pflichtinformationen
          </h2>

          <h3 className="text-xl font-bold text-gray-900 mt-6 mb-3">Datenschutz</h3>
          <p className="text-gray-700 mb-4">
            Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. 
            Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der 
            gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.
          </p>

          <h3 className="text-xl font-bold text-gray-900 mt-6 mb-3">
            Hinweis zur verantwortlichen Stelle
          </h3>
          <p className="text-gray-700 mb-4">
            Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:
          </p>
          <p className="text-gray-700 mb-4">
            Tax Consulting GmbH<br />
            Musterstraße 123<br />
            10115 Berlin<br />
            Deutschland
          </p>
          <p className="text-gray-700 mb-4">
            Telefon: +49 (0) 30 123456789<br />
            E-Mail: info@tax-consulting.de
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            3. Datenerfassung auf dieser Website
          </h2>

          <h3 className="text-xl font-bold text-gray-900 mt-6 mb-3">Cookies</h3>
          <p className="text-gray-700 mb-4">
            Unsere Internetseiten verwenden so genannte &ldquo;Cookies&rdquo;. Cookies sind kleine 
            Textdateien und richten auf Ihrem Endgerät keinen Schaden an. Sie werden entweder 
            vorübergehend für die Dauer einer Sitzung (Session-Cookies) oder dauerhaft 
            (permanente Cookies) auf Ihrem Endgerät gespeichert.
          </p>

          <h3 className="text-xl font-bold text-gray-900 mt-6 mb-3">
            Server-Log-Dateien
          </h3>
          <p className="text-gray-700 mb-4">
            Der Provider der Seiten erhebt und speichert automatisch Informationen in so 
            genannten Server-Log-Dateien, die Ihr Browser automatisch an uns übermittelt. 
            Dies sind:
          </p>
          <ul className="list-disc pl-8 text-gray-700 mb-4">
            <li>Browsertyp und Browserversion</li>
            <li>verwendetes Betriebssystem</li>
            <li>Referrer URL</li>
            <li>Hostname des zugreifenden Rechners</li>
            <li>Uhrzeit der Serveranfrage</li>
            <li>IP-Adresse</li>
          </ul>

          <h3 className="text-xl font-bold text-gray-900 mt-6 mb-3">Kontaktformular</h3>
          <p className="text-gray-700 mb-4">
            Wenn Sie uns per Kontaktformular Anfragen zukommen lassen, werden Ihre Angaben 
            aus dem Anfrageformular inklusive der von Ihnen dort angegebenen Kontaktdaten 
            zwecks Bearbeitung der Anfrage und für den Fall von Anschlussfragen bei uns 
            gespeichert.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            4. Ihre Rechte
          </h2>

          <h3 className="text-xl font-bold text-gray-900 mt-6 mb-3">
            Auskunft, Löschung und Berichtigung
          </h3>
          <p className="text-gray-700 mb-4">
            Sie haben im Rahmen der geltenden gesetzlichen Bestimmungen jederzeit das Recht 
            auf unentgeltliche Auskunft über Ihre gespeicherten personenbezogenen Daten, 
            deren Herkunft und Empfänger und den Zweck der Datenverarbeitung und ggf. ein 
            Recht auf Berichtigung oder Löschung dieser Daten.
          </p>

          <h3 className="text-xl font-bold text-gray-900 mt-6 mb-3">
            Widerspruch gegen Werbe-Mails
          </h3>
          <p className="text-gray-700 mb-4">
            Der Nutzung von im Rahmen der Impressumspflicht veröffentlichten Kontaktdaten 
            zur Übersendung von nicht ausdrücklich angeforderter Werbung und 
            Informationsmaterialien wird hiermit widersprochen.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            5. SSL- bzw. TLS-Verschlüsselung
          </h2>
          <p className="text-gray-700 mb-4">
            Diese Seite nutzt aus Sicherheitsgründen und zum Schutz der Übertragung 
            vertraulicher Inhalte eine SSL- bzw. TLS-Verschlüsselung. Eine verschlüsselte 
            Verbindung erkennen Sie daran, dass die Adresszeile des Browsers von &ldquo;http://&rdquo; 
            auf &ldquo;https://&rdquo; wechselt und an dem Schloss-Symbol in Ihrer Browserzeile.
          </p>
        </div>
      </div>
    </div>
  );
}
