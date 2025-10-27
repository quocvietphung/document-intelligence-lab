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
    service: "tax_declaration",
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
        setFormData({ name: "", email: "", phone: "", message: "", service: "tax_declaration", date: "", time: "" });
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

  return (
    <section id="contact" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t("title")}</h2>
          <p className="text-xl text-gray-600">{t("subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Booking card + hotline */}
          <div className="bg-gradient-to-br from-white to-gray-50 p-8 rounded-xl shadow-md">
            <h3 className="text-2xl font-semibold text-gray-900 mb-2">{t("booking_title")}</h3>
            <p className="text-gray-600 mb-6">{t("booking_subtitle")}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("service_label")}
                </label>
                <select
                  name="service"
                  value={formData.service}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                >
                  <option value="tax_declaration">{s("tax_declaration.title")}</option>
                  <option value="tax_optimization">{s("tax_optimization.title")}</option>
                  <option value="real_estate">{s("real_estate.title")}</option>
                  <option value="it_consulting">{s("it_consulting.title")}</option>
                  <option value="accounting">{s("accounting.title")}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t("date_label")}</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t("time_label")}</label>
                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                >
                  {status === "loading" ? "..." : t("book_now")}
                </button>
              </div>

              {status === "success" && (
                <div className="bg-green-100 text-green-700 px-4 py-3 rounded-lg">
                  {t("success")}
                </div>
              )}

              {status === "error" && (
                <div className="bg-red-100 text-red-700 px-4 py-3 rounded-lg">
                  {t("error")}
                </div>
              )}
            </form>

            <div className="mt-8 p-4 bg-white border border-gray-100 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">{t("hotline_label")}</h4>
              <a href="tel:+493012345678" className="text-lg font-bold text-blue-600 hover:underline">
                +49 30 1234 5678
              </a>
              <p className="text-sm text-gray-500 mt-2">{t("hotline_note")}</p>
            </div>
          </div>

          {/* Right: Contact form details (kept for messages / general contact) */}
          <div className="bg-white p-8 rounded-xl shadow-md">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  {t("name")}
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  {t("email")}
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  {t("phone")}
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  {t("message")}
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={5}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              >
                {status === "loading" ? "..." : t("submit")}
              </button>

              {status === "success" && (
                <div className="bg-green-100 text-green-700 px-4 py-3 rounded-lg">
                  {t("success")}
                </div>
              )}

              {status === "error" && (
                <div className="bg-red-100 text-red-700 px-4 py-3 rounded-lg">
                  {t("error")}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
