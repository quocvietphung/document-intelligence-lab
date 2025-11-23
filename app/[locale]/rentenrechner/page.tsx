"use client";

import { useEffect, useState, useCallback } from "react";

export default function RentenrechnerPage() {
  const [locale, setLocale] = useState("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Get locale from URL
    const pathParts = typeof window !== "undefined" ? window.location.pathname.split("/") : [];
    const detectedLocale = pathParts[1] || "en";
    setLocale(detectedLocale);
    setMounted(true);
  }, []);

  const translations = {
    de: {
      title: "Rentenrechner",
      subtitle: "Berechnen Sie Ihre zukünftige Rente und planen Sie Ihre Altersvorsorge",
      section1: "Ihre Angaben",
      section2: "Ergebnis",
      currentAge: "Aktuelles Alter",
      retirementAge: "Renteneintrittsalter",
      monthlyIncome: "Monatliches Einkommen (€)",
      savingsRate: "Sparquote (%)",
      annualReturn: "Jährliche Rendite (%)",
      currentSavings: "Aktuelle Ersparnisse (€)",
      calculate: "Berechnen",
      reset: "Zurücksetzen",
      estimatedRetirement: "Geschätzte monatliche Rente",
      totalSavings: "Gesamtersparnisse bis Rente",
      yearsToRetirement: "Jahre bis Rente",
      info: "Dieser Rentenrechner gibt eine ungefähre Schätzung. Konsultieren Sie einen Finanzberater für personalisierte Beratung.",
      placeholder: "Geben Sie einen Wert ein",
    },
    en: {
      title: "Retirement Calculator",
      subtitle: "Calculate your future retirement income and plan your retirement",
      section1: "Your Information",
      section2: "Results",
      currentAge: "Current Age",
      retirementAge: "Retirement Age",
      monthlyIncome: "Monthly Income ($)",
      savingsRate: "Savings Rate (%)",
      annualReturn: "Annual Return (%)",
      currentSavings: "Current Savings ($)",
      calculate: "Calculate",
      reset: "Reset",
      estimatedRetirement: "Estimated Monthly Retirement Income",
      totalSavings: "Total Savings at Retirement",
      yearsToRetirement: "Years Until Retirement",
      info: "This retirement calculator provides an approximate estimate. Consult a financial advisor for personalized advice.",
      placeholder: "Enter a value",
    },
    vi: {
      title: "Tính toán Hưu trí",
      subtitle: "Tính toán thu nhập hưu trí của bạn trong tương lai và lập kế hoạch hưu trí",
      section1: "Thông tin của bạn",
      section2: "Kết quả",
      currentAge: "Tuổi hiện tại",
      retirementAge: "Tuổi hưu trí",
      monthlyIncome: "Thu nhập hàng tháng (VND)",
      savingsRate: "Tỷ lệ tiết kiệm (%)",
      annualReturn: "Lợi suất hàng năm (%)",
      currentSavings: "Tiết kiệm hiện tại (VND)",
      calculate: "Tính toán",
      reset: "Đặt lại",
      estimatedRetirement: "Thu nhập hưu trí hàng tháng ước tính",
      totalSavings: "Tổng tiết kiệm khi hưu trí",
      yearsToRetirement: "Năm cho đến khi hưu trí",
      info: "Máy tính hưu trí này cung cấp ước tính gần đúng. Tham khảo ý kiến của cố vấn tài chính để được tư vấn cá nhân hóa.",
      placeholder: "Nhập một giá trị",
    },
  };

  const t = translations[locale as keyof typeof translations] || translations.en;

  const calculateRetirement = useCallback(() => {
    const currentAge = parseFloat((document.getElementById("currentAge") as HTMLInputElement)?.value) || 0;
    const retirementAge = parseFloat((document.getElementById("retirementAge") as HTMLInputElement)?.value) || 65;
    const monthlyIncome = parseFloat((document.getElementById("monthlyIncome") as HTMLInputElement)?.value) || 0;
    const savingsRate = parseFloat((document.getElementById("savingsRate") as HTMLInputElement)?.value) || 0;
    const annualReturn = parseFloat((document.getElementById("annualReturn") as HTMLInputElement)?.value) || 5;
    const currentSavings = parseFloat((document.getElementById("currentSavings") as HTMLInputElement)?.value) || 0;

    const yearsToRetirement = Math.max(0, retirementAge - currentAge);
    const monthlyContribution = (monthlyIncome * savingsRate) / 100;
    const monthlyReturn = annualReturn / 12 / 100;
    const monthsToRetirement = yearsToRetirement * 12;

    let futureValue = currentSavings * Math.pow(1 + monthlyReturn, monthsToRetirement);

    if (monthlyContribution > 0 && monthlyReturn > 0) {
      futureValue += (monthlyContribution * (Math.pow(1 + monthlyReturn, monthsToRetirement) - 1)) / monthlyReturn;
    }

    const monthlyRetirement = (futureValue / (yearsToRetirement > 0 ? yearsToRetirement * 12 : 1)) * 0.04;

    const getCurrency = () => {
      if (locale === "de") return "EUR";
      if (locale === "vi") return "VND";
      return "USD";
    };

    const formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
      style: "currency",
      currency: getCurrency(),
    });

    const yearsUnit = locale === "de" ? "Jahre" : locale === "vi" ? "năm" : "years";

    const yearsElement = document.getElementById("yearsResult");
    const totalSavingsElement = document.getElementById("totalSavingsResult");
    const monthlyRetirementElement = document.getElementById("monthlyRetirementResult");

    if (yearsElement) yearsElement.textContent = `${yearsToRetirement} ${yearsUnit}`;
    if (totalSavingsElement) totalSavingsElement.textContent = formatter.format(futureValue);
    if (monthlyRetirementElement) monthlyRetirementElement.textContent = formatter.format(monthlyRetirement);
  }, [locale]);

  const handleReset = () => {
    const form = document.getElementById("calculatorForm") as HTMLFormElement;
    if (form) {
      form.reset();
      setTimeout(() => calculateRetirement(), 0);
    }
  };

  useEffect(() => {
    if (mounted) {
      calculateRetirement();
    }
  }, [mounted, locale, calculateRetirement]);

  if (!mounted) {
    return (
      <section className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50 py-12 md:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50 py-12 md:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            {t.title}
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
            {t.subtitle}
          </p>
        </div>

        {/* Calculator Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Input Section */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b-2 border-blue-500">
              {t.section1}
            </h2>

            <form className="space-y-6" id="calculatorForm">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.currentAge}
                </label>
                <input
                  type="number"
                  id="currentAge"
                  placeholder={t.placeholder}
                  defaultValue="30"
                  onChange={calculateRetirement}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.retirementAge}
                </label>
                <input
                  type="number"
                  id="retirementAge"
                  placeholder={t.placeholder}
                  defaultValue="65"
                  onChange={calculateRetirement}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.monthlyIncome}
                </label>
                <input
                  type="number"
                  id="monthlyIncome"
                  placeholder={t.placeholder}
                  defaultValue="3000"
                  onChange={calculateRetirement}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.savingsRate}
                </label>
                <input
                  type="number"
                  id="savingsRate"
                  placeholder={t.placeholder}
                  defaultValue="20"
                  min="0"
                  max="100"
                  onChange={calculateRetirement}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.annualReturn}
                </label>
                <input
                  type="number"
                  id="annualReturn"
                  placeholder={t.placeholder}
                  defaultValue="5"
                  step="0.1"
                  onChange={calculateRetirement}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.currentSavings}
                </label>
                <input
                  type="number"
                  id="currentSavings"
                  placeholder={t.placeholder}
                  defaultValue="10000"
                  onChange={calculateRetirement}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={calculateRetirement}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300"
                >
                  {t.calculate}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-bold hover:border-gray-400 hover:bg-gray-50 transition-all duration-300"
                >
                  {t.reset}
                </button>
              </div>
            </form>
          </div>

          {/* Results Section */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-8 shadow-lg border-2 border-emerald-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b-2 border-emerald-500">
              {t.section2}
            </h2>

            <div className="space-y-6">
              <div className="bg-white rounded-lg p-6 border-l-4 border-emerald-500">
                <p className="text-sm text-gray-600 mb-1">{t.yearsToRetirement}</p>
                <p className="text-3xl font-bold text-emerald-600" id="yearsResult">
                  —
                </p>
              </div>

              <div className="bg-white rounded-lg p-6 border-l-4 border-blue-500">
                <p className="text-sm text-gray-600 mb-1">{t.totalSavings}</p>
                <p className="text-3xl font-bold text-blue-600" id="totalSavingsResult">
                  —
                </p>
              </div>

              <div className="bg-white rounded-lg p-6 border-l-4 border-purple-500">
                <p className="text-sm text-gray-600 mb-1">{t.estimatedRetirement}</p>
                <p className="text-3xl font-bold text-purple-600" id="monthlyRetirementResult">
                  —
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8">
                <p className="text-sm text-gray-700 leading-relaxed">
                  ℹ️ {t.info}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

