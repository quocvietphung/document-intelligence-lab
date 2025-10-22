import { setRequestLocale } from "next-intl/server";

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const pageTitle = locale === "vi" 
    ? "Điều khoản dịch vụ" 
    : locale === "de" 
    ? "Nutzungsbedingungen" 
    : "Terms of Service";

  return (
    <div className="min-h-screen bg-white py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">{pageTitle}</h1>
        
        <div className="prose prose-lg">
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            1. Acceptance of Terms
          </h2>
          <p className="text-gray-700 mb-4">
            By accessing and using this website and our services, you accept and agree to be bound 
            by the terms and provision of this agreement. If you do not agree to abide by the above, 
            please do not use this service.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            2. Services
          </h2>
          <p className="text-gray-700 mb-4">
            We provide professional tax consulting services, career guidance, and business 
            registration assistance for Vietnam and Germany. All services are subject to 
            availability and may be modified or discontinued at any time.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            3. User Responsibilities
          </h2>
          <p className="text-gray-700 mb-4">
            Users are responsible for:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Providing accurate and complete information</li>
            <li>Maintaining the confidentiality of their account information</li>
            <li>Complying with all applicable laws and regulations</li>
            <li>Using the service only for lawful purposes</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            4. Professional Advice Disclaimer
          </h2>
          <p className="text-gray-700 mb-4">
            While we strive to provide accurate and helpful information through our chatbot and 
            services, this does not constitute legal or financial advice. For specific legal or 
            tax matters, we recommend consulting with a licensed professional.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            5. Intellectual Property
          </h2>
          <p className="text-gray-700 mb-4">
            All content, trademarks, and data on this website, including but not limited to 
            software, databases, text, graphics, icons, hyperlinks, private information, designs, 
            and agreements, are the property of or licensed to Tax Consulting and are protected 
            by applicable intellectual property laws.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            6. Limitation of Liability
          </h2>
          <p className="text-gray-700 mb-4">
            Tax Consulting shall not be liable for any indirect, incidental, special, consequential, 
            or punitive damages resulting from your access to or use of, or inability to access or 
            use, the services.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            7. Data Protection
          </h2>
          <p className="text-gray-700 mb-4">
            We are committed to protecting your personal data in accordance with applicable data 
            protection laws, including GDPR. Please refer to our Privacy Policy for more information.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            8. Modifications to Terms
          </h2>
          <p className="text-gray-700 mb-4">
            We reserve the right to modify these terms at any time. Changes will be effective 
            immediately upon posting to the website. Your continued use of the service after 
            changes are posted constitutes your acceptance of the modified terms.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            9. Governing Law
          </h2>
          <p className="text-gray-700 mb-4">
            These Terms of Service shall be governed by and construed in accordance with the 
            laws of Germany, without regard to its conflict of law provisions.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            10. Contact Information
          </h2>
          <p className="text-gray-700 mb-4">
            If you have any questions about these Terms of Service, please contact us at:<br />
            <strong>Email:</strong> info@tax-consulting.de<br />
            <strong>Phone:</strong> +49 (0) 30 123456789
          </p>

          <p className="text-gray-600 text-sm mt-8">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
