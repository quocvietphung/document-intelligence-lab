"use client";

import { useEffect, useState, useCallback } from "react";


export default function RentenrechnerPage() {
  const [locale, setLocale] = useState("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const pathParts = typeof window !== "undefined" ? window.location.pathname.split("/") : [];
    const detectedLocale = pathParts[1] || "en";
    setLocale(detectedLocale);
    setMounted(true);
  }, []);

  const translations = {
    de: {
      title: "Deutsche Rentenversicherung Rechner",
      subtitle: "Berechnen Sie Ihre gesetzliche Altersrente basierend auf der deutschen Rentenformel",
      section1: "Ihre Angaben",
      section2: "Ergebnis",
      entgeltpunkte: "Bereits erworbene Entgeltpunkte",
      incomeRatio: "Einkommen als % des Durchschnittsverdiensten",
      currentAge: "Aktuelles Alter",
      plannedRetirementAge: "Geplantes Renteneintrittsalter",
      yearsContributing: "Beitragsjahre bis Rente",
      targetPension: "Angestrebte monatliche Rente (€)",
      rentenwertWest: "Aktueller Rentenwert West (€)",
      rentenwertOst: "Aktueller Rentenwert Ost (€)",
      chooseRegion: "Region",
      west: "West",
      ost: "Ost",
      calculate: "Berechnen",
      reset: "Zurücksetzen",
      estimatedGrossPension: "Geschätzte monatliche Bruttorente",
      accessFactor: "Zugangsfaktor",
      totalEntgeltpunkte: "Geschätzte Gesamtentgeltpunkte",
      pensionGap: "Versorgungslücke (Zielrente - Geschätzte Rente)",
      noGap: "Zielrente erreicht ✓",
      info: "Dieser Rechner basiert auf der deutschen Rentenformel (Entgeltpunkte × Zugangsfaktor × Rentenartfaktor × aktueller Rentenwert). Dies ist eine Approximation. Für personalisierte Beratung konsultieren Sie einen Rentenberater oder die Deutsche Rentenversicherung.",
      infoAccess: "Der Zugangsfaktor beträgt 100% bei Regelrentenalter (67 Jahre). Für jeden Monat Frührentner wird 0,3% abgezogen, für jeden Monat später hinzugefügt.",
      placeholder: "Geben Sie einen Wert ein",
    },
    en: {
      title: "German Statutory Pension Calculator",
      subtitle: "Calculate your state pension based on the German statutory pension formula",
      section1: "Your Information",
      section2: "Results",
      entgeltpunkte: "Entgeltpunkte (earnings points) accumulated so far",
      incomeRatio: "Expected income as % of average insured earnings",
      currentAge: "Current Age",
      plannedRetirementAge: "Planned Retirement Age",
      yearsContributing: "Contributing years until retirement",
      targetPension: "Target Monthly Pension (EUR)",
      rentenwertWest: "Current Rentenwert West (EUR)",
      rentenwertOst: "Current Rentenwert Ost (EUR)",
      chooseRegion: "Region",
      west: "West",
      ost: "Ost",
      calculate: "Calculate",
      reset: "Reset",
      estimatedGrossPension: "Estimated Monthly Gross Pension",
      accessFactor: "Access Factor",
      totalEntgeltpunkte: "Estimated Total Entgeltpunkte",
      pensionGap: "Pension Gap (Target - Estimated)",
      noGap: "Target pension reached ✓",
      info: "This calculator is based on the German pension formula (Entgeltpunkte × Access Factor × Pension Type Factor × Current Pension Value). This is an approximation. For personalized advice, consult a pension advisor or Deutsche Rentenversicherung.",
      infoAccess: "The access factor is 100% at standard retirement age (67 years). For each month of early retirement -0.3%, for each month later +0.3%.",
      placeholder: "Enter a value",
    },
    vi: {
      title: "Máy Tính Hưu Trí Đức",
      subtitle: "Tính toán lương hưu của bạn dựa trên công thức hưu trí theo luật Đức",
      section1: "Thông tin của bạn",
      section2: "Kết quả",
      entgeltpunkte: "Điểm lương (Entgeltpunkte) đã tích lũy",
      incomeRatio: "Doanh thu dự kiến là % của thu nhập bảo hiểm trung bình",
      currentAge: "Tuổi hiện tại",
      plannedRetirementAge: "Tuổi hưu trí dự kiến",
      yearsContributing: "Năm đóng góp đến khi hưu trí",
      targetPension: "Lương hưu mục tiêu hàng tháng (EUR)",
      rentenwertWest: "Giá trị lương hưu West hiện tại (EUR)",
      rentenwertOst: "Giá trị lương hưu Ost hiện tại (EUR)",
      chooseRegion: "Khu vực",
      west: "West",
      ost: "Ost",
      calculate: "Tính toán",
      reset: "Đặt lại",
      estimatedGrossPension: "Lương hưu brutto hàng tháng ước tính",
      accessFactor: "Hệ số truy cập",
      totalEntgeltpunkte: "Tổng điểm lương ước tính",
      pensionGap: "Khoảng trống hưu trí (Mục tiêu - Ước tính)",
      noGap: "Đạt được lương hưu mục tiêu ✓",
      info: "Máy tính này dựa trên công thức lương hưu Đức (Điểm lương × Hệ số truy cập × Hệ số loại lương hưu × Giá trị lương hưu hiện tại). Đây là ước tính gần đúng. Để được tư vấn cá nhân hóa, vui lòng liên hệ với cố vấn lương hưu.",
      infoAccess: "Hệ số truy cập là 100% ở tuổi hưu trí tiêu chuẩn (67 tuổi). Mỗi tháng hưu trí sớm -0,3%, mỗi tháng sau này +0,3%.",
      placeholder: "Nhập một giá trị",
    },
  };

  const t = translations[locale as keyof typeof translations] || translations.en;

  const calculatePension = useCallback(() => {
    const currentAge = parseFloat((document.getElementById("currentAge") as HTMLInputElement)?.value) || 35;
    const plannedRetirementAge = parseFloat((document.getElementById("plannedRetirementAge") as HTMLInputElement)?.value) || 67;
    const entgeltpunkte = parseFloat((document.getElementById("entgeltpunkte") as HTMLInputElement)?.value) || 0;
    const incomeRatio = parseFloat((document.getElementById("incomeRatio") as HTMLInputElement)?.value) || 100;
    const targetPension = parseFloat((document.getElementById("targetPension") as HTMLInputElement)?.value) || 0;
    const rentenwertWest = parseFloat((document.getElementById("rentenwertWest") as HTMLInputElement)?.value) || 38.36;
    const rentenwertOst = parseFloat((document.getElementById("rentenwertOst") as HTMLInputElement)?.value) || 37.60;
    const useWest = (document.getElementById("region") as HTMLSelectElement)?.value === "west";

    const currentRentenwert = useWest ? rentenwertWest : rentenwertOst;
    const yearsToRetirement = Math.max(0, plannedRetirementAge - currentAge);

    // Calculate access factor (Zugangsfaktor)
    // 100% at 67, -0.3% per month early, +0.3% per month late
    const monthsDeviation = (plannedRetirementAge - 67) * 12;
    const accessFactor = 1 + (monthsDeviation * 0.003);

    // Estimate future entgeltpunkte based on income ratio
    const averageEarningsPoints = incomeRatio / 100; // Simplified: 1 point per year at 100% income
    const futureEntgeltpunkte = averageEarningsPoints * yearsToRetirement;
    const totalEntgeltpunkte = entgeltpunkte + futureEntgeltpunkte;

    // German pension formula: Entgeltpunkte × Zugangsfaktor × Rentenartfaktor × aktueller Rentenwert
    // Rentenartfaktor for old-age pension = 1.0
    const rentenartfaktor = 1.0;
    const monthlyGrossPension = totalEntgeltpunkte * accessFactor * rentenartfaktor * currentRentenwert;

    // Calculate pension gap
    const pensionGap = targetPension - monthlyGrossPension;

    // Update display
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 2,
      }).format(value);
    };

    const penElement = document.getElementById("estimatedPensionResult");
    const accessFactorElement = document.getElementById("accessFactorResult");
    const entgeltpunkteElement = document.getElementById("totalEntgeltpunkteResult");
    const gapElement = document.getElementById("pensionGapResult");
    const gapLabelElement = document.getElementById("pensionGapLabel");

    if (penElement) penElement.textContent = formatCurrency(monthlyGrossPension);
    if (accessFactorElement) accessFactorElement.textContent = accessFactor.toFixed(3);
    if (entgeltpunkteElement) entgeltpunkteElement.textContent = totalEntgeltpunkte.toFixed(2);

    if (gapElement && gapLabelElement) {
      if (targetPension > 0) {
        if (pensionGap <= 0) {
          gapElement.textContent = t.noGap;
          gapElement.className = "text-2xl font-bold text-green-600";
          gapLabelElement.style.display = "none";
        } else {
          gapElement.textContent = formatCurrency(pensionGap);
          gapElement.className = "text-2xl font-bold text-orange-600";
          gapLabelElement.style.display = "block";
        }
      } else {
        gapElement.textContent = "—";
        gapLabelElement.style.display = "none";
      }
    }
  }, [t]);

  const handleReset = () => {
    const form = document.getElementById("calculatorForm") as HTMLFormElement;
    if (form) {
      form.reset();
      setTimeout(() => calculatePension(), 0);
    }
  };

  useEffect(() => {
    if (mounted) {
      calculatePension();
    }
  }, [mounted, calculatePension]);

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
                  {t.entgeltpunkte}
                </label>
                <input
                  type="number"
                  id="entgeltpunkte"
                  placeholder={t.placeholder}
                  defaultValue="25"
                  step="0.01"
                  onChange={calculatePension}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.incomeRatio}
                </label>
                <input
                  type="number"
                  id="incomeRatio"
                  placeholder={t.placeholder}
                  defaultValue="100"
                  min="0"
                  max="300"
                  step="0.1"
                  onChange={calculatePension}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.currentAge}
                </label>
                <input
                  type="number"
                  id="currentAge"
                  placeholder={t.placeholder}
                  defaultValue="35"
                  min="0"
                  max="120"
                  onChange={calculatePension}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.plannedRetirementAge}
                </label>
                <input
                  type="number"
                  id="plannedRetirementAge"
                  placeholder={t.placeholder}
                  defaultValue="67"
                  min="0"
                  max="120"
                  onChange={calculatePension}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.targetPension}
                </label>
                <input
                  type="number"
                  id="targetPension"
                  placeholder={t.placeholder}
                  defaultValue="2000"
                  min="0"
                  onChange={calculatePension}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t.rentenwertWest}
                  </label>
                  <input
                    type="number"
                    id="rentenwertWest"
                    placeholder={t.placeholder}
                    defaultValue="38.36"
                    step="0.01"
                    onChange={calculatePension}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t.rentenwertOst}
                  </label>
                  <input
                    type="number"
                    id="rentenwertOst"
                    placeholder={t.placeholder}
                    defaultValue="37.60"
                    step="0.01"
                    onChange={calculatePension}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.chooseRegion}
                </label>
                <select
                  id="region"
                  defaultValue="west"
                  onChange={calculatePension}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors bg-white"
                >
                  <option value="west">{t.west}</option>
                  <option value="ost">{t.ost}</option>
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={calculatePension}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300"
                  aria-label={t.calculate}
                >
                  {t.calculate}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-bold hover:border-gray-400 hover:bg-gray-50 transition-all duration-300"
                  aria-label={t.reset}
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
                <p className="text-sm text-gray-600 mb-1">{t.estimatedGrossPension}</p>
                <p className="text-3xl font-bold text-emerald-600" id="estimatedPensionResult">
                  —
                </p>
              </div>

              <div className="bg-white rounded-lg p-6 border-l-4 border-blue-500">
                <p className="text-sm text-gray-600 mb-1">{t.totalEntgeltpunkte}</p>
                <p className="text-3xl font-bold text-blue-600" id="totalEntgeltpunkteResult">
                  —
                </p>
              </div>

              <div className="bg-white rounded-lg p-6 border-l-4 border-purple-500">
                <p className="text-sm text-gray-600 mb-1">{t.accessFactor}</p>
                <p className="text-3xl font-bold text-purple-600" id="accessFactorResult">
                  —
                </p>
              </div>

              <div className="bg-white rounded-lg p-6 border-l-4 border-orange-500">
                <p className="text-sm text-gray-600 mb-1" id="pensionGapLabel">
                  {t.pensionGap}
                </p>
                <p className="text-2xl font-bold text-orange-600" id="pensionGapResult">
                  —
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8 space-y-3">
                <p className="text-sm text-gray-700 leading-relaxed">
                  <strong>ℹ️ {locale === "de" ? "Hinweis:" : "Note:"}</strong> {t.info}
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  <strong>{locale === "de" ? "Zugangsfaktor:" : "Access Factor:"}</strong> {t.infoAccess}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

