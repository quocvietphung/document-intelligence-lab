import { setRequestLocale } from "next-intl/server";
import BookingForm from "@/components/sections/BookingForm";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Book Your Tax Consultation
          </h1>
          <p className="text-xl text-gray-600">
            Schedule a consultation with our tax experts. Fill out the form below and receive instant email confirmation.
          </p>
        </div>
        <BookingForm />
      </div>
    </div>
  );
}
