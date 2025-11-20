import { useTranslations } from "next-intl";

export default function TestimonialsSection() {
  const t = useTranslations("testimonials");

  const testimonials = [
    {
      name: "Maria Schmidt",
      role: "Business Owner",
      content: "Excellent service! They helped me optimize my business taxes and saved me a lot of money.",
      rating: 5,
    },
    {
      name: "Hans Müller",
      role: "Freelancer",
      content: "Very professional and knowledgeable. I highly recommend their services.",
      rating: 5,
    },
    {
      name: "Anna Weber",
      role: "Individual Client",
      content: "They made the tax filing process so easy. Great communication and support!",
      rating: 5,
    },
  ];

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-white to-indigo-50 -z-10" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob -z-10" />
      <div className="absolute bottom-20 right-10 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-20">
          <div className="inline-block mb-4 px-4 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full border border-blue-200 hover:shadow-lg transition-shadow">
            <span className="text-sm font-bold text-blue-700 tracking-wide uppercase">{t("subtitle")}</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
            {t("title")}
          </h2>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed font-light">
            Was unsere Kunden über uns sagen
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="group relative bg-white p-8 rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-blue-300 hover:-translate-y-2"
            >
              {/* Quote mark */}
              <div className="absolute -top-4 -left-4 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl group-hover:scale-110 transition-transform">
                &quot;
              </div>

              {/* Stars */}
              <div className="flex mb-6 mt-2">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <span key={i} className="text-yellow-400 text-xl">
                    ⭐
                  </span>
                ))}
              </div>

              {/* Content */}
              <p className="text-gray-600 mb-6 leading-relaxed italic text-lg">
                &quot;{testimonial.content}&quot;
              </p>

              {/* Divider */}
              <div className="border-t border-gray-200 pt-6">
                <p className="font-bold text-gray-900 text-lg">{testimonial.name}</p>
                <p className="text-sm text-gray-500 font-medium">{testimonial.role}</p>
              </div>

              {/* Hover effect background */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl -z-10" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
