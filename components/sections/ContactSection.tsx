"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

export default function ContactSection() {
  const t = useTranslations("contact");
  const s = useTranslations("services");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    service: "steuererklaerung",
    date: "",
    time: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setStatus("success");
        setFormData({ name: "", email: "", phone: "", message: "", service: "steuererklaerung", date: "", time: "" });
        setTimeout(() => setStatus("idle"), 5000);
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 5000);
      }
    } catch (error) {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 5000);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    } as any);
  };

  const quickSlots = ["09:00", "10:30", "13:00", "15:00"];
  const selectQuickSlot = (time: string) => {
    setFormData({ ...formData, time });
  };

  return (
    <section id="contact" className="relative py-24 overflow-hidden bg-gradient-to-b from-white via-slate-50 to-blue-50">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -z-10" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="inline-block mb-4 px-4 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full border border-blue-200 hover:shadow-lg transition-shadow">
            <span className="text-sm font-bold text-blue-700 tracking-wide uppercase">{t("subtitle") || "Get in Touch"}</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
            {t("title") || "Contact Us"}
          </h2>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed font-light">
            {t("description") || "Reach out to schedule your consultation or learn more about our services"}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* Left: Booking Card */}
          <div className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-blue-300">
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="relative p-10 space-y-8">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{t("booking_title") || "Book Appointment"}</h3>
                  <p className="text-gray-600">{t("booking_subtitle") || "Schedule your consultation"}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="text-yellow-400">★★★★★</div>
                    <div className="font-bold text-gray-900">4.8</div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{t("verified_reviews") || "Verified reviews"}</div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Service Select */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">{t("service_label") || "Select Service"}</label>
                  <select
                    name="service"
                    value={formData.service}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all duration-300 hover:border-gray-300"
                  >
                    <option value="steuererklaerung">{s("steuererklaerung.title")}</option>
                    <option value="steueroptimierung">{s("steueroptimierung.title")}</option>
                    <option value="real_estate">{s("real_estate.title")}</option>
                    <option value="it_consulting">{s("it_consulting.title")}</option>
                    <option value="accounting">{s("accounting.title")}</option>
                  </select>
                </div>

                {/* Date & Time Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">{t("date_label") || "Date"}</label>
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-300"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">{t("time_label") || "Time"}</label>
                    <input
                      type="time"
                      name="time"
                      value={formData.time}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-300"
                      required
                    />
                  </div>
                </div>

                {/* Quick Slots */}
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-3">{t("quick_slots") || "Or choose quick times"}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {quickSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => selectQuickSlot(slot)}
                        className={`px-3 py-2 rounded-lg font-medium transition-all duration-300 ${
                          formData.time === slot
                            ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 rounded-lg font-bold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === "loading" ? "📋 " + (t("booking") || "Booking...") : "✓ " + (t("book_now") || "Book Now")}
                </button>

                {/* Status Messages */}
                {status === "success" && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                    ✓ {t("success") || "Successfully booked!"}
                  </div>
                )}
                {status === "error" && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    ✕ {t("error") || "Something went wrong"}
                  </div>
                )}
              </form>

              {/* Hotline Info */}
              <div className="pt-6 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-900 mb-4">{t("hotline_label") || "Or call us directly"}</p>
                <div className="space-y-3">
                  <a
                    href="tel:+493012345678"
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors group"
                  >
                    <span className="text-2xl">📞</span>
                    <div>
                      <div className="text-sm text-gray-500">{t("phone_label")}</div>
                      <div className="font-bold text-blue-600 group-hover:text-blue-700">+49 30 1234 5678</div>
                    </div>
                  </a>
                  <a
                    href="mailto:info@finance-consulting.de"
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors group"
                  >
                    <span className="text-2xl">✉️</span>
                    <div>
                      <div className="text-sm text-gray-500">{t("email_label")}</div>
                      <div className="font-bold text-blue-600 group-hover:text-blue-700">info@finance-consulting.de</div>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Contact Form */}
          <div className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-blue-300">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="relative p-10">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{t("message_title") || "Send us a Message"}</h3>
              <p className="text-gray-600 mb-8">{t("message_subtitle") || "We'll get back to you as soon as possible"}</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">{t("name") || "Name"}</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-300"
                    placeholder={t("name_placeholder") || "Your name"}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">{t("email") || "Email"}</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-300"
                    placeholder={t("email_placeholder") || "your@email.com"}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">{t("phone") || "Phone"}</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-300"
                    placeholder="+49 ..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">{t("message") || "Message"}</label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-300 resize-none"
                    placeholder={t("message_placeholder") || "Tell us about your needs..."}
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 rounded-lg font-bold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === "loading" ? "📤 " + (t("sending") || "Sending...") : "✓ " + (t("submit") || "Send Message")}
                </button>

                {status === "success" && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                    ✓ {t("success") || "Message sent successfully!"}
                  </div>
                )}
                {status === "error" && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    ✕ {t("error") || "Failed to send message"}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>

        {/* Info Cards at Bottom */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-md p-8 border border-gray-100 hover:shadow-lg transition-shadow text-center">
            <div className="text-4xl mb-4">⏱️</div>
            <h4 className="text-lg font-bold text-gray-900 mb-2">{t("fast_response") || "Fast Response"}</h4>
            <p className="text-gray-600">{t("fast_response_desc") || "We respond within 24 hours"}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-8 border border-gray-100 hover:shadow-lg transition-shadow text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h4 className="text-lg font-bold text-gray-900 mb-2">{t("secure_data") || "Secure & Confidential"}</h4>
            <p className="text-gray-600">{t("secure_data_desc") || "Your data is fully protected"}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-8 border border-gray-100 hover:shadow-lg transition-shadow text-center">
            <div className="text-4xl mb-4">👥</div>
            <h4 className="text-lg font-bold text-gray-900 mb-2">{t("expert_team") || "Expert Team"}</h4>
            <p className="text-gray-600">{t("expert_team_desc") || "15+ years of experience"}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
